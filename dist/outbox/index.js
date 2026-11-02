/**
 * `@arki/queue/outbox`: transactional scheduling. `outbox({ tables }).runAfter(tx, job, args)`
 * writes a job row in the caller's transaction; the journal worker runs it with `outboxRunner`.
 * Exactly-once enqueue, at-least-once execution. Portable: no BullMQ, Redis or pg-boss at runtime.
 */
export { outbox } from './outbox.js';
export { outboxRunner } from './runner.js';
export { isOutboxError, OUTBOX_ERROR_CODES } from './errors.js';
//# sourceMappingURL=index.js.map