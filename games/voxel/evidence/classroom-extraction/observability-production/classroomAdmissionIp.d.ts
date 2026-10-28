import type { readSecurityClientIp } from "./clientIp";
type IpEvidence = ReturnType<typeof readSecurityClientIp>;
/** Server-only association. Never put IP evidence in LiveKit token metadata. */
export declare class ClassroomAdmissionIpCache {
    private readonly maxEntries;
    private readonly ttlMs;
    private readonly now;
    private entries;
    constructor(maxEntries?: number, ttlMs?: number, now?: () => number);
    remember(roomCode: string, admissionId: string, participantIdentity: string, ip: IpEvidence): void;
    lookup(roomCode: string, admissionId?: string, participantIdentity?: string): {
        ipStatus: "unavailable";
        ipSource: "unavailable";
        ipObservation: "admission";
        ipUnavailableReason: "admission_not_cached";
    } | {
        ipObservation: "admission";
        ipSource: import("./clientIp").ClientIpSource;
        ipStatus: "unavailable";
        clientIp?: undefined;
        ipUnavailableReason?: undefined;
    } | {
        ipObservation: "admission";
        clientIp: string;
        ipSource: import("./clientIp").ClientIpSource;
        ipStatus: "available";
        ipUnavailableReason?: undefined;
    };
}
export declare const classroomAdmissionIps: ClassroomAdmissionIpCache;
export {};
//# sourceMappingURL=classroomAdmissionIp.d.ts.map