import { useEffect, useRef } from "react";
import type { JsonValue, SoloGameSaveControls } from "@/lib/soloGameSaves";

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
      void save.saveState(latestRef.current);
    };
    const id = window.setInterval(persist, intervalMs);
    return () => {
      window.clearInterval(id);
      persist();
    };
  }, [enabled, intervalMs, save]);
}
