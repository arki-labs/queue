/**
 * Debug logger for queue registration operations
 * Enable with: DEBUG=queue:register
 */
export declare const debugRegister: import("@arki/log").Logger;
/**
 * Debug logger for job execution operations
 * Enable with: DEBUG=queue:job
 */
export declare const debugJob: import("@arki/log").Logger;
/**
 * Debug logger for flow orchestration operations
 * Enable with: DEBUG=queue:flow
 */
export declare const debugFlow: import("@arki/log").Logger;
/**
 * Debug logger for schedule operations
 * Enable with: DEBUG=queue:schedule
 */
export declare const debugSchedule: import("@arki/log").Logger;
/**
 * Debug logger for middleware operations
 * Enable with: DEBUG=queue:middleware
 */
export declare const debugMiddleware: import("@arki/log").Logger;
/**
 * Debug logger for worker lifecycle operations
 * Enable with: DEBUG=queue:worker
 */
export declare const debugWorker: import("@arki/log").Logger;
/**
 * Debug logger for builder operations
 * Enable with: DEBUG=queue:builder
 */
export declare const debugBuilder: import("@arki/log").Logger;
/**
 * Enable all queue debug logs
 * Enable with: DEBUG=queue:*
 */
/** Observer callbacks, including app-owned logging sinks and trace sources, never own queue outcomes. */
export declare function observeQueue(observe: () => void): void;
//# sourceMappingURL=debug.d.ts.map