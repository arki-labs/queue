import { getLogger } from '@arki/log';
import { observeQueue } from '../debug.js';
import { executeJob } from '../job-outcome.js';
import { defaultJobRetry, retryReason } from '../job-retry.js';
import { isOutboxError, OUTBOX_ERROR_CODES, outboxError } from './errors.js';
import { jobsByName } from './registry.js';
const debugOutbox = getLogger('arki:queue:outbox');
/** What a handler sees as `ctx.job`: the row's id and stored args. Progress and logs go to debug output. */
function jobLikeOf(job) {
    return {
        id: job.id,
        name: job.name,
        data: job.args,
        attemptsMade: job.attempt - 1,
        updateProgress: progress => {
            observeQueue(() => debugOutbox.debug('[{job}] {jobId} progress {progress}', { job: job.name, jobId: job.id, progress }));
            return Promise.resolve();
        },
        log: message => {
            observeQueue(() => debugOutbox.debug('[{job}] {jobId} {message}', { job: job.name, jobId: job.id, message }));
            return Promise.resolve();
        },
    };
}
export function outboxRunner(options) {
    const byName = jobsByName(options.registry);
    // A job's feature services: those of the first top-level branch that lists it, as on the BullMQ lane
    const servicesByName = new Map();
    for (const [key, branch] of Object.entries(options.registry)) {
        const services = options.services?.[key];
        if (services === undefined)
            continue;
        for (const name of jobsByName({ [key]: branch }).keys())
            if (!servicesByName.has(name))
                servicesByName.set(name, services);
    }
    let context;
    const contextOnce = () => {
        context ??= Promise.resolve()
            .then(() => options.context())
            .catch((error) => {
            context = undefined;
            throw error;
        });
        return context;
    };
    return {
        names: [...byName.keys()],
        async run(job, ctx) {
            const definition = byName.get(job.name);
            // A guard: the worker claims only names this runner lists.
            if (definition === undefined)
                throw outboxError(OUTBOX_ERROR_CODES.unknownJob, `outbox: no job named "${job.name}" in the registry`);
            const internal = definition._internal;
            return executeJob(internal, jobLikeOf(job), contextOnce, servicesByName.get(job.name), ctx.signal);
        },
        retention: job => byName.get(job.name)?._internal.options?.retention,
        retryDelay(job, error) {
            // Stored args that fail the schema fail every time: dead at once, no handler ran.
            if (isOutboxError(error) && error.code === OUTBOX_ERROR_CODES.badStoredArgs)
                return;
            const retry = byName.get(job.name)?._internal.options?.retry ?? defaultJobRetry;
            return retry.delay(job.attempt, retryReason(error));
        },
    };
}
//# sourceMappingURL=runner.js.map