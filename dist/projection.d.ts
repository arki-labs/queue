type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
type JsonObject = Record<string, JsonValue>;
type QueueActionLike = {
    readonly id: string;
    readonly plugin: string;
    readonly binding: string;
    readonly direction: 'in' | 'out';
    readonly address?: string;
    readonly metaSchema?: string;
    readonly meta?: JsonObject;
};
type ManifestLike = {
    readonly app: {
        readonly name: string;
    };
    readonly actions: readonly QueueActionLike[];
};
export type QueueTopologyDocument = {
    readonly format: 'queue-topology';
    readonly queues: readonly {
        readonly name: string;
        readonly consumers: readonly {
            readonly id: string;
            readonly plugin: string;
        }[];
        readonly producers: readonly {
            readonly id: string;
            readonly plugin: string;
        }[];
    }[];
};
export declare function project(manifest: ManifestLike): QueueTopologyDocument;
export {};
//# sourceMappingURL=projection.d.ts.map