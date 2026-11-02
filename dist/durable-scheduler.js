/**
 * BullMQ backend for `@arki/schedule` durable schedules.
 *
 * `@arki/schedule` owns the canonical port imported here. The integration in
 * `packages/queue/src/schedule-port.test.ts` wires `durableScheduler()` into
 * `schedule({ durable })` and checks that both packages share that contract.
 */
import { Queue, Worker } from 'bullmq';
import { getLogger } from '@arki/log';
import { debugSchedule, observeQueue } from './debug.js';
import { ReturnedFailureError } from './job-retry.js';
import { parseRedisConnection } from './redis-connection.js';
const log = getLogger('arki:queue:durable-scheduler');
// Completed and failed tick jobs kept for inspection; older ones are trimmed
// so a frequent cron does not grow Redis without bound.
const KEEP_FINISHED_JOBS = 100;
function queueNameFor(scheduleName) {
    return `schedule.${scheduleName}`;
}
function repeatFor(schedule) {
    if ('cron' in schedule) {
        return schedule.timezone === undefined
            ? { pattern: schedule.cron }
            : { pattern: schedule.cron, tz: schedule.timezone };
    }
    return { every: schedule.everyMs };
}
/**
 * Register the job scheduler unless Redis already holds the same one.
 * Upserting an unchanged scheduler would delete its pending job, and with it
 * the tick that fell due while no worker ran; leaving it keeps that tick.
 */
async function ensureScheduler(queue, schedule) {
    const repeat = repeatFor(schedule);
    const existing = await queue.getJobScheduler(schedule.name);
    const unchanged = existing !== undefined &&
        ('pattern' in repeat
            ? existing.pattern === repeat.pattern && existing.tz === repeat.tz
            : existing.every === repeat.every);
    if (unchanged) {
        observeQueue(() => debugSchedule.debug('[{scheduleName}] Durable scheduler unchanged, keeping its pending tick', {
            scheduleName: schedule.name,
        }));
        return;
    }
    observeQueue(() => debugSchedule.debug('[{scheduleName}] Upserting durable scheduler', { scheduleName: schedule.name }));
    await queue.upsertJobScheduler(schedule.name, repeat, {
        name: schedule.name,
        data: {},
        opts: { removeOnComplete: KEEP_FINISHED_JOBS, removeOnFail: KEEP_FINISHED_JOBS },
    });
}
/**
 * Create the BullMQ-backed durable scheduler. Inert until `start`: no Redis
 * connection is opened when it is created.
 *
 * Each schedule gets its own BullMQ queue (`schedule.<name>`) holding one job
 * scheduler, and one worker with concurrency 1 in this process. BullMQ hands
 * each tick's job to exactly one worker, so a tick runs once across replicas.
 */
export function createDurableScheduler(options) {
    const prefix = options.keyPrefix ?? 'queue:';
    let queues = [];
    let workers = [];
    async function startOne(schedule) {
        const connection = parseRedisConnection(options.connection);
        const name = queueNameFor(schedule.name);
        const queue = new Queue(name, { connection, prefix });
        queues.push(queue);
        const worker = new Worker(name, async (job) => {
            observeQueue(() => debugSchedule.debug('[{scheduleName}] Durable tick {jobId} started', {
                scheduleName: schedule.name,
                jobId: job.id,
            }));
            const result = await schedule.run();
            if (result.status === 'refused')
                throw new ReturnedFailureError(result.failure);
            if (result.status === 'handler-failed' || result.status === 'lock-failed')
                throw new ReturnedFailureError(result.cause);
            return result;
        }, { connection, prefix, autorun: false, concurrency: 1 });
        workers.push(worker);
        await ensureScheduler(queue, schedule);
        void worker.run().catch((error) => {
            observeQueue(() => log.error('durable schedule worker stopped unexpectedly', {
                schedule: schedule.name,
                error: error instanceof Error ? error.message : String(error),
            }));
        });
        await worker.waitUntilReady();
    }
    return {
        async start(schedules) {
            for (const schedule of schedules) {
                await startOne(schedule);
            }
        },
        async stop() {
            const closingWorkers = workers;
            const closingQueues = queues;
            workers = [];
            queues = [];
            // Workers first: close() waits for an active tick to finish.
            await Promise.all(closingWorkers.map(worker => worker.close()));
            await Promise.all(closingQueues.map(queue => queue.close()));
        },
    };
}
//# sourceMappingURL=durable-scheduler.js.map