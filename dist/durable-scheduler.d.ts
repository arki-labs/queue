/**
 * BullMQ backend for `@arki/schedule` durable schedules.
 *
 * `@arki/schedule` owns the canonical port imported here. The integration in
 * `packages/queue/src/schedule-port.test.ts` wires `durableScheduler()` into
 * `schedule({ durable })` and checks that both packages share that contract.
 */
import type { DurableScheduler, ScheduleRunResult } from '@arki/schedule/runtime';
import type { QueueConnection } from './redis-connection.ts';
export type { DurableScheduleRegistration, DurableScheduler } from '@arki/schedule/runtime';
/** The schedule package is the sole source of durable tick outcomes. */
export type DurableRunResult = ScheduleRunResult;
export type DurableSchedulerOptions = {
    readonly connection: QueueConnection;
    /** BullMQ key prefix. Default `'queue:'`, the same default as `createQueue`. */
    readonly keyPrefix?: string;
};
/**
 * Create the BullMQ-backed durable scheduler. Inert until `start`: no Redis
 * connection is opened when it is created.
 *
 * Each schedule gets its own BullMQ queue (`schedule.<name>`) holding one job
 * scheduler, and one worker with concurrency 1 in this process. BullMQ hands
 * each tick's job to exactly one worker, so a tick runs once across replicas.
 */
export declare function createDurableScheduler(options: DurableSchedulerOptions): DurableScheduler;
//# sourceMappingURL=durable-scheduler.d.ts.map