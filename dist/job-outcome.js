import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { Cancelled, Deadline } from '@arki/async';
import { InvalidInput, isAsyncSchemaFailure, isFailure, UnexpectedDefect, UnexpectedFailure, ValidatorDefect, } from '@arki/failure';
import { parseAsync } from '@arki/schema';
import { markThrown } from './job-retry.js';
import { extractJobTrace } from './job-trace.js';
import { createJobContext, executeMiddlewareChain, withFeatureServices } from './middleware.js';
export const JOB_SYSTEM_FAILURES = [Cancelled, Deadline, UnexpectedDefect];
/** Telemetry must never change a delivery's business outcome. */
function observe(run) {
    try {
        run();
    }
    catch {
        /* App-owned telemetry is best effort. */
    }
}
async function withJobSpan(job, run, metadata) {
    let span;
    const parent = extractJobTrace(metadata);
    observe(() => {
        span = trace.getTracer('@arki/queue').startSpan('queue.execute', {
            attributes: { 'messaging.destination.name': job.name, 'queue.attempt': job.attemptsMade + 1 },
        }, parent);
    });
    let execution;
    const executeOnce = async () => {
        try {
            const result = await run();
            if (isFailure(result))
                observe(() => {
                    span?.setAttribute('failure.code', result.code);
                    span?.setStatus({ code: SpanStatusCode.ERROR, message: result.code });
                });
            return result;
        }
        finally {
            observe(() => {
                span?.end();
            });
        }
    };
    const execute = () => (execution ??= executeOnce());
    if (span === undefined)
        return execute();
    try {
        return await context.with(trace.setSpan(parent ?? context.active(), span), execute);
    }
    catch {
        return execute();
    }
}
/**
 * Preserve the handler's exact success/refusal union; add only canonical execution failures.
 * A deadline aborts the owned signal, then waits for cooperative settlement before retry is possible.
 */
export function executeJob(internal, job, createContext, services, signal, traceMetadata) {
    return withJobSpan(job, async () => {
        const controller = new AbortController();
        let interrupted;
        const cancel = () => {
            interrupted ??= Cancelled({ cause: signal?.reason });
            controller.abort(interrupted);
        };
        if (signal?.aborted)
            cancel();
        signal?.addEventListener('abort', cancel, { once: true });
        let timer;
        try {
            if (interrupted !== undefined)
                return interrupted;
            const timeout = internal.options?.timeoutMs;
            if (timeout !== undefined) {
                if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2_147_483_647)
                    return InvalidInput({ issues: [{ message: 'timeoutMs must be a finite duration from 0 to 2147483647.' }] });
                timer = setTimeout(() => {
                    interrupted ??= Deadline();
                    controller.abort(interrupted);
                }, timeout);
            }
            const parsed = await parseAsync(internal.inputSchema, job.data);
            if (isAsyncSchemaFailure(parsed))
                return parsed;
            const base = withFeatureServices(await createContext(), services);
            if (interrupted !== undefined)
                return interrupted;
            const jobContext = createJobContext(base, job, controller.signal);
            let completed;
            const middlewareOutput = await executeMiddlewareChain(internal.middlewares, jobContext, parsed, job, {}, async (ctx) => {
                const value = await internal.handler(parsed, ctx);
                completed = { value };
                return value;
            });
            if (isFailure(middlewareOutput))
                return interrupted ?? middlewareOutput;
            return (interrupted ??
                (completed === undefined
                    ? UnexpectedDefect({ cause: new Error('Job middleware did not invoke its handler.') })
                    : completed.value));
        }
        catch (error) {
            if (interrupted !== undefined)
                return interrupted;
            // Legacy middleware speaks the worker exception protocol. Normalize only known system failures.
            if (error instanceof UnexpectedFailure) {
                const failure = error.failure;
                if (InvalidInput.is(failure) || ValidatorDefect.is(failure) || Cancelled.is(failure) || Deadline.is(failure))
                    return failure;
            }
            return markThrown(UnexpectedDefect({ cause: error }), error);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        }
    }, traceMetadata);
}
//# sourceMappingURL=job-outcome.js.map