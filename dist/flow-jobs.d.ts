/**
 * Turn a built flow into BullMQ flow jobs, and start it.
 *
 * A flow is a BullMQ tree. A step that no other step depends on is a root.
 * The steps in its `dependsOn` become its children, recursively. BullMQ runs
 * the children first and the parent once all of them completed. The flow
 * builder already rejected cycles and steps with two dependents, so every
 * step lands in exactly one tree, exactly once.
 */
import type { FlowJob, FlowProducer } from 'bullmq';
import type { FlowDefinition, FlowEnqueueResult } from './types/builder.ts';
export declare const FLOW_ENQUEUE_FAILURES: readonly [import("@arki/failure").FailureDefinition<"schema.invalid_input", import("@standard-schema/spec").StandardSchemaV1<unknown, {
    issues: readonly import("@standard-schema/spec").StandardSchemaV1.Issue[];
}>>, import("@arki/failure").FailureDefinition<"schema.validator_defect", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"queue.acceptance_unknown", undefined>];
export type FlowEnqueueFailure = ReturnType<(typeof FLOW_ENQUEUE_FAILURES)[number]>;
/**
 * The BullMQ flow jobs of a built flow for one (already validated) input:
 * one tree per root step. Pure: touches no Redis.
 */
export declare function toFlowJobs(flow: FlowDefinition, input: unknown): FlowJob[];
/**
 * Validate `input` with the flow's schema (async: the enqueue call already awaits).
 * Returns `InvalidInput` when the input does not match, or `ValidatorDefect` when the schema cannot run.
 */
export declare function parseFlowInput(flow: FlowDefinition, input: unknown): Promise<unknown>;
/**
 * Validate the input, then add the whole flow in one atomic `addBulk`.
 * Invalid input or a broken data mapper returns a canonical failure before opening the producer.
 */
export declare function addFlow(openProducer: () => FlowProducer, flow: FlowDefinition, input: unknown): Promise<FlowEnqueueResult | FlowEnqueueFailure>;
//# sourceMappingURL=flow-jobs.d.ts.map