/**
 * The producer side of a queue: enqueue jobs without running any worker.
 *
 * A job's own `trigger()` only works once a worker registered it in the same
 * process. An API server that enqueues work for a separate worker process
 * needs this client instead. It opens one BullMQ queue per job name, on first
 * use, with the same options the worker uses for that job's queue. Flows go
 * through one BullMQ `FlowProducer`, also opened on first use.
 */
import type { QueueConnection } from './redis-connection.ts';
import type { QueueEnqueue } from './types/builder.ts';
export type QueueClientOptions = {
    readonly connection: QueueConnection;
    /** Must match the worker's prefix. Defaults to `'queue:'`, the worker's default. */
    readonly keyPrefix?: string;
};
export type QueueClient = {
    /** Where this client enqueues. A worker that shares the client reads these. */
    readonly connection: QueueConnection;
    readonly keyPrefix: string;
    /**
     * Add one job to its queue (returns the BullMQ job id), or start a flow:
     * validate `input` with the flow's schema, then add every step's job.
     */
    enqueue: QueueEnqueue;
};
export type QueueClientHandle = {
    readonly client: QueueClient;
    /** Close every queue (and the flow producer) the client opened. Safe to call more than once. */
    close(): Promise<void>;
};
export declare function createQueueClient(options: QueueClientOptions): QueueClientHandle;
//# sourceMappingURL=queue-client.d.ts.map