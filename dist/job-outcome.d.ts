import type { AsyncSchemaFailure } from '@arki/failure';
import type { InternalJobDefinition, JobLike } from './types/job.ts';
export declare const JOB_SYSTEM_FAILURES: readonly [import("@arki/failure").FailureDefinition<"async.cancelled", undefined>, import("@arki/failure").FailureDefinition<"async.deadline", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>];
export type JobSystemFailure = ReturnType<(typeof JOB_SYSTEM_FAILURES)[number]>;
export type JobExecutionFailure = AsyncSchemaFailure | JobSystemFailure;
/**
 * Preserve the handler's exact success/refusal union; add only canonical execution failures.
 * A deadline aborts the owned signal, then waits for cooperative settlement before retry is possible.
 */
export declare function executeJob<Input, Output, Dependencies>(internal: InternalJobDefinition<Input, Output, Dependencies>, job: JobLike, createContext: () => unknown, services?: object, signal?: AbortSignal, traceMetadata?: string): Promise<Output | JobExecutionFailure>;
//# sourceMappingURL=job-outcome.d.ts.map