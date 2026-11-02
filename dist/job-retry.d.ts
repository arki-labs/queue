/**
 * Job retries: a job's `retry` is a `Backoff` from `@arki/resilience`. BullMQ cannot
 * store a function in Redis, so every job asks for BullMQ's custom backoff, and the
 * job's worker answers it from the `Backoff`.
 *
 * A handler that returns a failure from `@arki/failure` fails its job. BullMQ fails only
 * a job that throws, so the worker throws a `ReturnedFailureError` carrying the failure,
 * and the backoff judges the failure itself: by default it is not retried.
 */
import type { BackoffOptions } from 'bullmq';
import type { Failure } from '@arki/failure';
import type { Backoff } from '@arki/resilience';
/** The retry of a job that sets none: 2 retries (3 tries in all), 1 s and then 2 s apart. */
export declare const defaultJobRetry: Backoff;
/** BullMQ's `attempts`: every try, the first one included. A backoff without a limit gets the largest safe count. */
export declare function jobAttempts(retry: Backoff): number;
/** The job option that sends every retry to the worker's `backoffStrategy`. */
export declare const customJobBackoff: BackoffOptions;
/** Only public fields cross persisted/provider boundaries; private causes stay in process. */
export declare function jobFailureEnvelope<F extends Failure>(failure: F): {
    code: string;
    status: number;
    message: string;
    data: unknown;
    remediation?: string | undefined;
};
/**
 * A job whose handler returned a failure. The message is the failure as JSON, so BullMQ's
 * `failedReason`, the board and the foreman keep its code, message, status and data.
 */
export declare class ReturnedFailureError<F extends Failure = Failure> extends Error {
    readonly failure: F;
    constructor(failure: F);
}
/** Throws a `ReturnedFailureError` when a handler's result is a failure, so its job fails. */
export declare function throwIfReturnedFailure(result: unknown): void;
/**
 * The worker's `backoffStrategy`. BullMQ passes the number of failed tries, which is the
 * number of the retry about to run; `-1` tells it to stop and fail the job. A returned
 * failure reaches the backoff as the failure; an error the handler threw reaches it as that error.
 */
export declare function workerBackoffStrategy(retry: Backoff): (attemptsMade: number, type?: string, error?: Error) => number;
/** Records that `failure` reports `error`, which the handler threw. Returns `failure`. */
export declare function markThrown<F extends Failure>(failure: F, error: unknown): F;
/**
 * What a job's `Backoff` should judge for a failed try. A returned failure is judged as the
 * failure, so it is retried only when `backoff(...).while(...)` accepts it. An error the
 * handler threw is judged as the error, so it follows the retry policy as in `@arki/resilience`.
 * Accepts the failure itself or the error that carries it.
 *
 * @example backoff.exponential({ base: 100 }).upTo(2).delay(1, retryReason(outcome))
 */
export declare function retryReason(outcomeOrError: unknown): unknown;
//# sourceMappingURL=job-retry.d.ts.map