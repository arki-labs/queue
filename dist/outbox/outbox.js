/**
 * `outbox()`: schedule a queue job inside the caller's Postgres transaction. The job row
 * lands in the journal's `journal_jobs` table and commits with the business write or not
 * at all. The journal worker runs it (with `outboxRunner`). No Redis on this path.
 */
import { and, eq, is, isNull, sql } from 'drizzle-orm';
import { getTableConfig, PgAsyncTransaction } from 'drizzle-orm/pg-core';
import { InvalidInput, isFailure, ValidatorDefect } from '@arki/failure';
import { jobId } from '@arki/journal';
import { parseAsync } from '@arki/schema';
import { QUEUE_PRIORITIES } from '../types/job.js';
import { OUTBOX_ERROR_CODES, outboxError } from './errors.js';
const DEFAULT_MAX_ARGS_BYTES = 262_144;
const PRIORITIES = new Set(Object.values(QUEUE_PRIORITIES));
/** The journal runs higher first, default 0; the queue runs lower first, NORMAL 5. `5 - p` maps NORMAL to 0. */
const storedPriority = (priority) => QUEUE_PRIORITIES.NORMAL - priority;
const WAKE_PAYLOAD = '{"queue":1}';
/** Why `value` is not plain JSON, or `undefined` when it is. `ancestors` catches cycles, not shared references. */
function jsonProblem(value, path, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return undefined;
    if (typeof value === 'number')
        return Number.isFinite(value) ? undefined : `${path} is ${String(value)}`;
    if (value === undefined)
        return `${path} is undefined`;
    if (typeof value !== 'object')
        return `${path} is a ${typeof value}`;
    if (ancestors.has(value))
        return `${path} is a cycle`;
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
        return `${path} is a ${value.constructor.name}, not a plain object`;
    ancestors.add(value);
    try {
        const entries = Array.isArray(value)
            ? Array.from({ length: value.length }, (_, index) => [`${path}[${index}]`, value[index]])
            : Object.entries(value).map(([key, child]) => [`${path}.${key}`, child]);
        for (const [childPath, child] of entries) {
            const problem = jsonProblem(child, childPath, ancestors);
            if (problem !== undefined)
                return problem;
        }
        return undefined;
    }
    finally {
        ancestors.delete(value);
    }
}
/** `schema.invalid_input` unless `args` is plain JSON within `maxBytes` UTF-8 bytes; `undefined` when it is. */
export function jsonArgsFailure(args, maxBytes, jobName) {
    const problem = jsonProblem(args, 'args', new Set());
    if (problem !== undefined)
        return InvalidInput({ issues: [{ message: `outbox: "${jobName}" args are not plain JSON: ${problem}` }] });
    const bytes = new TextEncoder().encode(JSON.stringify(args)).byteLength;
    if (bytes > maxBytes)
        return InvalidInput({
            issues: [
                {
                    message: `outbox: "${jobName}" args are ${String(bytes)} bytes as JSON; the limit is ${String(maxBytes)}`,
                },
            ],
        });
    return undefined;
}
/** The scheduling entry point. Build it once per app: `export const schedule = outbox({ tables })`. */
export function outbox(options) {
    const jobs = options.tables.jobs;
    const maxArgsBytes = options.maxArgsBytes ?? DEFAULT_MAX_ARGS_BYTES;
    // The journal's wake channel: every journal worker of this table hears it.
    const tableSchema = getTableConfig(jobs).schema;
    const channel = tableSchema === undefined ? 'journal_wake' : `${tableSchema}_journal_wake`;
    const schedule = async (tx, job, args, when, scheduleOptions) => {
        const name = job._internal.name;
        // Catches callers that skip the types. Not a security boundary.
        if (!is(tx, PgAsyncTransaction))
            throw outboxError(OUTBOX_ERROR_CODES.notInTransaction, `outbox: "${name}" was scheduled on a root database; pass the transaction`);
        if ('at' in when ? Number.isNaN(when.at.getTime()) : !Number.isSafeInteger(when.delayMs) || when.delayMs < 0)
            throw outboxError(OUTBOX_ERROR_CODES.badTiming, 'at' in when
                ? `outbox: "${name}" runAt got an invalid Date`
                : `outbox: "${name}" delayMs must be a non-negative safe integer, got ${String(when.delayMs)}`);
        const priority = scheduleOptions?.priority ?? QUEUE_PRIORITIES.NORMAL;
        if (!PRIORITIES.has(priority))
            throw outboxError(OUTBOX_ERROR_CODES.badTiming, `outbox: "${name}" priority ${String(priority)} is not one of QUEUE_PRIORITIES`);
        // Validated now, so a bad call rolls back the business write. The parsed value is dropped:
        // the raw args are stored and the worker parses them, so a transform runs once.
        const parsed = await parseAsync(job._internal.inputSchema, args);
        if (InvalidInput.is(parsed) || ValidatorDefect.is(parsed))
            return parsed;
        const notJson = jsonArgsFailure(args, maxArgsBytes, name);
        if (notJson !== undefined)
            return notJson;
        const key = scheduleOptions?.key;
        const id = jobId();
        if (isFailure(id))
            return id;
        const insert = tx.insert(jobs).values({
            id,
            kind: 'queue',
            jobName: name,
            // Drizzle sends JS null as SQL NULL; the column needs the JSON value null.
            args: args === null ? sql `'null'::jsonb` : args,
            dedupeKey: key ?? null,
            priority: storedPriority(priority),
            // Database time: the delay counts from the transaction's now(), like an effect's delaySeconds.
            ...('at' in when
                ? { availableAt: when.at }
                : when.delayMs > 0
                    ? { availableAt: sql `now() + make_interval(secs => ${when.delayMs / 1000})` }
                    : {}),
        });
        const inserted = await (key === undefined
            ? insert.returning({ id: jobs.id })
            : insert
                .onConflictDoNothing({ target: [jobs.jobName, jobs.dedupeKey], where: sql `${jobs.dedupeKey} is not null` })
                .returning({ id: jobs.id }));
        const row = inserted[0];
        if (row === undefined) {
            const [existing] = await tx
                .select({ id: jobs.id })
                .from(jobs)
                .where(and(eq(jobs.jobName, name), eq(jobs.dedupeKey, key ?? '')));
            if (existing === undefined)
                throw new Error(`outbox: "${name}" key ${JSON.stringify(key)} conflicted but no row holds it`);
            return { id: existing.id, deduplicated: true };
        }
        // Delivered at commit, dropped on rollback; identical payloads in one transaction coalesce.
        await tx.execute(sql `select pg_notify(${channel}, ${WAKE_PAYLOAD})`);
        return { id: row.id, deduplicated: false };
    };
    return {
        runAfter: (tx, job, args, scheduleOptions) => schedule(tx, job, args, { delayMs: scheduleOptions?.delayMs ?? 0 }, scheduleOptions),
        runAt: (tx, job, args, at, scheduleOptions) => 
        // `instanceof` first: a JS caller may pass anything.
        schedule(tx, job, args, { at: at instanceof Date ? at : new Date(Number.NaN) }, scheduleOptions),
        cancel: async (tx, id) => {
            const gone = await tx
                .delete(jobs)
                .where(and(eq(jobs.id, id), eq(jobs.kind, 'queue'), isNull(jobs.leaseToken)))
                .returning({ id: jobs.id });
            return gone.length === 1;
        },
    };
}
//# sourceMappingURL=outbox.js.map