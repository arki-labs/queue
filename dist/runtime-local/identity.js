/** pg-boss requires a UUID; external job keys stay opaque and are scoped to the job queue. */
import { v5 } from 'uuid';
export function pgBossJobId(name, key) {
    return v5(JSON.stringify([name, key]), v5.URL);
}
//# sourceMappingURL=identity.js.map