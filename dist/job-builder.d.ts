import type { Failure } from '@arki/failure';
import type { JobTriggerResult } from './trigger.ts';
import type { JobBuilderDef } from './types/builder.ts';
import type { InternalJobDefinition, TriggerOptions } from './types/job.ts';
import type { JobMiddleware } from './types/middleware.ts';
import type { QueueConfig, QueueMeta } from './types/queue.ts';
/**
 * Create a job builder
 * @internal
 */
export declare function createJobBuilder<TContext, TContextOut, TMeta extends QueueMeta, TFailure extends Failure = never>(params: {
    config: QueueConfig;
    middlewares: readonly JobMiddleware<unknown, unknown, QueueMeta, TFailure>[];
}): JobBuilderDef<TContext, TContextOut, TMeta, TFailure>;
/**
 * A job's `trigger()`: add to the queue `register()` stored on the definition. A renamed copy
 * of a job (a feature instance's, `send-mail#eu`) triggers through its own queue the same way.
 * @internal
 */
export declare function triggerJob<TInput, TOutput, TDeps>(internal: InternalJobDefinition<TInput, TOutput, TDeps>, data: TInput, options?: TriggerOptions): Promise<JobTriggerResult>;
//# sourceMappingURL=job-builder.d.ts.map