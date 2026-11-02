import type { RedisOptions } from 'bullmq';
export type QueueConnection = string | (RedisOptions & {
    host: string;
    port: number;
});
/** Parse Redis URLs without dropping authentication, TLS, or database selection. */
export declare function parseRedisConnection(connection: QueueConnection): RedisOptions;
//# sourceMappingURL=redis-connection.d.ts.map