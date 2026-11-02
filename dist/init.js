/**
 * Queue initialization - inspired by tRPC's initTRPC pattern
 *
 * @example
 * ```typescript
 * // 1. Create context
 * const createContext = () => ({
 *   db: database,
 *   repo: repositories,
 *   kv: kvStore,
 * });
 *
 * // 2. Initialize queue
 * const q = initQueue
 *   .context<typeof createContext>()
 *   .create({
 *     transformer: superjson,
 *   });
 *
 * // 3. Create job builders with middleware
 * const baseJob = q.job.use(errorHandling).use(logging);
 * const authJob = baseJob.use(authMiddleware);
 * ```
 */
import superjson from 'superjson';
import { createQueueInstance } from './create-queue.js';
import { CronPatterns } from './cron-patterns.js';
import { debugBuilder, observeQueue } from './debug.js';
import { createFlowBuilder } from './flow-builder.js';
import { createJobBuilder } from './job-builder.js';
import { createScheduleBuilder } from './schedule-builder.js';
/**
 * Initialize queue system
 * This is the entry point, similar to tRPC's initTRPC
 */
export const initQueue = {
    /**
     * Configure context type for the queue
     */
    context() {
        return {
            /**
             * Configure metadata type for the queue
             */
            meta() {
                return {
                    /**
                     * Create the queue builder with configuration
                     */
                    create(config) {
                        const fullConfig = {
                            transformer: config?.transformer ?? superjson,
                            errorFormatter: config?.errorFormatter ?? (error => error),
                            // Read on use, not here: `create()` runs when the queue module is
                            // imported, and importing a declaration must not read the environment.
                            get isDev() {
                                return config?.isDev ?? process.env['NODE_ENV'] === 'development';
                            },
                        };
                        return createQueueBuilder(fullConfig);
                    },
                };
            },
            /**
             * Create the queue builder without metadata
             */
            create(config) {
                return this.meta().create(config);
            },
        };
    },
    /**
     * Create the queue builder without context or metadata
     */
    create(config) {
        return this.context().create(config);
    },
};
/**
 * Create the queue builder implementation
 * @internal
 */
function createQueueBuilder(config) {
    observeQueue(() => debugBuilder.debug('Creating queue builder'));
    // Create base job builder with empty middleware
    // Output context is JobContext<TContext> because runtime wraps user context with framework utilities
    const baseJobBuilder = createJobBuilder({
        config,
        middlewares: [],
    });
    function middlewareFactory(fn) {
        observeQueue(() => debugBuilder.debug('Creating middleware'));
        return { _type: 'middleware', _fn: fn };
    }
    // Registry factory (simple pass-through for now)
    const registryFactory = (jobs) => {
        observeQueue(() => debugBuilder.debug('Creating registry with {value1} jobs', { value1: Object.keys(jobs).length }));
        return jobs;
    };
    // Schedule builder factory
    const scheduleBuilderFactory = {
        // Core Schedule Types
        cron: (pattern, options) => createScheduleBuilder('cron', pattern, options, config, []),
        interval: milliseconds => createScheduleBuilder('interval', milliseconds, undefined, config, []),
        timeout: milliseconds => createScheduleBuilder('timeout', milliseconds, undefined, config, []),
        // Time-Based Helpers
        everySeconds: n => createScheduleBuilder('cron', CronPatterns.everySeconds(n), undefined, config, []),
        everyMinutes: n => createScheduleBuilder('cron', CronPatterns.everyMinutes(n), undefined, config, []),
        everyHours: n => createScheduleBuilder('cron', CronPatterns.everyHours(n), undefined, config, []),
        // Daily Schedules
        daily: (time, options) => createScheduleBuilder('cron', CronPatterns.daily(time), options, config, []),
        weekdays: (time, options) => createScheduleBuilder('cron', CronPatterns.weekdays(time), options, config, []),
        weekends: (time, options) => createScheduleBuilder('cron', CronPatterns.weekends(time), options, config, []),
        // Weekly/Monthly Schedules
        weekly: (day, time, options) => createScheduleBuilder('cron', CronPatterns.weekly(day, time), options, config, []),
        monthly: (day, time, options) => createScheduleBuilder('cron', CronPatterns.monthly(day, time), options, config, []),
    };
    // Flow builder factory
    const flowBuilderFactory = {
        name: (name) => createFlowBuilder(name, config),
    };
    return {
        _config: config,
        job: baseJobBuilder,
        middleware: middlewareFactory,
        registry: registryFactory,
        schedule: scheduleBuilderFactory,
        flow: flowBuilderFactory,
        createQueue: (options) => {
            return createQueueInstance(options);
        },
    };
}
//# sourceMappingURL=init.js.map