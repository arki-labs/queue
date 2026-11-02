/**
 * pg-boss QueueInstance for the runtime-local stack.
 *
 * Implements the same `{ register, start, stop }` interface as @arki/queue's
 * BullMQ-backed createQueueInstance, but drives pg-boss on PGlite instead.
 *
 * Differences from BullMQ:
 * - No flow/DAG support (pg-boss has no FlowProducer).
 * - Workers wake on poll tick (~500ms) not LISTEN/NOTIFY: pg-boss sends SQL `LISTEN`
 *   through the adapter, and PGlite does not deliver that. (PGlite's own JS
 *   `client.listen()` does deliver in-process; the journal worker uses it.)
 * - ctx.job is a `JobLike` { id, name, data, attemptsMade } — not a full BullMQ Job instance.
 * - ctx.updateProgress and ctx.log are no-ops (pg-boss has no progress reporting API).
 * - Interval schedules are not supported; use cron patterns.
 */
import type { PGlite } from '@electric-sql/pglite';
import type { QueueInstance } from '../types/builder.ts';
export type RuntimeLocalQueueInstanceOptions<TContext> = {
    pglite: PGlite;
    schema?: string;
    createContext: () => TContext | Promise<TContext>;
    /** How often pg-boss recovers abandoned claims. Default 60 seconds. */
    superviseIntervalSeconds?: number;
    /** Queue expiry/retention maintenance cadence. Default 60 seconds. */
    maintenanceIntervalSeconds?: number;
    /** Native expiry/heartbeat monitoring claim cadence. Default 60 seconds. */
    monitorIntervalSeconds?: number;
};
export declare function createRuntimeLocalQueueInstance<TContext>(options: RuntimeLocalQueueInstanceOptions<TContext>): QueueInstance;
//# sourceMappingURL=create-queue.d.ts.map