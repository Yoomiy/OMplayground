import { useEffect, useRef } from "react";
import type { JsonValue, SoloGameSaveControls } from "@/lib/soloGameSaves";
import { reportTelemetry } from "@/utils/telemetry";

export function useSoloAutoSave(
  save: SoloGameSaveControls,
  state: JsonValue,
  enabled = true,
  intervalMs = 2_000
) {
  const latestRef = useRef(state);
  const dirtyRef = useRef(false);

  useEffect(() => {
    latestRef.current = state;
    dirtyRef.current = enabled;
  }, [enabled, state]);

  useEffect(() => {
    if (!enabled) return undefined;
    const persist = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      void save.saveState(latestRef.current).catch((err) => {
        dirtyRef.current = true;
        reportTelemetry({
          level: "error",
          message: "Solo game autosave failed",
          stack: err instanceof Error ? err.stack : undefined,
          context: { appArea: "solo-autosave" }
        });
      });
    };
    const id = window.setInterval(persist, intervalMs);
    return () => {
      window.clearInterval(id);
      persist();
    };
  }, [enabled, intervalMs, save]);
}
