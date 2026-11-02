/**
 * Queue instance implementation for v2.0
 *
 * Integrates with initQueue builder pattern and supports:
 * - Job registration and execution with middleware
 * - Schedule registration (cron and interval)
 * - Flow registration (multi-step workflows)
 * - Registry traversal (nested job organization)
 */
import type { QueueOptions } from 'bullmq';
import type { QueueConnection } from './redis-connection.ts';
import type { BullMQQueueInstance } from './types/builder.ts';
import type { JobOptions } from './types/job.ts';
/**
 * The BullMQ queue options of one job's queue. Retry defaults live on the
 * queue (not on each `add()`), so every producer of a job — the worker's own
 * `trigger()` and the `queue()` DOT client — must build its queue from this.
 */
export declare function jobQueueOptions(options: JobOptions | undefined, connection: QueueConnection, keyPrefix: string): QueueOptions;
/**
 * Queue instance options
 */
export type QueueInstanceOptions<TContext> = {
    connection: QueueConnection;
    keyPrefix?: string;
    createContext: () => TContext | Promise<TContext>;
};
/**
 * Create a queue instance that can register and run jobs, schedules, and flows
 * @internal - Called by QueueBuilder.createQueue()
 */
export declare function createQueueInstance<TContext>(options: QueueInstanceOptions<TContext>): BullMQQueueInstance;
//# sourceMappingURL=create-queue.d.ts.map