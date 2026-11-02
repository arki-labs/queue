import { QUEUE_ACTION_META_SCHEMA } from './action-meta.js';
function queueNameFor(action) {
    if (action.binding !== 'queue')
        return null;
    if (action.metaSchema !== QUEUE_ACTION_META_SCHEMA)
        return null;
    const queue = action.meta?.['queue'];
    return typeof queue === 'string' ? queue : (action.address ?? null);
}
export function project(manifest) {
    const queues = new Map();
    for (const action of manifest.actions) {
        const queueName = queueNameFor(action);
        if (queueName === null)
            continue;
        const entry = queues.get(queueName) ?? { name: queueName, consumers: [], producers: [] };
        if (action.direction === 'in') {
            entry.consumers.push({ id: action.id, plugin: action.plugin });
        }
        else {
            entry.producers.push({ id: action.id, plugin: action.plugin });
        }
        queues.set(queueName, entry);
    }
    return {
        format: 'queue-topology',
        queues: [...queues.values()],
    };
}
//# sourceMappingURL=projection.js.map