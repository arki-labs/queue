/** Small W3C propagation carrier; SDK/exporter configuration remains app-owned. */
import type { Context } from '@opentelemetry/api';
export declare function captureJobTrace(): string | undefined;
export declare function jobTraceOptions(): {
    telemetry?: undefined;
} | {
    telemetry: {
        metadata: string;
    };
};
export declare function extractJobTrace(metadata: string | undefined): Context | undefined;
//# sourceMappingURL=job-trace.d.ts.map