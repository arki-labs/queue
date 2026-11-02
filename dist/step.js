/**
 * `step` and `around` for jobs: plain functions adapted into the job middleware shape.
 *
 *   q.job.use(step(actorFromData)).use(around(inTransaction)).name('refund').input(schema).handler(...)
 *
 * The same function attaches to the other transports with their own `step` and `around`.
 */
import { isFailure } from '@arki/failure';
// Erasure seam: `SuccessOf` of a generic `R` does not narrow under `isFailure`, so
// the body is written against `object` and the overload above carries the types.
export function step(fn) {
    return {
        _type: 'middleware',
        _adapter: 'step',
        _fn: async (opts) => {
            const value = await fn(opts.ctx);
            if (isFailure(value))
                return value;
            return opts.next({ ctx: { ...opts.ctx, ...value } });
        },
    };
}
/**
 * Wrap a job: `q.job.use(around(inTransaction))`.
 *
 * An around is a plain function that runs `next` inside whatever it sets up
 * (a transaction, a span, a lock) and returns what `next` returns. It wraps
 * everything declared after it: later steps and the handler.
 *
 * A refusal (a later step's) or a failure the handler returns is the value `next`
 * resolves to: no throw, so nothing rolls back by itself. An around that cares
 * checks the result with `isFailure`. A handler that throws still rejects
 * `next`. Either way the failure stays the job's outcome.
 */
export function around(fn) {
    return {
        _type: 'middleware',
        _adapter: 'around',
        _fn: async (opts) => {
            const result = await fn(opts.ctx, async () => {
                const inner = await opts.next();
                return isFailure(inner.output) ? inner.output : inner;
            });
            return isFailure(result) ? { ctx: opts.ctx, output: result } : result;
        },
    };
}
//# sourceMappingURL=step.js.map