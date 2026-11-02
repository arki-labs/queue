import type { IdGenerationFailure } from '@arki/contracts';
import type { AsyncSchemaFailure } from '@arki/failure';
import type { DbHandle, JournalTables } from '@arki/journal';
import { InvalidInput } from '@arki/failure';
import type { JobDefinition, QueuePriority } from '../types/job.ts';
/** A Drizzle transaction or savepoint. A root database has no `rollback`, so it does not fit. */
export type OutboxTx = DbHandle & {
    rollback(): never;
};
export type OutboxOptions = {
    /** The journal tables of the app (`journalTables(schema?)`); only `jobs` is written. */
    readonly tables: Pick<JournalTables, 'jobs'>;
    /** UTF-8 bytes of `JSON.stringify(args)`. Default 262_144 (256 KiB). */
    readonly maxArgsBytes?: number;
};
export type ScheduleOptions = {
    /** Due this long after the transaction's `now()`. Default 0. Non-negative safe integer. */
    readonly delayMs?: number;
    /** Dedupes among unfinished rows (pending, running, dead) of the same job, like `TriggerOptions.jobId`. */
    readonly key?: string;
    /** Same scale as `trigger`: 1 critical … 10 background. Default NORMAL (5). */
    readonly priority?: QueuePriority;
};
/** `id` is the job id (`job_xxx`), provisional until the caller's transaction commits. */
export type Scheduled = {
    readonly id: string;
    readonly deduplicated: boolean;
};
export type Outbox = {
    runAfter<TInput, TOutput, TContext>(tx: OutboxTx, job: JobDefinition<TInput, TOutput, TContext>, args: NoInfer<TInput>, options?: ScheduleOptions): Promise<Scheduled | AsyncSchemaFailure | IdGenerationFailure>;
    runAt<TInput, TOutput, TContext>(tx: OutboxTx, job: JobDefinition<TInput, TOutput, TContext>, args: NoInfer<TInput>, at: Date, options?: Omit<ScheduleOptions, 'delayMs'>): Promise<Scheduled | AsyncSchemaFailure | IdGenerationFailure>;
    /** Delete a row no worker holds. `false` when it is running, finished, or never existed. */
    cancel(tx: DbHandle, id: string): Promise<boolean>;
};
/** `schema.invalid_input` unless `args` is plain JSON within `maxBytes` UTF-8 bytes; `undefined` when it is. */
export declare function jsonArgsFailure(args: unknown, maxBytes: number, jobName: string): ReturnType<typeof InvalidInput> | undefined;
/** The scheduling entry point. Build it once per app: `export const schedule = outbox({ tables })`. */
export declare function outbox(options: OutboxOptions): Outbox;
//# sourceMappingURL=outbox.d.ts.map