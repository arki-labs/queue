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
import { debugBuilder, observeQueue } from './debug.js';
import { QUEUE_DEFINITION_ERROR_CODES, QueueDefinitionError } from './errors.js';
import { createJobBuilder } from './job-builder.js';
/**
 * Create a schedule builder
 * @internal
 */
export function createScheduleBuilder(scheduleType, scheduleValue, scheduleOptions, config, middlewares) {
    observeQueue(() => debugBuilder.debug('Creating schedule builder (type: {type}, value: {value}, middleware: {middleware})', {
        type: scheduleType,
        value: scheduleValue,
        middleware: middlewares.length,
    }));
    const state = {
        config,
        middlewares,
        scheduleType,
        scheduleValue,
        scheduleOptions,
    };
    return {
        use(middleware) {
            observeQueue(() => debugBuilder.debug('Adding middleware to schedule (total: {total})', { total: middlewares.length + 1 }));
            // One runtime object serves both typestates: the ScheduleBuilderWithMiddleware
            // type hides `.job()` after `.use()`; the throw in scheduleJob() backs it up.
            return createScheduleBuilder(scheduleType, scheduleValue, scheduleOptions, config, [...middlewares, middleware]);
        },
        job(job) {
            return scheduleJob(state, job);
        },
        name(name) {
            observeQueue(() => debugBuilder.debug('Setting schedule name: {name}', { name }));
            // One runtime object serves every named typestate: ScheduleBuilderNamed
            // offers `.job()` and `.input()`, ScheduleBuilderNeedsInput hides `.job()`
            // after `.use()`, and both hide `.handler()` until `.input()` runs; the
            // throws below back them up.
            return createScheduleBuilderChain({
                ...state,
                name,
            });
        },
    };
}
/**
 * Wrap an existing job: each tick adds `data` to the job's own queue.
 * @internal
 */
function scheduleJob(state, job) {
    if (state.middlewares.length > 0) {
        throw new QueueDefinitionError({
            code: QUEUE_DEFINITION_ERROR_CODES.scheduleMiddlewareWithJob,
            message: `A schedule that wraps a job has no middleware of its own. Remove .use() before .job(${job._internal.name}).`,
            remediation: 'Add the middleware to the job instead (q.job.use(mw)...); its worker runs it on every scheduled run.',
        });
    }
    observeQueue(() => debugBuilder.debug('Wrapping existing job: {job}', { job: job._internal.name }));
    return {
        data(data) {
            // Generate name from job if not explicitly set
            const scheduleName = state.name ?? `${job._internal.name}-schedule`;
            observeQueue(() => debugBuilder.debug('[{scheduleName}] Creating schedule definition (type: {type}, triggers: {triggers})', {
                scheduleName,
                type: state.scheduleType,
                triggers: job._internal.name,
            }));
            const internal = {
                type: state.scheduleType,
                value: state.scheduleValue,
                options: state.scheduleOptions,
                name: scheduleName,
                job,
                inline: false,
                data,
                config: state.config,
            };
            return {
                _type: 'schedule',
                _internal: internal,
            };
        },
    };
}
/**
 * Create a schedule builder chain (after name is set)
 * @internal
 */
function createScheduleBuilderChain(state) {
    return {
        job(job) {
            return scheduleJob(state, job);
        },
        input(schema) {
            observeQueue(() => debugBuilder.debug('[{value1}] Setting input schema for schedule', { value1: state.name ?? 'unnamed' }));
            return createScheduleBuilderChain({
                ...state,
                inputSchema: schema,
            });
        },
        handler(handler) {
            if (!state.name) {
                throw new QueueDefinitionError({
                    code: QUEUE_DEFINITION_ERROR_CODES.missingName,
                    message: 'Schedule name is required. Call .name() first.',
                    remediation: 'Call .name("feature:task") on the schedule before .handler().',
                });
            }
            if (!state.inputSchema) {
                throw new QueueDefinitionError({
                    code: QUEUE_DEFINITION_ERROR_CODES.missingInput,
                    message: 'Input schema is required. Call .input() before .handler().',
                    remediation: 'Add .input(schema) before .handler(); use z.object({}) for a schedule that takes no data.',
                });
            }
            observeQueue(() => debugBuilder.debug('[{stateName}] Creating inline schedule definition (type: {type}, value: {value}, middleware: {middleware})', {
                stateName: state.name,
                type: state.scheduleType,
                value: state.scheduleValue,
                middleware: state.middlewares.length,
            }));
            // An inline schedule is an anonymous job named after the schedule: its
            // `.use()` chain is that job's middleware, and it runs on the job path.
            const job = createJobBuilder({
                config: state.config,
                middlewares: state.middlewares,
            })
                .name(state.name)
                .input(state.inputSchema)
                .handler(handler);
            const internal = {
                type: state.scheduleType,
                value: state.scheduleValue,
                options: state.scheduleOptions,
                name: state.name,
                job,
                inline: true,
                data: {},
                config: state.config,
            };
            return {
                _type: 'schedule',
                _internal: internal,
            };
        },
    };
}
//# sourceMappingURL=schedule-builder.js.map