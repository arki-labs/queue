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
import type { QueueBuilder } from './types/builder.ts';
import type { QueueConfig, QueueMeta } from './types/queue.ts';
/**
 * Initialize queue system
 * This is the entry point, similar to tRPC's initTRPC
 */
export declare const initQueue: {
    /**
     * Configure context type for the queue
     */
    context<TContext>(): {
        /**
         * Configure metadata type for the queue
         */
        meta<TMeta extends QueueMeta>(): {
            /**
             * Create the queue builder with configuration
             */
            create(config?: Partial<QueueConfig>): QueueBuilder<TContext, TMeta>;
        };
        /**
         * Create the queue builder without metadata
         */
        create(config?: Partial<QueueConfig>): QueueBuilder<TContext, QueueMeta>;
    };
    /**
     * Create the queue builder without context or metadata
     */
    create<TContext = Record<string, never>>(config?: Partial<QueueConfig>): QueueBuilder<TContext, QueueMeta>;
};
//# sourceMappingURL=init.d.ts.map