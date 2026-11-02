import { UnexpectedDefect } from '@arki/failure';
/** Reserve the operation before telemetry callbacks can invoke it again. */
export declare function withEnqueueSpan<Value>(run: () => Value | Promise<Value>, jobName?: string, spanName?: string): Promise<Value | ReturnType<typeof UnexpectedDefect>>;
//# sourceMappingURL=enqueue-span.d.ts.map