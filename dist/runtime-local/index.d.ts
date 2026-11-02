/**
 * The queue on pg-boss and PGlite, with no Redis.
 *
 * A pg-boss-on-PGlite implementation of the @arki/queue DSL.
 * Same `initQueue.context<TContext>().create()` entry point; same job, schedule,
 * middleware, and registry builders. No flow support. No Redis.
 *
 * Usage:
 * ```ts
 * import { initQueue } from '@arki/queue/runtime-local';
 * import { createRuntimeLocalQueueInstance } from '@arki/queue/runtime-local';
 *
 * const q = initQueue.context<MyContext>().create();
 * const myJob = q.job.name('my-job').input(schema).handler(handler);
 *
 * const queue = createRuntimeLocalQueueInstance({ pglite, createContext });
 * await queue.register(q.registry({ myJob }));
 * await queue.start();
 * ```
 *
 * Swap to the BullMQ path later by changing the import of
 * `createRuntimeLocalQueueInstance` to `q.createQueue` from `@arki/queue`.
 */
export { initQueue } from '../init.ts';
export { createRuntimeLocalQueueInstance, type RuntimeLocalQueueInstanceOptions } from './create-queue.ts';
//# sourceMappingURL=index.d.ts.map