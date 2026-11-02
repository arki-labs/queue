/**
 * `@arki/queue` in a Dot app: the queue client, the worker, and the job slices. They split along the hexagon:
 *
 *   defineApp('shop')
 *     .infra(queue({ connection }))          // infra: the client features enqueue with
 *     .features([orders])                  // orders lists `jobs(orderJobs)` in `.entrypoints(...)`
 *     .entrypoints(queueWorker({ q, context }))  // entrypoint: runs the mounted features' jobs
 *
 * `queue()` provides the `queue` service. `queueWorker()` is bound to the
 * features the app mounted, so the app never lists them a second time.
 * `durableScheduler()` is the BullMQ backend `@arki/schedule` uses.
 * `outboxPlugin()` provides `schedule` (transactional scheduling, `@arki/queue/outbox`), and
 * `outboxJobs()` lets `journalWorker({ jobs })` run the same `jobs(...)` slices from Postgres.
 */
import type { EntrypointBinder } from '@arki/dot/feature';
import type { CtxOf, EmptyShape, NeedsShape, Service, WireNeeds } from '@arki/dot/unit';
import type { RootDb } from '@arki/journal';
import type { JobsSource } from '@arki/journal/dot';
import type { DurableSchedulerOptions } from './durable-scheduler.ts';
import type { Outbox, OutboxOptions, OutboxTx, ScheduleOptions } from './outbox/outbox.ts';
import type { QueueRegistry } from './outbox/registry.ts';
import type { QueueClient, QueueClientOptions } from './queue-client.ts';
import type { JobTriggerResult } from './trigger.ts';
import type { QueueBuilder } from './types/builder.ts';
import type { AnyJobDefinition, TriggerOptions } from './types/job.ts';
import type { QueueMeta } from './types/queue.ts';
import { QUEUE_ACTION_META_SCHEMA } from './action-meta.ts';
export { QUEUE_ACTION_META_SCHEMA } from './action-meta.ts';
export type { QueueClient, QueueClientOptions } from './queue-client.ts';
export declare const QUEUE_PLUGIN_ERROR_CODES: {
    /**
     * The queue worker did not finish startup within the configured timeout.
     * @fix Check Redis connectivity and worker context creation; raise startupTimeoutMs only when startup legitimately needs longer.
     * @verify bun run test -- src/dot.spec.ts
     */
    readonly startupTimeout: 'ARKI_QUEUE_E001';
    /**
     * The queue worker was started while already running.
     * @fix Start the app once, or stop the queue worker before starting it again.
     * @verify bun run test -- src/dot.spec.ts
     */
    readonly doubleStart: 'ARKI_QUEUE_E002';
    /**
     * The queue worker was stopped before successful startup.
     * @fix Stop only after successful startup or let the Dot lifecycle manage shutdown.
     * @verify bun run test -- src/dot.spec.ts
     */
    readonly stopBeforeStart: 'ARKI_QUEUE_E003';
    /**
     * Queue worker startup has no mounted queue client.
     * @fix Mount queue({ connection }) before feature registration and queueWorker startup.
     * @verify bun run test -- src/dot.spec.ts
     */
    readonly clientMissing: 'ARKI_QUEUE_E019';
};
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = {
    [key: string]: JsonValue;
};
type NoReservedKeys = Readonly<Record<`$${string}`, never>>;
export type QueueDotAction = {
    readonly id: string;
    readonly binding: 'queue';
    readonly direction: 'in' | 'out';
    readonly address: string;
    readonly summary?: string;
    readonly metaSchema: typeof QUEUE_ACTION_META_SCHEMA;
    readonly meta: JsonObject;
};
export type { QueueRegistry } from './outbox/registry.ts';
export declare function queueConsumerActions(registry: QueueRegistry): readonly QueueDotAction[];
export declare function queueProducerActions(registry: QueueRegistry): readonly QueueDotAction[];
export declare function queueActions(registry: QueueRegistry): readonly QueueDotAction[];
/**
 * What a job declared in a feature's `jobs(...)` runs with, on top of the worker's `context` and
 * the job: `services`, the services of the feature that registered it — its needs (an instance's
 * rebound ones), infra, children's provides and `usecases`, without the kernel's `$` keys. Type the
 * feature's jobs with it: `initQueue.context<WorkerContext & FeatureJobContext<Services>>().create()`.
 *
 * Both workers hand it over (`queueWorker`, `outboxJobs`). A job registered outside a feature
 * (`q.createQueue(...).register(...)`) runs without it. A job two plain features list is one job:
 * it runs once, with the services of the first.
 */
export type FeatureJobContext<TServices> = {
    readonly services: TServices;
};
/** The payload of a feature's `jobs(...)` slice once the feature booted: its jobs and its services. */
export type FeatureJobs<TRegistry extends QueueRegistry = QueueRegistry> = {
    readonly registry: TRegistry;
    /** What the feature's jobs see as `ctx.services` ({@link FeatureJobContext}). */
    readonly services: object;
};
/**
 * The slice a `jobs(...)` declaration produces. The registry and the feature's services land
 * under `queue` in the feature's slice record, where `queueWorker()` collects them.
 * The slice's manifest actions are the PRODUCER side only (the feature can
 * enqueue these jobs wherever it is mounted); the consumer side belongs to
 * the worker, which exists only in the process that runs the jobs.
 */
export type QueueFeatureSlice<TRegistry extends QueueRegistry> = {
    /** Lets a `defineFeature` feature list it in `.entrypoints(...)`. */
    readonly kind: 'queue';
    readonly key: 'queue';
    /** Empty: the producer ids need the feature's name, so they come from `actionsOf`. */
    readonly actions: readonly QueueDotAction[];
    /** The producer side, named after the feature: an instance's ids carry its instance (`send-mail#eu.produce`). */
    readonly actionsOf: (feature: string) => readonly QueueDotAction[];
    readonly registry: TRegistry;
    /** The registry it returns holds the same jobs, each wrapped to report to the handler observer. */
    readonly resolve: (services: unknown) => FeatureJobs<TRegistry>;
};
/**
 * Declare a feature's jobs: `defineFeature('orders')….entrypoints(jobs(orderJobs))`.
 * Each mounted copy of the feature runs them with its own services ({@link FeatureJobContext}).
 */
export declare function jobs<const TRegistry extends QueueRegistry>(registry: TRegistry): QueueFeatureSlice<TRegistry>;
/**
 * Wire key of `@arki/schedule`'s `DurableSchedules` token. Kept as a plain
 * string so `@arki/queue` does not depend on `@arki/schedule`; the app
 * builder checks that the provided service fits what `schedule()` needs.
 */
export declare const DURABLE_SCHEDULES_KEY = "arki.schedule.durable";
export type DurableSchedulerPluginOptions = DurableSchedulerOptions & {
    readonly name?: string;
};
/**
 * Provide the BullMQ durable backend for `@arki/schedule`. Mount it before
 * `schedule({ ..., durable: DurableSchedules })`. Its factory only builds
 * the backend; Redis is touched when the schedule plugin starts it.
 */
export declare function durableScheduler(options: DurableSchedulerOptions): ReturnType<typeof createDurableSchedulerPlugin<'durable-scheduler'>>;
export declare function durableScheduler<N extends string>(options: DurableSchedulerOptions & {
    readonly name: N;
}): ReturnType<typeof createDurableSchedulerPlugin<N>>;
declare function createDurableSchedulerPlugin<const Name extends string>(name: Name, options: DurableSchedulerOptions): Omit<import("@arki/dot/unit").Unit<WireNeeds<EmptyShape>, import("@arki/dot/unit").ProvidedValues<{
    "arki.schedule.durable": import("@arki/schedule/runtime").DurableScheduler;
}>, EmptyShape, Name, import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    "arki.schedule.durable": import("@arki/schedule/runtime").DurableScheduler;
}>> & {
    readonly factories: {
        readonly "arki.schedule.durable": (ctx: never) => import("@arki/schedule/runtime").DurableScheduler;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, import("@arki/dot/unit").DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<EmptyShape> & import("@arki/dot/unit").ProvidedValues<{
        "arki.schedule.durable": import("@arki/schedule/runtime").DurableScheduler;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
export type QueuePluginOptions = QueueClientOptions & {
    readonly name?: string;
};
/**
 * Provide the `queue` client features enqueue with. Mount it with `.infra()`,
 * before `.features()`. Its factory opens no connection: each job's BullMQ
 * queue opens on its first `enqueue`. Stop closes them.
 */
export declare function queue(options: QueueClientOptions): ReturnType<typeof createQueuePlugin<'queue'>>;
export declare function queue<N extends string>(options: QueueClientOptions & {
    readonly name: N;
}): ReturnType<typeof createQueuePlugin<N>>;
declare function createQueuePlugin<const Name extends string>(name: Name, options: QueueClientOptions): Omit<import("@arki/dot/unit").Unit<WireNeeds<EmptyShape>, import("@arki/dot/unit").ProvidedValues<{
    queue: QueueClient;
}>, EmptyShape, Name, import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    queue: QueueClient;
}>> & {
    readonly factories: {
        readonly queue: (ctx: never) => QueueClient;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, import("@arki/dot/unit").DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<EmptyShape> & import("@arki/dot/unit").ProvidedValues<{
        queue: QueueClient;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
/** What every worker needs on top of its own needs: the client it shares connection and prefix with. */
type WorkerShape<TNeeds extends NeedsShape> = TNeeds & {
    readonly queue: Service<QueueClient>;
};
export type QueueWorkerOptions<TNeeds extends NeedsShape & NoReservedKeys, TContext> = {
    readonly name?: string;
    /** Services the job context is built from, besides the `queue` client. Use `{}` for none. */
    readonly needs: TNeeds;
    readonly q: QueueBuilder<TContext, QueueMeta>;
    /**
     * Build the job context. Runs exactly ONCE, inside the guarded start: an
     * assembly failure (missing credentials) degrades boot like any other
     * startup failure instead of failing every job run, and an expensive
     * context graph is not rebuilt per execution. Per-run enrichment belongs
     * to job middleware.
     */
    readonly context: (services: CtxOf<WorkerShape<TNeeds>>) => TContext | Promise<TContext>;
    readonly startupTimeoutMs?: number;
    /** Wait for the workers in `app.start()`. Default: start in the background. */
    readonly blocking?: boolean;
};
/**
 * Run the jobs of every feature the app mounted. Mount it with `.entrypoints()`:
 * it is bound to the app's features (each `jobs(...)` slice), uses the
 * `queue` client's connection and key prefix, and owns the consumer side of
 * the manifest (`<job>.consume`, `<schedule>.fire`).
 */
export declare function queueWorker<TContext, TNeeds extends NeedsShape & NoReservedKeys>(options: QueueWorkerOptions<TNeeds, TContext>): EntrypointBinder<WireNeeds<WorkerShape<TNeeds>>, EmptyShape>;
export type OutboxPluginOptions = OutboxOptions & {
    readonly name?: string;
};
/**
 * Provide the `schedule` service (`@arki/queue/outbox`): `schedule.runAfter(tx, job, args)` writes
 * the job row in the caller's transaction. Opens nothing and needs nothing; mount it with `.infra()`
 * in every process that schedules, and run the rows with `journalWorker({ jobs: outboxJobs(...) })`.
 */
export declare function outboxPlugin(options: OutboxOptions): ReturnType<typeof createOutboxPlugin<'outbox'>>;
export declare function outboxPlugin<N extends string>(options: OutboxOptions & {
    readonly name: N;
}): ReturnType<typeof createOutboxPlugin<N>>;
declare function createOutboxPlugin<const Name extends string>(name: Name, options: OutboxOptions): Omit<import("@arki/dot/unit").Unit<WireNeeds<EmptyShape>, import("@arki/dot/unit").ProvidedValues<{
    schedule: Outbox;
}>, EmptyShape, Name, import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    schedule: Outbox;
}>> & {
    readonly factories: {
        readonly schedule: (ctx: never) => Outbox;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, import("@arki/dot/unit").DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<EmptyShape> & import("@arki/dot/unit").ProvidedValues<{
        schedule: Outbox;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
export type OutboxJobsOptions<TNeeds extends NeedsShape, TContext> = {
    /** Services the job context is built from, besides `db`. Use `{}` for none. Missing ones fail boot. */
    readonly needs: TNeeds;
    /** Build the job context. Runs once, on the first job, then cached (as `queueWorker`'s `context`). */
    readonly context: (services: CtxOf<TNeeds> & {
        readonly db: RootDb;
    }) => TContext | Promise<TContext>;
};
/**
 * Run every mounted feature's `jobs(...)` slice from the journal's jobs table:
 * `.entrypoints(journalWorker({ listen, jobs: outboxJobs({ needs, context }) }))`. The same slice
 * feeds Redis workers (`queueWorker`) and this runner; the worker's manifest lists `<job>.consume`.
 */
export declare function outboxJobs<TNeeds extends NeedsShape & NoReservedKeys, TContext>(options: OutboxJobsOptions<TNeeds, TContext>): JobsSource<TNeeds>;
/** The input type of a job definition, read from its `trigger`. */
type InputOf<TJob> = TJob extends {
    readonly trigger: (data: infer TInput, options?: TriggerOptions) => Promise<JobTriggerResult>;
} ? TInput : never;
/** A job's producer on the Redis lane: enqueue under the feature's name for it (`send-mail#eu` in an instance). */
export type JobProducer<TInput> = {
    enqueue(data: TInput, options?: TriggerOptions): Promise<JobTriggerResult>;
};
export type JobProducers<TJobs> = {
    readonly [K in keyof TJobs]: JobProducer<InputOf<TJobs[K]>>;
};
/** A job's producer on the outbox lane: a row in the caller's transaction, under the feature's name for it. */
export type OutboxProducer<TInput> = {
    runAfter(tx: OutboxTx, args: TInput, options?: ScheduleOptions): ReturnType<Outbox['runAfter']>;
    runAt(tx: OutboxTx, args: TInput, at: Date, options?: Omit<ScheduleOptions, 'delayMs'>): ReturnType<Outbox['runAt']>;
};
export type OutboxProducers<TJobs> = {
    readonly [K in keyof TJobs]: OutboxProducer<InputOf<TJobs[K]>>;
};
type JobsRecord = Readonly<Record<string, AnyJobDefinition>>;
/**
 * A feature's producers on the Redis lane, as feature-private infra:
 * `defineFeature('reports').needs({ queue: queuePlugin.provides.queue }).infra(jobProducers({ sendMail }))`,
 * then `deps.jobs.sendMail.enqueue(data)` in a usecase. In an instance (`reports.instance('eu', …)`)
 * it enqueues to `send-mail#eu`, the queue that instance's `jobs(...)` runs; in a plain feature
 * to `send-mail`, exactly as `queue.enqueue(sendMail, data)`.
 */
export declare function jobProducers<const TJobs extends JobsRecord>(jobsToProduce: TJobs): Omit<import("@arki/dot/unit").Unit<WireNeeds<{
    queue: Service<QueueClient>;
}>, import("@arki/dot/unit").ProvidedValues<{
    jobs: JobProducers<TJobs>;
}>, {
    queue: Service<QueueClient>;
}, "job-producers", import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    jobs: JobProducers<TJobs>;
}>> & {
    readonly factories: {
        readonly jobs: (ctx: never) => JobProducers<TJobs>;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, import("@arki/dot/unit").DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<{
        queue: Service<QueueClient>;
    }> & import("@arki/dot/unit").ProvidedValues<{
        jobs: JobProducers<TJobs>;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
/**
 * A feature's producers on the outbox lane (`@arki/queue/outbox`), as feature-private infra:
 * `.needs({ schedule: scheduling.provides.schedule }).infra(outboxProducers({ sendMail }))`, then
 * `deps.jobs.sendMail.runAfter(tx, args)`. Rows carry the feature's name for the job (`send-mail#eu`
 * in an instance), which `outboxJobs()` resolves to that instance's job. A feature mounts one of
 * `jobProducers` and `outboxProducers`: both provide `jobs`.
 */
export declare function outboxProducers<const TJobs extends JobsRecord>(jobsToProduce: TJobs): Omit<import("@arki/dot/unit").Unit<WireNeeds<{
    schedule: Service<Outbox>;
}>, import("@arki/dot/unit").ProvidedValues<{
    jobs: OutboxProducers<TJobs>;
}>, {
    schedule: Service<Outbox>;
}, "outbox-producers", import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    jobs: OutboxProducers<TJobs>;
}>> & {
    readonly factories: {
        readonly jobs: (ctx: never) => OutboxProducers<TJobs>;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, import("@arki/dot/unit").DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<{
        schedule: Service<Outbox>;
    }> & import("@arki/dot/unit").ProvidedValues<{
        jobs: OutboxProducers<TJobs>;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
//# sourceMappingURL=dot.d.ts.map