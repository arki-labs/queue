/**
 * Middleware execution engine
 * Handles running a chain of middleware with context transformations
 */
import type { JobContext, JobLike } from './types/job.ts';
import type { JobMiddleware } from './types/middleware.ts';
import type { QueueMeta } from './types/queue.ts';
/**
 * Run a job's middleware chain around its handler (onion order).
 * Similar to tRPC's middleware execution but adapted for jobs
 *
 * The handler is the innermost `next()`: each middleware's `next()` resolves
 * only after everything inside it, handler included, has finished, and
 * rejects with the handler's error. `next({ ctx })` replaces the context for
 * what follows. Both the BullMQ and the runtime-local queue run jobs here.
 *
 * @param middlewares - Array of middleware to execute
 * @param initialContext - The starting context (from createContext)
 * @param data - Job data
 * @param job - The job that runs (a BullMQ `Job`, or the same shape from another lane)
 * @param meta - Queue metadata
 * @param handler - The job handler, called with the context the last middleware passed on
 * @returns What the handler returned, or `undefined` when a middleware returned without calling `next()`
 */
export declare function executeMiddlewareChain<TContext, TContextOut, TOutput, TMiddlewareOutput = never>(middlewares: readonly JobMiddleware<unknown, unknown, QueueMeta, TMiddlewareOutput>[], initialContext: TContext, data: unknown, job: JobLike, meta: QueueMeta, handler: (ctx: TContextOut) => Promise<TOutput>): Promise<TOutput | TMiddlewareOutput | undefined>;
/**
 * The base context a feature's job runs with: the worker's context plus `services`, the
 * services of the feature that registered the job (see `FeatureJobContext` in `@arki/queue/dot`).
 * A job registered outside a feature (`services` undefined) keeps the worker's context as is.
 */
export declare function withFeatureServices<TContext>(baseContext: TContext, services: object | undefined): TContext;
/**
 * Create a job context with utility methods
 * Wraps the base context with updateProgress, log, and job instance
 *
 * @param baseContext - The context from middleware chain
 * @param job - The job that runs (a BullMQ `Job`, or the same shape from another lane)
 * @returns JobContext with utility methods
 */
export declare function createJobContext<TContext>(baseContext: TContext, job: JobLike, signal?: AbortSignal): JobContext<TContext>;
//# sourceMappingURL=middleware.d.ts.map