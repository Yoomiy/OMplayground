import type { AdmissionPolicy } from "../../../games/voxel/src/server/gateway.ts";
import type { SchoolAccess } from "../src/school-access.ts";
import { schoolGatewayPolicy } from "../src/school-admission.ts";

/** Browser-fixture timing only: retain real SDK decisions without waiting for
 * production's thirty-second refresh in every revocation/lifecycle assertion. */
export function schoolBrowserPolicy(access: SchoolAccess) {
  const policy = schoolGatewayPolicy(access);
  const admit: AdmissionPolicy = async (...args) => {
    const grant = await policy.admit(...args);
    return (
      grant && {
        ...grant,
        connected: () => ({ ...grant.connected!(), recheckMs: 1000 }),
      }
    );
  };
  return {
    ...policy,
    admit,
    roomPolicy: async (room: string) => {
      const value = await policy.roomPolicy!(room);
      return {
        ...value,
        expiresAt: Math.min(value.expiresAt, Date.now() + 1000),
      };
    },
  };
}
