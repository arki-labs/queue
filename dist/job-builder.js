import { debugBuilder, observeQueue } from './debug.js';
import { withEnqueueSpan } from './enqueue-span.js';
import { QUEUE_DEFINITION_ERROR_CODES, QueueDefinitionError } from './errors.js';
import { jobRetryOptions } from './job-options.js';
import { defaultJobRetry, jobAttempts } from './job-retry.js';
import { jobTraceOptions } from './job-trace.js';
import { QueueUnavailable } from './errors.js';
import { triggerValidated } from './trigger.js';
/** The characters both BullMQ and pg-boss accept in a queue name; a job name is its queue name. */
const JOB_NAME_PATTERN = /^[\w\-./]+$/;
/**
 * Create a job builder
 * @internal
 */
export function createJobBuilder(params) {
    observeQueue(() => debugBuilder.debug('Creating job builder with {middlewaresLength} middleware', {
        middlewaresLength: params.middlewares.length,
    }));
    function use(middleware) {
        observeQueue(() => debugBuilder.debug('Adding middleware to job builder (total: {total})', {
            total: params.middlewares.length + 1,
        }));
        return createJobBuilder({
            config: params.config,
            // Erasure seam (as before): the overloads proved the middleware fits this builder's context;
            // the chain runs on `unknown` contexts.
            middlewares: [...params.middlewares, middleware],
        });
    }
    return {
        use,
        name(name) {
            observeQueue(() => debugBuilder.debug('Setting job name: {name}', { name }));
            if (!JOB_NAME_PATTERN.test(name)) {
                throw new QueueDefinitionError({
                    code: QUEUE_DEFINITION_ERROR_CODES.invalidJobName,
                    message: `Job name "${name}" has characters a queue name cannot hold. Use only letters, digits, "_", "-", "." and "/".`,
                    remediation: 'A job name is its queue name. Write it like q.job.name("feature.action"); ":" is not allowed.',
                });
            }
            // One runtime object serves both typestates: the JobBuilderNeedsInput
            // type hides `.handler()` until `.input()` runs; the throw below backs it up.
            return createJobBuilderChain({
                config: params.config,
                middlewares: params.middlewares,
                name,
            });
        },
    };
}
/**
 * Create a job builder chain (after name is set)
 * @internal
 */
function createJobBuilderChain(state) {
    return {
        input(schema) {
            observeQueue(() => debugBuilder.debug('[{value1}] Setting input schema', { value1: state.name ?? 'unnamed' }));
            return createJobBuilderChain({
                ...state,
                inputSchema: schema,
                options: undefined, // Reset options when input type changes
            });
        },
        options(options) {
            observeQueue(() => debugBuilder.debug('[{value1}] Setting job options (retry attempts: {attempts}, maxParallelism: {maxParallelism})', {
                value1: state.name ?? 'unnamed',
                attempts: jobAttempts(options.retry ?? defaultJobRetry),
                maxParallelism: options.maxParallelism ?? 5,
            }));
            return createJobBuilderChain({
                ...state,
                options: options,
            });
        },
        handler(handler) {
            if (!state.name) {
                throw new QueueDefinitionError({
                    code: QUEUE_DEFINITION_ERROR_CODES.missingName,
                    message: 'Job name is required. Call .name() first.',
                    remediation: 'Start the job with q.job.name("feature.action") before .handler().',
                });
            }
            if (!state.inputSchema) {
                throw new QueueDefinitionError({
                    code: QUEUE_DEFINITION_ERROR_CODES.missingInput,
                    message: 'Input schema is required. Call .input() before .handler().',
                    remediation: 'Add .input(schema) before .handler(); use z.object({}) for a job that takes no data.',
                });
            }
            observeQueue(() => debugBuilder.debug('[{stateName}] Creating job definition with {middlewaresLength} middleware', {
                stateName: state.name,
                middlewaresLength: state.middlewares.length,
            }));
            const jobName = state.name;
            const definition = {
                _type: 'job',
                _internal: {
                    name: jobName,
                    inputSchema: state.inputSchema,
                    handler,
                    options: state.options,
                    // Middleware array stored for runtime execution
                    middlewares: state.middlewares,
                },
                trigger: (data, options) => triggerJob(definition._internal, data, options),
            };
            return definition;
        },
    };
}
/**
 * A job's `trigger()`: add to the queue `register()` stored on the definition. A renamed copy
 * of a job (a feature instance's, `send-mail#eu`) triggers through its own queue the same way.
 * @internal
 */
export async function triggerJob(internal, data, options) {
    if (internal._trigger !== undefined)
        return internal._trigger(data, options);
    const jobName = internal.name;
    const queue = internal._queue;
    if (!queue) {
        return withEnqueueSpan(() => QueueUnavailable(), jobName);
    }
    observeQueue(() => debugBuilder.debug('[{jobName}] Triggering job with options: {options}', () => ({
        jobName,
        options: JSON.stringify(options),
    })));
    return triggerValidated(internal.inputSchema, data, options?.bullmqOptions?.jobId ?? options?.jobId, async (key) => {
        const job = await queue.add(jobName, data, {
            ...jobTraceOptions(),
            priority: options?.priority,
            delay: options?.delay,
            ...options?.bullmqOptions,
            jobId: key,
            ...jobRetryOptions(internal.options),
        });
        observeQueue(() => debugBuilder.debug('[{jobName}] Job triggered with ID: {ID}', { jobName, ID: job.id }));
        return job.id;
    }, jobName);
}
//# sourceMappingURL=job-builder.js.map