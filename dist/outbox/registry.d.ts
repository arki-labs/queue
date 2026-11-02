import type { FlowDefinition, ScheduleDefinition } from '../types/builder.ts';
import type { JobDefinition } from '../types/job.ts';
/** A nested record of definitions, as `queue.register()` and `jobs(...)` take it. */
export type QueueRegistry = Record<string, unknown>;
export declare function isJobDefinition(value: unknown): value is JobDefinition<unknown, unknown, unknown>;
export declare function isScheduleDefinition(value: unknown): value is ScheduleDefinition;
export declare function isFlowDefinition(value: unknown): value is FlowDefinition;
export type QueueDefinition = JobDefinition<unknown, unknown, unknown> | ScheduleDefinition | FlowDefinition;
export declare function collectQueueDefinitions(registry: QueueRegistry, definitions?: QueueDefinition[]): readonly QueueDefinition[];
/**
 * The registry's jobs by persisted name. Two definitions under one name throw `OUTBOX_E007`:
 * a stored row finds its job by name alone. The same definition listed twice is one job.
 */
export declare function jobsByName(registry: QueueRegistry): ReadonlyMap<string, JobDefinition<unknown, unknown, unknown>>;
//# sourceMappingURL=registry.d.ts.map