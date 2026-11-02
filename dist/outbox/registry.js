/**
 * The registry walk: a nested record of job, schedule and flow definitions, flattened the way
 * `queue.register()` and `jobs(...)` read it. `dot.ts` and the outbox runner share it.
 */
import { is, recordSchema } from '@arki/schema';
import { outboxError, OUTBOX_ERROR_CODES } from './errors.js';
export function isJobDefinition(value) {
    if (!is(value, recordSchema) || value['_type'] !== 'job')
        return false;
    const internal = value['_internal'];
    return is(internal, recordSchema) && typeof internal['name'] === 'string';
}
export function isScheduleDefinition(value) {
    return is(value, recordSchema) && value['_type'] === 'schedule';
}
export function isFlowDefinition(value) {
    return is(value, recordSchema) && value['_type'] === 'flow';
}
export function collectQueueDefinitions(registry, definitions = []) {
    for (const value of Object.values(registry)) {
        if (isJobDefinition(value) || isScheduleDefinition(value) || isFlowDefinition(value)) {
            definitions.push(value);
            continue;
        }
        if (is(value, recordSchema)) {
            collectQueueDefinitions(value, definitions);
        }
    }
    return definitions;
}
/**
 * The registry's jobs by persisted name. Two definitions under one name throw `OUTBOX_E007`:
 * a stored row finds its job by name alone. The same definition listed twice is one job.
 */
export function jobsByName(registry) {
    const byName = new Map();
    for (const definition of collectQueueDefinitions(registry)) {
        if (!isJobDefinition(definition))
            continue;
        const name = definition._internal.name;
        const known = byName.get(name);
        if (known !== undefined && known !== definition)
            throw outboxError(OUTBOX_ERROR_CODES.duplicateName, `outbox: two jobs in the registry are named "${name}"`);
        byName.set(name, definition);
    }
    return byName;
}
//# sourceMappingURL=registry.js.map