/** Enqueue is an acknowledgement boundary: a lost acknowledgement must never trigger blind replay. */
import type { StandardSchemaV1 } from '@arki/schema';
import type { JobTriggerFailure } from './errors.ts';
import type { QueueJobId } from './job-id.ts';
export type JobTriggerResult = QueueJobId | JobTriggerFailure;
/** Validate caller input, then pass its original wire representation to the persisted boundary. */
export declare function triggerValidated<Input>(schema: StandardSchemaV1<unknown, Input>, data: unknown, key: string | undefined, send: (key: QueueJobId) => Promise<string | undefined>, jobName?: string): Promise<JobTriggerResult>;
//# sourceMappingURL=trigger.d.ts.map