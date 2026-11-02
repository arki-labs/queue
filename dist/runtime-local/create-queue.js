import { getConstructionPlans, PgBoss } from 'pg-boss';
import { z } from 'zod';
import { isFailure } from '@arki/failure';
import { is, parseAsync, recordSchema } from '@arki/schema';
import { debugJob, debugRegister, debugSchedule, debugWorker, observeQueue } from '../debug.js';
import { withEnqueueSpan } from '../enqueue-span.js';
import { duplicateScheduleError } from '../errors.js';
import { executeJob } from '../job-outcome.js';
import { defaultJobRetry, jobFailureEnvelope, retryReason } from '../job-retry.js';
import { captureJobTrace } from '../job-trace.js';
import { QueueUnavailable } from '../errors.js';
import { triggerValidated } from '../trigger.js';
import { buildPgBossAdapter } from './adapter.js';
import { pgBossJobId } from './identity.js';
import { settlePgBossFailure } from './settle.js';
const POLL_INTERVAL_SECONDS = 0.5;
const DEFAULT_SCHEMA = 'infra_pg_boss';
// A versioned object envelope lets pg-boss transport every JSON schema output, including primitives.
const storedMessage = z.object({
    version: z.literal(1),
    input: z.unknown(),
    trace: z.string().optional(),
    key: z.string().optional(),
});
/** Minimal job shim satisfying what middleware accesses at runtime (job.id, job.name). */
function makeJobShim(id, name, data, attemptsMade = 0) {
    return {
        id,
        name,
        data,
        attemptsMade,
        updateProgress: async () => {
            /* local jobs report no progress */
        },
        log: async (msg) => {
            observeQueue(() => debugJob.info('[{job}] {message}', { job: name, message: msg }));
        },
    };
}
export function createRuntimeLocalQueueInstance(options) {
    const { pglite, schema = DEFAULT_SCHEMA, createContext } = options;
    if (!/^[a-z_]\w*$/i.test(schema))
        throw new Error(`Invalid pg-boss schema name: ${schema}`);
    let boss = null;
    // Job definitions keyed by name — populated at register() time
    const jobDefs = new Map();
    // The services of the feature that registered each job (`RegisterOptions.services`), by job name
    const jobServices = new Map();
    // Schedule definitions — populated at register() time
    const scheduleDefs = new Map();
    // ── Registry traversal ─────────────────────────────────────────────────
    function registerJobDef(def, services) {
        const name = def._internal.name;
        if (jobDefs.has(name))
            return;
        if (services !== undefined)
            jobServices.set(name, services);
        def._internal._trigger = (data, opts) => {
            const activeBoss = boss;
            if (activeBoss === null)
                return withEnqueueSpan(() => QueueUnavailable(), name);
            return triggerValidated(def._internal.inputSchema, data, opts?.jobId, async (key) => {
                const acknowledged = await activeBoss.send(name, { version: 1, input: data, trace: captureJobTrace(), key }, {
                    ...(opts?.priority === undefined ? {} : { priority: opts.priority }),
                    startAfter: opts?.delay ? new Date(Date.now() + opts.delay) : undefined,
                    // Explicit ids provide durable duplicate suppression; singleton keys expire with retention.
                    id: pgBossJobId(name, key),
                });
                if (acknowledged === null && !(await activeBoss.getJobById(name, pgBossJobId(name, key))))
                    return;
                return key;
            }, name);
        };
        jobDefs.set(name, def);
        observeQueue(() => debugRegister.debug('[runtime-local] registered job: {job}', { job: name }));
    }
    function registerScheduleDef(def, services) {
        const internal = def._internal;
        if (scheduleDefs.has(internal.name))
            throw duplicateScheduleError(internal.name);
        if (internal.type === 'interval') {
            observeQueue(() => debugSchedule.warn('[runtime-local] schedule {schedule} uses interval type — not supported on pg-boss. ' +
                'Convert to a cron pattern or handle it manually.', { schedule: internal.name }));
            return;
        }
        if (internal.type === 'timeout') {
            observeQueue(() => debugSchedule.warn('[runtime-local] schedule {schedule} uses timeout type — not natively supported on pg-boss. ' +
                'Use boss.sendAfter() directly or send a delayed job via trigger().', { schedule: internal.name }));
            return;
        }
        // A schedule sends to its job's own queue (an inline schedule's job is
        // anonymous, named after the schedule); ensure that job has a worker.
        registerJobDef(internal.job, services);
        scheduleDefs.set(internal.name, internal);
        observeQueue(() => debugSchedule.debug('[runtime-local] registered schedule: {schedule} ({internalValue})', {
            schedule: internal.name,
            internalValue: internal.value,
        }));
    }
    async function traverseRegistry(registry, services) {
        for (const value of Object.values(registry)) {
            if (is(value, recordSchema)) {
                if ('_type' in value) {
                    if (value._type === 'job') {
                        registerJobDef(value, services);
                    }
                    else if (value._type === 'schedule') {
                        registerScheduleDef(value, services);
                    }
                    else if (value._type === 'flow') {
                        observeQueue(() => debugRegister.warn('[runtime-local] flow definitions are not supported — skipping'));
                    }
                }
                else {
                    await traverseRegistry(value, services);
                }
            }
        }
    }
    // ── Public QueueInstance ───────────────────────────────────────────────
    async function register(registry, options) {
        observeQueue(() => debugRegister.debug('[runtime-local] traversing registry'));
        // Each top-level branch runs with its own services (a feature's, keyed by its name), if any
        for (const [key, value] of Object.entries(registry)) {
            await traverseRegistry({ [key]: value }, options?.services?.[key]);
        }
    }
    async function start() {
        observeQueue(() => debugWorker.debug('[runtime-local] bootstrapping pg-boss schema: {schema}', { schema }));
        // Pre-run the schema DDL via the multi-statement runner before PgBoss is constructed.
        // This is required because PgBoss's bootstrap is a multi-statement block that only
        // the Simple Query Protocol can execute (see adapter.ts for full explanation).
        // Only on a fresh database: the plan is not idempotent ("type job_state
        // already exists"), so a restart on a persisted PGlite would fail here.
        const installed = await pglite.query('select to_regclass($1)::text as name', [
            `${schema}.version`,
        ]);
        if (!installed.rows[0]?.name) {
            await pglite.exec(getConstructionPlans(schema));
        }
        boss = new PgBoss({
            db: buildPgBossAdapter(pglite),
            schema,
            createSchema: false, // schema already bootstrapped above
            migrate: false, // same
            superviseIntervalSeconds: options.superviseIntervalSeconds ?? 60,
            maintenanceIntervalSeconds: options.maintenanceIntervalSeconds ?? 60,
            monitorIntervalSeconds: options.monitorIntervalSeconds ?? 60,
        });
        await boss.start();
        observeQueue(() => debugWorker.debug('[runtime-local] pg-boss started'));
        // Register a boss.work() handler for every job.
        for (const [name, def] of jobDefs.entries()) {
            const retry = def._internal.options?.retry ?? defaultJobRetry;
            // Native supervision handles provider failures and abandoned claims. Handler outcomes
            // are settled exactly once by settlePgBossFailure, with their own Backoff decision.
            await boss.createQueue(name, {
                retryLimit: Number.isFinite(retry.maxRetries) ? retry.maxRetries : 2_147_483_647,
                ...def._internal.options?.runtimeLocalOptions,
            });
            const activeBoss = boss;
            await activeBoss.work(name, { pollingIntervalSeconds: POLL_INTERVAL_SECONDS, batchSize: 1 }, async ([pgBossJob]) => {
                if (!pgBossJob)
                    return;
                const message = await parseAsync(storedMessage, pgBossJob.data);
                const outcome = isFailure(message)
                    ? message
                    : await executeJob(def._internal, makeJobShim(message.key ?? pgBossJob.id, name, message.input, pgBossJob.retryCount), createContext, jobServices.get(name), pgBossJob.signal, message.trace);
                if (isFailure(outcome)) {
                    await settlePgBossFailure(pglite, activeBoss, schema, name, pgBossJob, jobFailureEnvelope(outcome), retry.delay(pgBossJob.retryCount + 1, retryReason(outcome)));
                    return;
                }
                return outcome;
            });
            observeQueue(() => debugWorker.debug('[runtime-local] worker started for: {for}', { for: name }));
        }
        // Register cron schedules. A schedule is a trigger: boss.schedule sends its
        // data to the job's own queue, keyed by the schedule name so several
        // schedules can target one job; the job's boss.work() above runs it.
        for (const [name, internal] of scheduleDefs.entries()) {
            const pattern = internal.value;
            const jobName = internal.job._internal.name;
            await boss.schedule(jobName, pattern, { version: 1, input: internal.data }, {
                tz: internal.options?.timezone,
                key: name,
            });
            observeQueue(() => debugSchedule.debug('[runtime-local] schedule registered: {registered} -> {jobName} (cron: {cron})', {
                registered: name,
                jobName,
                cron: pattern,
            }));
        }
        // Drop schedules no longer in code. Each schedule is keyed by its name on
        // its job's queue, so a renamed or deleted one leaves a keyed entry the
        // job's worker would keep running. Unkeyed entries are not ours: leave them.
        const liveKeys = new Map();
        for (const [name, internal] of scheduleDefs.entries()) {
            const jobName = internal.job._internal.name;
            liveKeys.set(jobName, (liveKeys.get(jobName) ?? new Set()).add(name));
        }
        for (const jobName of jobDefs.keys()) {
            for (const stale of await boss.getSchedules(jobName)) {
                if (stale.key !== '' && !liveKeys.get(jobName)?.has(stale.key)) {
                    observeQueue(() => debugSchedule.debug('[runtime-local] removing schedule no longer registered: {registered} (key {staleKey})', {
                        registered: jobName,
                        staleKey: stale.key,
                    }));
                    await boss.unschedule(jobName, stale.key);
                }
            }
        }
        observeQueue(() => debugRegister.debug('queue infrastructure started (runtime-local): {jobs} jobs, {schedules} schedules', {
            jobs: jobDefs.size,
            schedules: scheduleDefs.size,
        }));
    }
    async function stop() {
        observeQueue(() => debugWorker.debug('[runtime-local] shutting down'));
        if (boss) {
            await boss.stop({ graceful: true });
            boss = null;
        }
    }
    return { register, start, stop };
}
//# sourceMappingURL=create-queue.js.map