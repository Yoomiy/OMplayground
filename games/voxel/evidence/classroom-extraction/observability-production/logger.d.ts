import pino from "pino";
export type ServiceName = "game-server" | "classroom-server" | "voxel-server" | "minecraft-server" | "rocket-server" | "wobble-server" | "document-converter";
export declare function formatLogLevelLabel(label: string): {
    level: string;
};
export declare function createLogger(service: ServiceName): pino.Logger<never, boolean>;
//# sourceMappingURL=logger.d.ts.map