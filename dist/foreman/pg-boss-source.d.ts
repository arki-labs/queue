import type { PGlite } from '@electric-sql/pglite';
import type { FailedJobSource } from './source.ts';
export type PgBossFailedJobSourceOptions = {
    pglite: PGlite;
    /** The pg-boss schema the queue instance runs in. Defaults to the runtime-local default. */
    schema?: string;
    /** Scope lookups and displayed ids to one job namespace, retaining its external stable keys. */
    name?: string;
};
/**
 * Failed jobs of a runtime-local queue (pg-boss on PGlite), read straight from the pg-boss job table.
 * Retry is one conditional UPDATE that mirrors pg-boss `retry()` (failed -> retry, one more attempt allowed)
 * but only fires while the row still has the revision the approval pinned. That makes a duplicate retry atomic.
 */
export declare function pgBossFailedJobSource(options: PgBossFailedJobSourceOptions): FailedJobSource;
//# sourceMappingURL=pg-boss-source.d.ts.map