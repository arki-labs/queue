/** pg-boss owns state transitions; this adapter supplies the exact Backoff decision. */
import type { PGlite } from '@electric-sql/pglite';
import type { JobAttempt, PgBoss } from 'pg-boss';
/**
 * Pinned pg-boss invariant: fail(JobAttempt, {db}) fences the active claim and preserves native
 * dependency/DLQ transitions. Policy, native fail, and millisecond start_after commit together.
 * Never adjust another claim, never throw a handler outcome back into the provider retry layer.
 */
export declare function settlePgBossFailure(pglite: PGlite, boss: PgBoss, schema: string, name: string, attempt: JobAttempt, output: object, delay?: number): Promise<void>;
//# sourceMappingURL=settle.d.ts.map