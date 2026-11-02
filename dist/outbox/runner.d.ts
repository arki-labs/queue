/**
 * `outboxRunner()`: the `JobRunner` the journal worker calls for `kind = 'queue'` rows. It
 * runs a row exactly as the BullMQ worker runs a job: parse the input, build the context
 * once, run the middleware chain around the handler. A job keeps one retry policy on both lanes.
 */
import type { JobRunner } from '@arki/journal';
import type { QueueRegistry } from './registry.ts';
export type OutboxRunnerOptions<TContext> = {
    /** The same nested registry `queue.register()` and `jobs(...)` take. */
    readonly registry: QueueRegistry;
    /** Built once, on the first run, then cached (same rule as `queueWorker`'s `context`). A failure is not cached. */
    readonly context: () => TContext | Promise<TContext>;
    /** The services each top-level branch of the registry runs with, by its key (`RegisterOptions.services`). */
    readonly services?: Readonly<Record<string, object>>;
};
export declare function outboxRunner<TContext>(options: OutboxRunnerOptions<TContext>): JobRunner;
//# sourceMappingURL=runner.d.ts.map