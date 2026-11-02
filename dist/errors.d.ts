export declare const QUEUE_DEFINITION_ERROR_CODES: {
    /**
     * A job, schedule or flow definition has no name.
     * @fix Give the job, schedule or flow a non-empty name before building its definition.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly missingName: 'ARKI_QUEUE_E006';
    /**
     * A handler was declared before its input schema.
     * @fix Call .input(schema) before defining the handler or building the declaration.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly missingInput: 'ARKI_QUEUE_E007';
    /**
     * A flow definition has no steps.
     * @fix Add at least one .step(...) before building a flow.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly missingSteps: 'ARKI_QUEUE_E008';
    /**
     * A flow step depends on an undeclared step.
     * @fix Reference only step ids declared in the same flow.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly unknownStepDependency: 'ARKI_QUEUE_E009';
    /**
     * Flow step dependencies contain a cycle.
     * @fix Remove dependency cycles so the flow steps form a directed acyclic graph.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly circularStepDependency: 'ARKI_QUEUE_E010';
    /**
     * A cron interval or time is outside its supported range.
     * @fix Pass cron intervals and times within the helper limits stated by the error.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly invalidCronValue: 'ARKI_QUEUE_E011';
    /**
     * A schedule wrapping a job declares schedule-level middleware.
     * @fix Remove schedule-level .use() when wrapping a job; put middleware on the job instead.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly scheduleMiddlewareWithJob: 'ARKI_QUEUE_E012';
    /**
     * Two schedules use the same name.
     * @fix Give each schedule a distinct .name(...), including schedules wrapping the same job.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly duplicateScheduleName: 'ARKI_QUEUE_E013';
    /**
     * A flow step has more than one dependent.
     * @fix Reshape the flow so a step has at most one dependent; use a supported dependency tree.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly stepWithManyDependents: 'ARKI_QUEUE_E017';
    /**
     * A job name contains characters unsupported by the queue backend.
     * @fix Rename the job with only letters, digits and _ - . / (for example "orders.process"); a job name is its queue name, and BullMQ and pg-boss reject other characters such as ":".
     * @verify bun run test -- src/builder-guards.spec.ts
     */
    readonly invalidJobName: 'ARKI_QUEUE_E020';
};
export declare class QueueDefinitionError extends Error {
    readonly code: (typeof QUEUE_DEFINITION_ERROR_CODES)[keyof typeof QUEUE_DEFINITION_ERROR_CODES];
    readonly remediation: string;
    constructor(args: {
        readonly code: (typeof QUEUE_DEFINITION_ERROR_CODES)[keyof typeof QUEUE_DEFINITION_ERROR_CODES];
        readonly message: string;
        readonly remediation: string;
    });
}
/** Two schedules share a name. The name is the job scheduler id, so the second would replace the first. */
export declare function duplicateScheduleError(name: string): QueueDefinitionError;
export declare const QUEUE_INPUT_ERROR_CODES: {
    /**
     * The enqueue input does not satisfy the flow input schema.
     * @fix Pass enqueue input accepted by the declared flow input schema.
     * @verify bun run test -- src/builder-guards.spec.ts src/flow-builder.spec.ts
     */
    readonly invalidFlowInput: 'ARKI_QUEUE_E018';
};
/**
 * Data handed to `enqueue()` failed its schema. Thrown before anything is
 * written to Redis, so no part of the flow starts. `cause` is the schema error.
 */
export declare class QueueInputError extends Error {
    readonly code: (typeof QUEUE_INPUT_ERROR_CODES)[keyof typeof QUEUE_INPUT_ERROR_CODES];
    readonly remediation: string;
    constructor(args: {
        readonly code: (typeof QUEUE_INPUT_ERROR_CODES)[keyof typeof QUEUE_INPUT_ERROR_CODES];
        readonly message: string;
        readonly remediation: string;
        readonly cause: unknown;
    });
}
/**
 * The job has no active queue transport.
 * @fix Register and start the queue before triggering this job.
 * @verify bun run test -- src/trigger.spec.ts
 */
export declare const QueueUnavailable: import("@arki/failure").FailureDefinition<"queue.unavailable", undefined>;
/**
 * The queue could not confirm whether the job was accepted.
 * @fix Inspect the job by its idempotency key before enqueueing it again.
 * @verify bun run test -- src/trigger.spec.ts
 */
export declare const QueueAcceptanceUnknown: import("@arki/failure").FailureDefinition<"queue.acceptance_unknown", undefined>;
/**
 * The queue worker started in the background and failed (Redis down, a slow start, a context factory that threw), so no job runs.
 * @fix Check Redis connectivity and the worker context factory, then restart the app; use `blocking: true` to fail `app.start()` instead.
 * @verify bun run test -- src/dot.spec.ts
 */
export declare const QueueWorkerStartFailed: import("@arki/failure").FailureDefinition<"queue.worker_start_failed", undefined>;
/** Every failure a job trigger can return — spread it into a contract's error map. */
export declare const JOB_TRIGGER_FAILURES: readonly [import("@arki/failure").FailureDefinition<"schema.invalid_input", import("@standard-schema/spec").StandardSchemaV1<unknown, {
    issues: readonly import("@standard-schema/spec").StandardSchemaV1.Issue[];
}>>, import("@arki/failure").FailureDefinition<"schema.validator_defect", undefined>, import("@arki/failure").FailureDefinition<"queue.unavailable", undefined>, import("@arki/failure").FailureDefinition<"queue.acceptance_unknown", undefined>, import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>];
export type JobTriggerFailure = ReturnType<(typeof JOB_TRIGGER_FAILURES)[number]>;
//# sourceMappingURL=errors.d.ts.map