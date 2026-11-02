/**
 * Typed background jobs, schedules and flows on BullMQ and Redis.
 *
 * A tRPC-inspired builder API for defining and managing them.
 *
 * @example
 * ```typescript
 * import { initQueue } from '@arki/queue';
 * import { z } from '@arki/contracts';
 *
 * // 1. Create context
 * const createContext = () => ({
 *   db: database,
 *   repo: repositories,
 *   kv: kvStore,
 * });
 *
 * // 2. Initialize queue
 * const q = initQueue
 *   .context<typeof createContext>()
 *   .create({
 *     transformer: superjson,
 *   });
 *
 * // 3. Create job builders with middleware
 * const baseJob = q.job.use(errorHandling).use(logging);
 * const authJob = baseJob.use(authMiddleware);
 *
 * // 4. Define jobs
 * const sendEmail = authJob
 *   .name('notifications.send-email')
 *   .input(z.object({ to: z.email(), subject: z.string(), body: z.string() }))
 *   .handler(async (data, ctx) => {
 *     // ctx has: db, repo, kv, user (from middleware)
 *     await ctx.repo.notifications.create(data);
 *     return { sent: true };
 *   });
 *
 * // 5. Create flows
 * const orderFlow = q.flow
 *   .name('orders.process')
 *   .input(z.object({ orderId: z.string() }))
 *   .step('validate', {
 *     job: validateJob,
 *     data: input => ({ orderId: input.orderId }),
 *   })
 *   .step('payment', {
 *     job: paymentJob,
 *     data: input => ({ orderId: input.orderId }),
 *     dependsOn: ['validate'],
 *   })
 *   .build();
 *
 * // 6. Organize with registries
 * const jobs = q.registry({
 *   notifications: q.registry({
 *     email: sendEmail,
 *   }),
 * });
 *
 * // 7. Create and start queue
 * const queue = q.createQueue({
 *   connection: 'redis://localhost:6379',
 *   createContext,
 * });
 * await queue.register(jobs);
 * await queue.start();
 * ```
 */
export { initQueue } from './init.js';
// Middleware execution (for advanced use cases)
export { createJobContext, executeMiddlewareChain } from './middleware.js';
export { around, step } from './step.js';
// Bull Board UI (unchanged)
export { BullMQAdapter, HonoAdapter, createBoard } from './create-board.js';
// Constants
export { QUEUE_PRIORITIES } from './types/index.js';
// Coded errors for declaration mistakes and invalid enqueue input
export { QUEUE_DEFINITION_ERROR_CODES, QUEUE_INPUT_ERROR_CODES, QueueDefinitionError, QueueInputError, } from './errors.js';
// Cron pattern helpers
export { CronPatterns } from './cron-patterns.js';
// Retry strategies
// Retry schedules for `JobOptions.retry`, from @arki/resilience
export { backoff } from '@arki/resilience';
// Durable backend for @arki/schedule, for processes that do not boot through Dot
export { createDurableScheduler } from './durable-scheduler.js';
// Value-based execution for custom delivery adapters; handler failures retain their exact union.
export { executeJob, JOB_SYSTEM_FAILURES } from './job-outcome.js';
export { QueueUnavailable, QueueAcceptanceUnknown, QueueWorkerStartFailed, JOB_TRIGGER_FAILURES } from './errors.js';
export { FLOW_ENQUEUE_FAILURES } from './flow-jobs.js';
export { queueJobId } from './job-id.js';
//# sourceMappingURL=index.js.map