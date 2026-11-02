import { entrypoint, handlerObserverOf, instanceOf, sliceOf } from '@arki/dot/feature';
import { DotUnitError, infra, service } from '@arki/dot/unit';
import { is, recordSchema } from '@arki/schema';
import { z } from 'zod';
import { QUEUE_ACTION_META_SCHEMA } from './action-meta.js';
import { debugWorker, observeQueue } from './debug.js';
import { createDurableScheduler } from './durable-scheduler.js';
import { triggerJob } from './job-builder.js';
import { outbox } from './outbox/outbox.js';
import { collectQueueDefinitions, isFlowDefinition, isJobDefinition, isScheduleDefinition } from './outbox/registry.js';
import { outboxRunner } from './outbox/runner.js';
import { QueueWorkerStartFailed } from './errors.js';
import { createQueueClient } from './queue-client.js';
export { QUEUE_ACTION_META_SCHEMA } from './action-meta.js';
export const QUEUE_PLUGIN_ERROR_CODES = {
    /**
     * The queue worker did not finish startup within the configured timeout.
     * @fix Check Redis connectivity and worker context creation; raise startupTimeoutMs only when startup legitimately needs longer.
     * @verify bun run test -- src/dot.spec.ts
     */
    startupTimeout: 'ARKI_QUEUE_E001',
    /**
     * The queue worker was started while already running.
     * @fix Start the app once, or stop the queue worker before starting it again.
     * @verify bun run test -- src/dot.spec.ts
     */
    doubleStart: 'ARKI_QUEUE_E002',
    /**
     * The queue worker was stopped before successful startup.
     * @fix Stop only after successful startup or let the Dot lifecycle manage shutdown.
     * @verify bun run test -- src/dot.spec.ts
     */
    stopBeforeStart: 'ARKI_QUEUE_E003',
    /**
     * Queue worker startup has no mounted queue client.
     * @fix Mount queue({ connection }) before feature registration and queueWorker startup.
     * @verify bun run test -- src/dot.spec.ts
     */
    clientMissing: 'ARKI_QUEUE_E019',
};
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
function retryMeta(options) {
    const retry = options?.retry;
    if (retry === undefined)
        return undefined;
    return { attempts: Number.isFinite(retry.maxRetries) ? retry.maxRetries + 1 : 'unlimited' };
}
function actionForJob(job, direction) {
    const name = job._internal.name;
    const options = job._internal.options;
    const meta = {
        kind: 'job',
        queue: name,
        ...(options?.maxParallelism === undefined ? {} : { maxParallelism: options.maxParallelism }),
        ...(retryMeta(options) === undefined ? {} : { retry: retryMeta(options) }),
    };
    return {
        id: `${name}.${direction === 'in' ? 'consume' : 'produce'}`,
        binding: 'queue',
        direction,
        address: name,
        metaSchema: QUEUE_ACTION_META_SCHEMA,
        meta,
    };
}
function actionForSchedule(schedule) {
    const internal = schedule._internal;
    // A schedule adds to its job's own queue; it has no queue of its own.
    const queue = internal.job._internal.name;
    const meta = {
        kind: 'schedule',
        scheduleType: internal.type,
        queue,
        value: typeof internal.value === 'number' ? internal.value : internal.value,
        ...(internal.options?.timezone === undefined ? {} : { timezone: internal.options.timezone }),
    };
    return {
        id: `${internal.name}.fire`,
        binding: 'queue',
        direction: 'in',
        address: queue,
        metaSchema: QUEUE_ACTION_META_SCHEMA,
        meta,
    };
}
function actionForFlow(flow, direction) {
    const internal = flow._internal;
    const meta = {
        kind: 'flow',
        queue: internal.name,
        steps: internal.steps.length,
    };
    return {
        id: `${internal.name}.${direction === 'in' ? 'consume' : 'produce'}`,
        binding: 'queue',
        direction,
        address: internal.name,
        metaSchema: QUEUE_ACTION_META_SCHEMA,
        meta,
    };
}
export function queueConsumerActions(registry) {
    return collectQueueDefinitions(registry).flatMap(definition => {
        if (isJobDefinition(definition))
            return [actionForJob(definition, 'in')];
        if (isScheduleDefinition(definition))
            return [actionForSchedule(definition)];
        return [actionForFlow(definition, 'in')];
    });
}
export function queueProducerActions(registry) {
    return collectQueueDefinitions(registry).flatMap(definition => {
        if (isJobDefinition(definition))
            return [actionForJob(definition, 'out')];
        if (isFlowDefinition(definition))
            return [actionForFlow(definition, 'out')];
        return [];
    });
}
export function queueActions(registry) {
    return [...queueConsumerActions(registry), ...queueProducerActions(registry)];
}
/** A feature's services as its jobs see them: the kernel's `$` keys ($app, $unit, …) belong to the unit. */
function jobServicesOf(services) {
    if (typeof services !== 'object' || services === null)
        return {};
    return Object.fromEntries(Object.entries(services).filter(([key]) => !key.startsWith('$')));
}
/**
 * Declare a feature's jobs: `defineFeature('orders')….entrypoints(jobs(orderJobs))`.
 * Each mounted copy of the feature runs them with its own services ({@link FeatureJobContext}).
 */
export function jobs(registry) {
    return {
        kind: 'queue',
        key: 'queue',
        actions: [],
        actionsOf: feature => queueProducerActions(featureRegistry(feature, registry)),
        registry,
        resolve: services => {
            const observer = handlerObserverOf(typeof services === 'object' && services !== null ? services : {});
            return { registry: observedRegistry(registry, observer), services: jobServicesOf(services) };
        },
    };
}
/**
 * The outermost job middleware of a feature's job: the handler call (steps, arounds and the handler
 * inside it) runs in the app's handler observer. What the chain returns decides the event: a step's
 * refusal or a Failure the handler returns is `completed/refused`, a throw is `failed` and is
 * rethrown unchanged, so the queue's retries see exactly what they saw before.
 */
function observingMiddleware(name, observer) {
    return {
        _type: 'middleware',
        _fn: async ({ ctx, next }) => {
            const result = await observer.run({ transport: 'job', name }, async () => {
                const settled = await next();
                return settled.output;
            });
            return { ctx, output: result };
        },
    };
}
/** A job with the observing middleware in front. The copy is its own definition; the original is never changed. */
function observedJob(job, observer) {
    const { name, inputSchema, handler, options, middlewares } = job._internal;
    const copy = {
        _type: 'job',
        _internal: {
            name,
            inputSchema,
            handler,
            middlewares: [observingMiddleware(name, observer), ...middlewares],
            ...(options === undefined ? {} : { options }),
        },
        trigger: (data, triggerOptions) => triggerJob(copy._internal, data, triggerOptions),
    };
    return copy;
}
function isQueueRegistry(value) {
    return is(value, recordSchema);
}
/** What a feature's `queue` slice record must hold: the jobs it publishes and the services they run with. */
const featureJobsShapeSchema = z.looseObject({ registry: z.record(z.string(), z.unknown()), services: z.record(z.string(), z.unknown()) });
function isFeatureJobs(value) {
    return is(value, featureJobsShapeSchema);
}
function isJobsSlice(slice) {
    return slice.key === 'queue' && 'registry' in slice && isQueueRegistry(slice.registry);
}
/**
 * How a feature (or one of its units, `reports#eu/job-producers`) names its jobs: an instance
 * appends its instance (`send-mail#eu`), so two copies get two queues. A plain feature's names
 * never change (`undefined`): live queues, scheduler ids and stored outbox rows keep resolving.
 */
function jobNamingOf(owner) {
    const instance = instanceOf(owner);
    return instance === undefined ? undefined : name => `${name}#${instance}`;
}
/** A job under another name. Registering it sets the copy's own `_queue`/`_worker`, never the original's. */
function renamedJob(job, name) {
    const { inputSchema, handler, options, middlewares } = job._internal;
    const copy = {
        _type: 'job',
        _internal: { name, inputSchema, handler, middlewares, ...(options === undefined ? {} : { options }) },
        trigger: (data, triggerOptions) => triggerJob(copy._internal, data, triggerOptions),
    };
    return copy;
}
/**
 * A feature instance's registry: every job, schedule and flow renamed by `rename`. Each job is
 * copied once, so a schedule or flow step points at the same copy the registry lists.
 */
function renamedRegistry(registry, rename) {
    return copiedRegistry(registry, rename, (job, name) => renamedJob(job, name));
}
function observedRegistry(registry, observer) {
    return copiedRegistry(registry, name => name, job => observedJob(job, observer));
}
/** Copy a registry with every job replaced by `copyJob(job, rename(job name))`, once per job, so schedules and flows share the copy. */
function copiedRegistry(registry, rename, copyJob) {
    const copies = new Map();
    const jobCopy = (job) => {
        const known = copies.get(job);
        if (known !== undefined)
            return known;
        const copy = copyJob(job, rename(job._internal.name));
        copies.set(job, copy);
        return copy;
    };
    const copyOf = (value) => {
        if (isJobDefinition(value))
            return jobCopy(value);
        if (isScheduleDefinition(value)) {
            const internal = value._internal;
            const renamed = {
                ...internal,
                name: rename(internal.name),
                job: jobCopy(internal.job),
            };
            return { ...value, _internal: renamed };
        }
        if (isFlowDefinition(value)) {
            const internal = value._internal;
            const renamed = {
                ...internal,
                name: rename(internal.name),
                steps: internal.steps.map(step => ({ ...step, job: jobCopy(step.job) })),
            };
            return { ...value, _internal: renamed };
        }
        if (isQueueRegistry(value))
            return walk(value);
        return value;
    };
    const walk = (node) => Object.fromEntries(Object.entries(node).map(([key, value]) => [key, copyOf(value)]));
    return walk(registry);
}
/** The registry a mounted feature runs: its own for a plain feature, renamed copies for an instance. */
function featureRegistry(featureName, registry) {
    const naming = jobNamingOf(featureName);
    return naming === undefined ? registry : renamedRegistry(registry, naming);
}
/** The jobs every feature declared, keyed by feature name — known before boot, for the manifest. */
function declaredRegistry(features) {
    const registry = {};
    for (const f of features) {
        const slice = f.entrypoints.find(candidate => isJobsSlice(candidate));
        if (slice !== undefined)
            registry[f.name] = featureRegistry(f.name, slice.registry);
    }
    return registry;
}
/** The jobs every booted feature published, read from its slice record, and the services each feature's jobs run with. */
function bootedJobs(ctx, features) {
    const registry = {};
    const services = {};
    for (const f of features) {
        const slice = sliceOf(ctx, f)['queue'];
        if (isFeatureJobs(slice)) {
            registry[f.name] = featureRegistry(f.name, slice.registry);
            services[f.name] = slice.services;
            continue;
        }
        observeQueue(() => debugWorker.debug('[{value1}] Feature "{featureName}" did not contribute a queue slice.', {
            value1: 'queue-worker',
            featureName: f.name,
        }));
    }
    return { registry, services };
}
function queuePluginError(args) {
    return new DotUnitError({
        code: args.code,
        message: args.message,
        remediation: args.remediation,
        docsUrl: `https://arki.dev/queue/errors/${args.docsSlug}`,
    });
}
function timeoutAfter(ms, pluginName) {
    return new Promise((_resolve, reject) => {
        const timer = setTimeout(() => {
            reject(queuePluginError({
                code: QUEUE_PLUGIN_ERROR_CODES.startupTimeout,
                message: `[queue] worker "${pluginName}" startup timed out after ${String(ms)}ms.`,
                remediation: 'Check Redis connectivity and the worker context factory, or raise startupTimeoutMs if the worker intentionally needs more time.',
                docsSlug: 'arki-queue-e001',
            }));
        }, ms);
        timer.unref();
    });
}
/**
 * Wire key of `@arki/schedule`'s `DurableSchedules` token. Kept as a plain
 * string so `@arki/queue` does not depend on `@arki/schedule`; the app
 * builder checks that the provided service fits what `schedule()` needs.
 */
export const DURABLE_SCHEDULES_KEY = 'arki.schedule.durable';
export function durableScheduler(options) {
    return createDurableSchedulerPlugin(options.name ?? 'durable-scheduler', options);
}
function createDurableSchedulerPlugin(name, options) {
    return infra({
        name,
        configure(ctx) {
            ctx.declareProvides('durable-scheduler');
        },
        provides: { [DURABLE_SCHEDULES_KEY]: () => createDurableScheduler(options) },
        // The schedule plugin stops the backend first; stop() is idempotent, so
        // this only matters when nothing else stopped it.
        async stop(ctx) {
            await ctx[DURABLE_SCHEDULES_KEY].stop();
        },
        async dispose(ctx) {
            await ctx[DURABLE_SCHEDULES_KEY].stop();
        },
    });
}
export function queue(options) {
    return createQueuePlugin(options.name ?? 'queue', options);
}
function createQueuePlugin(name, options) {
    let handle;
    return infra({
        name,
        configure(ctx) {
            ctx.registerProjection({
                format: 'queue-topology',
                binding: 'queue',
                module: '@arki/queue/projection',
            });
            ctx.declareProvides('queue-client');
        },
        provides: {
            queue: () => {
                handle = createQueueClient(options);
                return handle.client;
            },
        },
        async stop() {
            await handle?.close();
        },
        async dispose() {
            await handle?.close();
        },
    });
}
/** What makes a value a queue client: an `enqueue` function, a key prefix and a connection. */
const queueClientShapeSchema = z.looseObject({
    enqueue: z.instanceof(Function),
    keyPrefix: z.string(),
    connection: z.unknown().refine(connection => connection !== undefined),
});
function isQueueClient(value) {
    return is(value, queueClientShapeSchema);
}
/**
 * The `queue` client from a worker hook's context. The builder guard already
 * proves it is there; this reads it without a cast (the hook context is a
 * mapped type over the caller's generic needs, which TS cannot index).
 */
function queueClientOf(ctx, pluginName) {
    const value = 'queue' in ctx ? ctx.queue : undefined;
    if (isQueueClient(value))
        return value;
    throw queuePluginError({
        code: QUEUE_PLUGIN_ERROR_CODES.clientMissing,
        message: `[queue] worker "${pluginName}" found no queue client under "queue".`,
        remediation: 'Mount queue({ connection }) with .infra(...) before .features(...) and .entrypoints(queueWorker(...)).',
        docsSlug: 'arki-queue-e019',
    });
}
/**
 * Run the jobs of every feature the app mounted. Mount it with `.entrypoints()`:
 * it is bound to the app's features (each `jobs(...)` slice), uses the
 * `queue` client's connection and key prefix, and owns the consumer side of
 * the manifest (`<job>.consume`, `<schedule>.fire`).
 */
export function queueWorker(options) {
    const pluginName = options.name ?? 'queue-worker';
    const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    const blocking = options.blocking ?? false;
    const needs = { ...options.needs, queue: service() };
    const runStartup = async (ctx) => {
        const start = async () => {
            const client = queueClientOf(ctx, pluginName);
            const { registry, services } = bootedJobs(ctx, ctx.$features);
            const resolvedContext = await options.context(ctx);
            const instance = options.q.createQueue({
                connection: client.connection,
                keyPrefix: client.keyPrefix,
                createContext: () => resolvedContext,
            });
            await instance.register(registry, { services });
            await instance.start();
            return instance;
        };
        const runtime = await Promise.race([start(), timeoutAfter(startupTimeoutMs, pluginName)]);
        ctx.$state.handle = runtime;
        return runtime;
    };
    return entrypoint.fromFeatures({
        name: pluginName,
        needs,
        state: () => ({ started: false, handle: undefined, startup: undefined, startupFailure: undefined }),
        actions: features => queueConsumerActions(declaredRegistry(features)),
        configure(ctx) {
            ctx.declareProvides('queue-worker');
        },
        async start(ctx) {
            const state = ctx.$state;
            if (state.started || state.startup !== undefined) {
                throw queuePluginError({
                    code: QUEUE_PLUGIN_ERROR_CODES.doubleStart,
                    message: `[queue] worker "${pluginName}" was started twice.`,
                    remediation: 'Call app.start() once, or call app.stop() before starting the queue worker again.',
                    docsSlug: 'arki-queue-e002',
                });
            }
            state.started = true;
            if (blocking) {
                state.startup = runStartup(ctx);
                try {
                    await state.startup;
                }
                catch (error) {
                    state.startup = undefined;
                    state.handle = undefined;
                    state.started = false;
                    throw error;
                }
                return;
            }
            // Background start: the app is already up, so the failure cannot fail `start`. It is logged at
            // error level and kept, and `stop()` returns it as `queue.worker_start_failed`.
            state.startup = runStartup(ctx).catch((error) => {
                state.startupFailure = QueueWorkerStartFailed({ cause: error });
                observeQueue(() => debugWorker.error('[{pluginName}] Queue worker startup failed: no jobs run', {
                    pluginName,
                    code: QueueWorkerStartFailed.code,
                    error: error instanceof Error ? error.message : String(error),
                }));
                state.started = false;
                state.handle = undefined;
            });
            return undefined;
        },
        async stop({ $state: state }) {
            if (!state.started && state.startup === undefined && state.handle === undefined) {
                throw queuePluginError({
                    code: QUEUE_PLUGIN_ERROR_CODES.stopBeforeStart,
                    message: `[queue] worker "${pluginName}" was stopped before it started.`,
                    remediation: 'Only call stop after a successful start, or let the DOT app lifecycle manage shutdown.',
                    docsSlug: 'arki-queue-e003',
                });
            }
            const runtime = state.handle ?? (await state.startup);
            const startupFailure = state.startupFailure;
            state.startup = undefined;
            state.startupFailure = undefined;
            state.handle = undefined;
            state.started = false;
            await runtime?.stop();
            return startupFailure;
        },
        async dispose({ $state: state }) {
            const runtime = state.handle ?? (await state.startup);
            state.startup = undefined;
            state.handle = undefined;
            state.started = false;
            await runtime?.stop();
            return undefined;
        },
    });
}
export function outboxPlugin(options) {
    return createOutboxPlugin(options.name ?? 'outbox', options);
}
function createOutboxPlugin(name, options) {
    return infra({
        name,
        configure(ctx) {
            ctx.declareProvides('outbox');
        },
        provides: { schedule: () => outbox(options) },
    });
}
/**
 * Run every mounted feature's `jobs(...)` slice from the journal's jobs table:
 * `.entrypoints(journalWorker({ listen, jobs: outboxJobs({ needs, context }) }))`. The same slice
 * feeds Redis workers (`queueWorker`) and this runner; the worker's manifest lists `<job>.consume`.
 */
export function outboxJobs(options) {
    return {
        needs: options.needs,
        actions: features => queueConsumerActions(declaredRegistry(features)),
        build: (features, services) => {
            const booted = bootedJobs(services, features);
            return outboxRunner({
                registry: booted.registry,
                services: booted.services,
                context: () => options.context(services),
            });
        },
    };
}
/**
 * One producer per job, each bound to the name the owning feature runs it under. `unit` is the
 * producing plugin's own name: inside an instance it is `reports#eu/job-producers`, so the
 * producer and the worker (`jobs(...)` of `reports#eu`) both derive `send-mail#eu` and cannot drift.
 */
function producersOf(jobsToProduce, unit, producerOf) {
    const naming = jobNamingOf(unit);
    const producers = {};
    for (const [key, job] of Object.entries(jobsToProduce)) {
        if (!isJobDefinition(job))
            continue;
        producers[key] = producerOf(naming === undefined ? job : renamedJob(job, naming(job._internal.name)));
    }
    return producers;
}
/**
 * A feature's producers on the Redis lane, as feature-private infra:
 * `defineFeature('reports').needs({ queue: queuePlugin.provides.queue }).infra(jobProducers({ sendMail }))`,
 * then `deps.jobs.sendMail.enqueue(data)` in a usecase. In an instance (`reports.instance('eu', …)`)
 * it enqueues to `send-mail#eu`, the queue that instance's `jobs(...)` runs; in a plain feature
 * to `send-mail`, exactly as `queue.enqueue(sendMail, data)`.
 */
export function jobProducers(jobsToProduce) {
    return infra({
        name: 'job-producers',
        needs: { queue: service() },
        provides: {
            jobs: ({ queue: client, $unit }) => 
            // Erasure seam: each producer takes its own job's input; `producersOf` walks them untyped.
            producersOf(jobsToProduce, $unit, job => ({
                enqueue: (data, options) => client.enqueue(job, data, options),
            })),
        },
    });
}
/**
 * A feature's producers on the outbox lane (`@arki/queue/outbox`), as feature-private infra:
 * `.needs({ schedule: scheduling.provides.schedule }).infra(outboxProducers({ sendMail }))`, then
 * `deps.jobs.sendMail.runAfter(tx, args)`. Rows carry the feature's name for the job (`send-mail#eu`
 * in an instance), which `outboxJobs()` resolves to that instance's job. A feature mounts one of
 * `jobProducers` and `outboxProducers`: both provide `jobs`.
 */
export function outboxProducers(jobsToProduce) {
    return infra({
        name: 'outbox-producers',
        needs: { schedule: service() },
        provides: {
            jobs: ({ schedule, $unit }) => 
            // Erasure seam: each producer takes its own job's input; `producersOf` walks them untyped.
            producersOf(jobsToProduce, $unit, job => ({
                runAfter: (tx, args, options) => schedule.runAfter(tx, job, args, options),
                runAt: (tx, args, at, options) => schedule.runAt(tx, job, args, at, options),
            })),
        },
    });
}
//# sourceMappingURL=dot.js.map