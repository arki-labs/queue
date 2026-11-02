import type { Queue } from 'bullmq';
import type { FailedJobSource } from './source.ts';
export type BullMQFailedJobSourceOptions = {
    /**
     * The BullMQ queue to read. Pass a function when the queue is created lazily
     * (for example `() => instance.queues().get('story-generation')`).
     */
    queue: Queue | (() => Queue | Promise<Queue>);
};
/**
 * Failed jobs of a BullMQ queue.
 *
 * Retry uses BullMQ's own `job.retry('failed')`. That runs one Lua script inside Redis which moves the job
 * out of the `failed` set only if it is still in it. So a duplicate retry is blocked atomically: the second
 * caller finds the job no longer failed and gets `false`.
 *
 * The revision check is NOT part of that script (BullMQ has no conditional-update API and a custom script
 * would copy BullMQ internals). It runs just before the retry, so the race window is the gap between the
 * `getJob` read and the script call (a few Redis round trips). A write slips through that gap only if the
 * job is retried by someone else, runs, and fails again inside it. The job is then in `failed` with a newer
 * revision, and the older approval retries that newer failure once. The effect is one extra run of an
 * already-failed job, never a double run of a job that is queued or active.
 */
export declare function bullmqFailedJobSource(options: BullMQFailedJobSourceOptions): FailedJobSource;
//# sourceMappingURL=bullmq-source.d.ts.map