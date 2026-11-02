/**
 * The producer side of a queue: enqueue jobs without running any worker.
 *
 * A job's own `trigger()` only works once a worker registered it in the same
 * process. An API server that enqueues work for a separate worker process
 * needs this client instead. It opens one BullMQ queue per job name, on first
 * use, with the same options the worker uses for that job's queue. Flows go
 * through one BullMQ `FlowProducer`, also opened on first use.
 */
import { FlowProducer, Queue } from 'bullmq';
import { jobQueueOptions } from './create-queue.js';
import { debugJob, observeQueue } from './debug.js';
import { addFlow } from './flow-jobs.js';
import { jobRetryOptions } from './job-options.js';
import { jobTraceOptions } from './job-trace.js';
import { parseRedisConnection } from './redis-connection.js';
import { triggerValidated } from './trigger.js';
const DEFAULT_KEY_PREFIX = 'queue:';
export function createQueueClient(options) {
    const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    const queues = new Map();
    const queueFor = (name, jobOptions) => {
        const existing = queues.get(name);
        if (existing !== undefined)
            return existing;
        const queue = new Queue(name, jobQueueOptions(jobOptions, options.connection, keyPrefix));
        queues.set(name, queue);
        return queue;
    };
    let flowProducer;
    async function enqueue(target, data, triggerOptions) {
        if (target._type === 'flow') {
            return addFlow(() => (flowProducer ??= new FlowProducer({
                connection: parseRedisConnection(options.connection),
                prefix: keyPrefix,
            })), target, data);
        }
        const name = target._internal.name;
        return triggerValidated(target._internal.inputSchema, data, triggerOptions?.bullmqOptions?.jobId ?? triggerOptions?.jobId, async (key) => {
            const queue = queueFor(name, target._internal.options);
            const added = await queue.add(name, data, {
                ...jobTraceOptions(),
                priority: triggerOptions?.priority,
                delay: triggerOptions?.delay,
                ...triggerOptions?.bullmqOptions,
                jobId: key,
                ...jobRetryOptions(target._internal.options),
            });
            observeQueue(() => debugJob.debug('[{jobName}] Enqueued job {jobId}', { jobName: name, jobId: added.id ?? '' }));
            return added.id;
        }, name);
    }
    const client = {
        connection: options.connection,
        keyPrefix,
        enqueue,
    };
    return {
        client,
        async close() {
            const open = [...queues.values()];
            const openFlowProducer = flowProducer;
            queues.clear();
            flowProducer = undefined;
            await Promise.all([...open.map(queue => queue.close()), openFlowProducer?.close()]);
        },
    };
}
//# sourceMappingURL=queue-client.js.map