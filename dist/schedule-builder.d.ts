/**
 * Schedule builder implementation
 * Provides chainable API for creating scheduled jobs
 *
 * ## Schedule Types
 *
 * - **CRON**: Recurring schedule based on cron pattern (e.g., '0 0 * * *' for daily at midnight)
 * - **INTERVAL**: Recurring schedule at fixed intervals (e.g., every 60000ms)
 * - **TIMEOUT**: One-time execution after a delay (e.g., run once after 60000ms)
 *
 * ## Usage Patterns
 *
 * A schedule is a trigger, not a runner. It can either:
 * 1. Wrap an existing job: `q.schedule.cron('0 0 * * *').job(existingJob).data({ ... })`.
 *    Each tick adds the data to the job's own queue, the same as `existingJob.trigger(data)`;
 *    the job's worker runs it with the job's own middleware, retries and concurrency.
 * 2. Define inline: `q.schedule.interval(60000).name('my-schedule').input(schema).handler(fn)`.
 *    This is an anonymous job named after the schedule; `.use()` before `.name()` is its middleware.
 *
 * @example
 * ```typescript
 * // CRON: Daily report at midnight
 * const dailyReport = q.schedule
 *   .cron('0 0 * * *', { timezone: 'America/New_York' })
 *   .job(generateReportJob)
 *   .data({ reportType: 'daily' });
 *
 * // INTERVAL: Health check every 30 seconds (repeating)
 * const healthCheck = q.schedule
 *   .interval(30000)
 *   .job(pingServiceJob)
 *   .data({});
 *
 * // TIMEOUT: Send reminder email once after 24 hours
 * const reminderEmail = q.schedule
 *   .timeout(24 * 60 * 60 * 1000)
 *   .job(sendReminderJob)
 *   .data({ userId: 'usr_123' });
 *
 * // Inline handler
 * const customSchedule = q.schedule
 *   .interval(60000)
 *   .name('custom-task')
 *   .input(z.object({ value: z.number() }))
 *   .handler(async (data, ctx) => {
 *     console.log('Running custom task with value:', data.value);
 *   });
 * ```
 */
import type { ScheduleBuilderDef } from './types/builder.ts';
import type { JobDefinition } from './types/job.ts';
import type { JobMiddleware } from './types/middleware.ts';
import type { QueueConfig, QueueMeta } from './types/queue.ts';
/**
 * Schedule type
 */
type ScheduleType = 'cron' | 'interval' | 'timeout';
/**
 * Internal schedule definition structure
 * This is what gets stored in ScheduleDefinition._internal
 *
 * A schedule is a trigger: on each tick it adds `data` to `job`'s own queue,
 * and the job's worker runs it. The builder stores the job as
 * `AnyJobDefinition`; the queue reads `_internal` back with the default
 * `TJob`, the same erasure boundary flow steps use.
 */
export type InternalScheduleDefinition<TJob = JobDefinition<unknown, unknown, unknown>> = {
    /**
     * Type of schedule (cron, interval or timeout)
     */
    type: ScheduleType;
    /**
     * Schedule value (cron pattern, or interval/delay in ms)
     */
    value: string | number;
    /**
     * Schedule options (timezone for cron)
     */
    options?: {
        timezone?: string;
    };
    /**
     * Schedule name (the job scheduler id on the job's queue)
     */
    name: string;
    /**
     * The job each tick adds to: the wrapped job, or for an inline schedule an
     * anonymous job named after the schedule, whose middleware is the schedule's `.use()` chain
     */
    job: TJob;
    /**
     * Whether `job` is the inline schedule's own anonymous job (only this package writes to its queue)
     */
    inline: boolean;
    /**
     * The data each tick adds (`{}` for an inline schedule)
     */
    data: unknown;
    /**
     * Queue configuration
     */
    config: QueueConfig;
};
/**
 * Create a schedule builder
 * @internal
 */
export declare function createScheduleBuilder<TContext, TContextOut, TMeta extends QueueMeta>(scheduleType: ScheduleType, scheduleValue: string | number, scheduleOptions: {
    timezone?: string;
} | undefined, config: QueueConfig, middlewares: readonly JobMiddleware<unknown, unknown, QueueMeta>[]): ScheduleBuilderDef<TContext, TContextOut, TMeta>;
export {};
//# sourceMappingURL=schedule-builder.d.ts.map