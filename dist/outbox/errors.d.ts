/**
 * Outbox errors: plain `Error`s with a stable `code` and a `remediation`. Every one is an
 * app bug (a wrong call, a bad stored row), so none is a typed client error.
 */
export declare const OUTBOX_ERROR_CODES: {
    /**
     * An outbox write was attempted outside the business transaction.
     * @fix Call runAfter or runAt inside db.transaction and pass the business transaction handle.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly notInTransaction: 'OUTBOX_E001';
    /**
     * The outbox arguments do not satisfy the job input schema.
     * @fix Pass args accepted by the job input schema; inspect the private schema issues.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly badArgs: 'OUTBOX_E002';
    /**
     * The outbox delay, scheduled time or priority is invalid.
     * @fix Use a non-negative safe-integer delay, a valid runAt Date and a supported QUEUE_PRIORITIES value.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly badTiming: 'OUTBOX_E004';
    /**
     * Stored outbox arguments do not satisfy the registered job input schema.
     * @fix Repair the stored args or restore the matching job schema before retrying the dead row; version job names when inputs change.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly badStoredArgs: 'OUTBOX_E005';
    /**
     * An outbox row names a job absent from the runner registry.
     * @fix Register the job in the registry used to construct the outbox runner.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly unknownJob: 'OUTBOX_E006';
    /**
     * Two jobs in the outbox registry use the same name.
     * @fix Give each job in the outbox registry a unique name.
     * @verify bun run test -- src/outbox/outbox.spec.ts
     */
    readonly duplicateName: 'OUTBOX_E007';
};
export type OutboxErrorCode = (typeof OUTBOX_ERROR_CODES)[keyof typeof OUTBOX_ERROR_CODES];
export type OutboxError = Error & {
    readonly code: OutboxErrorCode;
    readonly remediation: string;
};
/** An outbox error with its code's remediation. `cause` keeps what went wrong underneath (e.g. the Zod error). */
export declare function outboxError(code: OutboxErrorCode, message: string, cause?: unknown): OutboxError;
export declare function isOutboxError(error: unknown): error is OutboxError;
//# sourceMappingURL=errors.d.ts.map