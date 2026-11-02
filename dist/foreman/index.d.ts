/**
 * The Foreman admin module for queues.
 *
 * The Foreman control-plane module for queues: a paged `failedJobs` read and a `retryJob` action.
 * Requires the optional peer `@arki/admin`. The normal `@arki/queue` entry never imports it.
 */
import { z } from 'zod';
import type { FailedJobSource } from './source.ts';
export { QUEUE_FOREMAN_ERROR_CODES, type QueueForemanErrorCode } from './errors.ts';
export { bullmqFailedJobSource, type BullMQFailedJobSourceOptions } from './bullmq-source.ts';
export { pgBossFailedJobSource, type PgBossFailedJobSourceOptions } from './pg-boss-source.ts';
export type { FailedJobRecord, FailedJobSource } from './source.ts';
export declare const failedJobSchema: z.ZodObject<{
    id: z.ZodString;
    queue: z.ZodString;
    name: z.ZodString;
    key: z.ZodOptional<z.ZodString>;
    attempts: z.ZodNumber;
    error: z.ZodNullable<z.ZodString>;
    failedAt: z.ZodISODateTime;
}, z.core.$strict>;
export type QueueForemanOptions = {
    /** The queues Foreman may see, by a stable key. Each key is one queue instance's failed-job source. */
    queues: Readonly<Record<string, FailedJobSource>>;
};
export declare function queueForemanModule(options: QueueForemanOptions): import("@arki/admin/module").ForemanModule<Record<string, never>, {
    failedJobs: import("@arki/admin/module").Read<z.ZodObject<{
        queue: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        jobs: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            queue: z.ZodString;
            name: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
            attempts: z.ZodNumber;
            error: z.ZodNullable<z.ZodString>;
            failedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        total: z.ZodNumber;
        nextOffset: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strict>, Record<string, never>>;
}, {
    retryJob: import("@arki/admin/module").Action<z.ZodObject<{
        queue: z.ZodString;
        jobId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        queue: z.ZodString;
        jobId: z.ZodString;
        name: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
        attempts: z.ZodNumber;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        requeued: z.ZodLiteral<true>;
        jobId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [], {
        requeued: true;
        jobId: string;
    }>;
}>;
export { redactSecrets } from '@arki/admin/module';
//# sourceMappingURL=index.d.ts.map