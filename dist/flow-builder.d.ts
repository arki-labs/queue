/**
 * Flow builder implementation
 * Provides chainable API for creating multi-step workflows
 *
 * Flows define multi-step workflows where steps can depend on each other:
 * - Each step runs a job with data derived from flow input
 * - Steps can specify dependencies (must run after other steps complete)
 * - The steps form a tree (a BullMQ flow): each step is in the `dependsOn`
 *   of at most one other step. A parent step runs after all its children.
 * - Each step runs in its own job's worker, with that job's middleware (a flow has no `.use()`)
 *
 * @example
 * ```typescript
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
 * ```
 */
import type { StandardSchemaV1 } from '@arki/schema';
import type { FlowBuilderStart, FlowStepOptions } from './types/builder.ts';
import type { JobDefinition } from './types/job.ts';
import type { QueueConfig, QueueMeta } from './types/queue.ts';
/**
 * Internal step representation.
 *
 * The builder stores each step's job as `AnyJobDefinition` (steps have
 * different job types); the queue reads `_internal` back with the default
 * `TJob`, the same erasure boundary schedules use.
 */
type FlowStepInternal<TJob = JobDefinition<unknown, unknown, unknown>> = {
    id: string;
    job: TJob;
    data: (input: unknown) => unknown;
    opts?: FlowStepOptions;
    dependsOn?: readonly string[];
};
/**
 * Internal flow definition structure
 * This is what gets stored in FlowDefinition._internal
 */
export type InternalFlowDefinition<TInput = unknown, TJob = JobDefinition<unknown, unknown, unknown>> = {
    /**
     * Flow name
     */
    name: string;
    /**
     * Input schema for the flow
     */
    inputSchema: StandardSchemaV1<unknown, TInput>;
    /**
     * Steps in the flow
     */
    steps: readonly FlowStepInternal<TJob>[];
    /**
     * Queue configuration
     */
    config: QueueConfig;
};
/**
 * Create a flow builder start (after name is set)
 * @internal
 */
export declare function createFlowBuilder<TContext, TMeta extends QueueMeta>(name: string, config: QueueConfig): FlowBuilderStart<TContext, TMeta>;
export {};
//# sourceMappingURL=flow-builder.d.ts.map