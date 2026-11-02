import type { Queue } from 'bullmq';
import { HonoAdapter } from '@bull-board/hono';
/**
 * Create a Bull Board UI for monitoring queues
 *
 * This is a utility for setting up Bull Board monitoring UI for BullMQ queues.
 * In v2.0, you'll need to access the internal BullMQ Queue instances from the
 * queue infrastructure layer (server/workers) where they are created.
 *
 * @example With Hono
 * ```typescript
 * import { Hono } from 'hono';
 * import { createBoard } from '@arki/queue';
 * import { Queue } from 'bullmq';
 *
 * const app = new Hono();
 *
 * // Create or import your BullMQ Queue instances
 * const emailQueue = new Queue('notifications:send-email', { connection });
 * const orderQueue = new Queue('orders:process', { connection });
 *
 * // Create board with your queues
 * const { adapter } = createBoard({
 *   queues: [emailQueue, orderQueue],
 *   basePath: '/admin/queues',
 * });
 *
 * // Mount the board
 * app.route('/admin/queues', adapter.registerPlugin());
 *
 * export default app;
 * ```
 *
 * @example Direct Board Access
 * ```typescript
 * import { Queue } from 'bullmq';
 *
 * const myQueue = new Queue('my-queue', { connection });
 *
 * const { board, adapter } = createBoard({
 *   queues: [myQueue],
 * });
 *
 * // Add queues dynamically
 * const anotherQueue = new Queue('another-queue', { connection });
 * board.addQueue(new BullMQAdapter(anotherQueue));
 *
 * // Remove queues
 * board.removeQueue('queue-name');
 * ```
 */
export declare function createBoard(options: {
    /**
     * Array of BullMQ Queue instances to monitor
     */
    queues: (Queue | undefined)[];
    /**
     * Base path for the UI (default: '/admin/queues')
     */
    basePath?: string;
    /**
     * Custom UI options
     */
    uiOptions?: {
        /**
         * Board title (default: 'Bull Board')
         */
        boardTitle?: string;
        /**
         * Custom logo URL
         */
        boardLogo?: string;
        /**
         * Misc UI options
         */
        miscLinks?: {
            text: string;
            url: string;
        }[];
    };
}): {
    /**
     * The Bull Board instance
     */
    board: {
        setQueues: (newBullQueues: ReadonlyArray<import("@bull-board/api/baseAdapter").BaseAdapter>) => void;
        replaceQueues: (newBullQueues: ReadonlyArray<import("@bull-board/api/baseAdapter").BaseAdapter>) => void;
        addQueue: (queue: import("@bull-board/api/baseAdapter").BaseAdapter) => void;
        removeQueue: (queueOrName: string | import("@bull-board/api/baseAdapter").BaseAdapter) => void;
    };
    /**
     * The Hono adapter (use with app.route())
     */
    adapter: HonoAdapter;
    /**
     * Add a queue to the board dynamically
     */
    addQueue: (queue: Queue) => void;
    /**
     * Remove a queue from the board
     */
    removeQueue: (queueName: string) => void;
};
/**
 * Create Bull Board adapters for different frameworks
 */
export { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
export { HonoAdapter } from '@bull-board/hono';
//# sourceMappingURL=create-board.d.ts.map