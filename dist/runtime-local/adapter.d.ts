/**
 * PGlite adapter for pg-boss.
 *
 * pg-boss's bootstrap SQL is a single ~200-line multi-statement DDL block.
 * PGlite's `.query()` uses the Extended Query Protocol (one statement only),
 * but its multi-statement runner uses the Simple Query Protocol (no params).
 *
 * seveibar's workaround (github.com/timgit/pg-boss/issues/563): route ALL
 * queries through the multi-statement runner by substituting $1, $2, …
 * placeholders with escaped SQL literals.
 *
 * Trade-offs accepted by callers:
 * - SQL-injection by design (literal substitution). Safe for single-user
 *   trusted-enqueue; never expose boss.send() to untrusted callers.
 * - Date values are stringified to ISO-8601; callers must rehydrate.
 * - Raw BigInt must be .toString()-encoded before boss.send().
 */
import type { PGlite } from '@electric-sql/pglite';
import type { Db } from 'pg-boss';
export declare function buildPgBossAdapter(pglite: Pick<PGlite, 'exec'>): Db;
//# sourceMappingURL=adapter.d.ts.map