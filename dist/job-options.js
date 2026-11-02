/**
 * The default BullMQ job options of one job: what its queue applies to every
 * job it adds. A flow adds jobs through a `FlowProducer`, which never reads
 * queue defaults, so flow steps merge these into each step's own options.
 */
import { customJobBackoff, defaultJobRetry, jobAttempts } from './job-retry.js';
export function jobDefaultOptions(options) {
    return {
        ...options?.bullmqOptions,
        ...jobRetryOptions(options),
    };
}
/** The shared retry contract owns these keys even when plain JavaScript passes native overrides. */
export function jobRetryOptions(options) {
    return {
        attempts: jobAttempts(options?.retry ?? defaultJobRetry),
        backoff: customJobBackoff,
    };
}
//# sourceMappingURL=job-options.js.map