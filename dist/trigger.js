import { isAsyncSchemaFailure, isFailure } from '@arki/failure';
import { parseAsync } from '@arki/schema';
import { QueueAcceptanceUnknown } from './errors.js';
import { withEnqueueSpan } from './enqueue-span.js';
import { queueJobId } from './job-id.js';
/** Validate caller input, then pass its original wire representation to the persisted boundary. */
export async function triggerValidated(schema, data, key, send, jobName) {
    return withEnqueueSpan(async () => {
        const checked = await parseAsync(schema, data);
        if (isAsyncSchemaFailure(checked))
            return checked;
        const id = key === undefined ? queueJobId.create() : await parseAsync(queueJobId.schema, key);
        if (isFailure(id))
            return id;
        try {
            const acknowledged = await send(id);
            if (acknowledged === undefined)
                return QueueAcceptanceUnknown();
            const restored = await parseAsync(queueJobId.schema, acknowledged);
            return isAsyncSchemaFailure(restored) ? QueueAcceptanceUnknown({ cause: restored }) : restored;
        }
        catch (error) {
            return QueueAcceptanceUnknown({ cause: error });
        }
    }, jobName);
}
//# sourceMappingURL=trigger.js.map