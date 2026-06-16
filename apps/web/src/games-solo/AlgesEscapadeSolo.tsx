import { useEffect, useMemo } from "react";
import {
  isJsonObject,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

export function AlgesEscapadeSolo({ save }: { save: SoloGameSaveControls }) {
  const resumeLevel = useMemo(() => {
    if (
      isJsonObject(save.savedState) &&
      typeof save.savedState.currentLevel === "number"
    ) {
      return Math.max(1, Math.floor(save.savedState.currentLevel));
    }
    return null;
  }, [save.savedState]);
  const src = resumeLevel
    ? `/legacy/alges-escapade/index.htm?resumeLevel=${resumeLevel}`
    : "/legacy/alges-escapade/index.htm";

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        state?: Record<string, unknown>;
      };
      if (
        data?.source !== "playground-legacy-game" ||
        data.gameKey !== "alges-escapade"
      ) {
        return;
      }
      if (
        data.type === "checkpoint" &&
        typeof data.state?.currentLevel === "number"
      ) {
        void save.saveState(
          { currentLevel: data.state.currentLevel },
          { saveKind: "checkpoint" }
        );
        return;
      }
      if (
        data.type === "levelComplete" &&
        typeof data.state?.level === "number" &&
        typeof data.state.stars === "number" &&
        typeof data.state.timeSeconds === "number" &&
        typeof data.state.clones === "number"
      ) {
        const level = data.state.level;
        const timeKey = `alges-escapade:level:${level}:timeSeconds`;
        const clonesKey = `alges-escapade:level:${level}:clones`;
        void save.mergeBestScores(
          {
            "alges-escapade:unlockedLevel": level + 1,
            [`alges-escapade:level:${level}:stars`]: data.state.stars,
            [timeKey]: data.state.timeSeconds,
            [clonesKey]: data.state.clones
          },
          [timeKey, clonesKey]
        );
        if (data.state.lastLevel === true) {
          void save.clearSave();
        } else {
          void save.saveState(
            { currentLevel: level + 1 },
            { saveKind: "checkpoint" }
          );
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save]);

  return (
    <section
      className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      dir="ltr"
    >
      <h2 className="text-center text-lg font-bold text-white">
        מסע בין שערים
      </h2>
      <p className="text-center text-sm font-medium text-white/70">
        המשחק הקלאסי בגרסת יחיד. השתמשו במקלדת כדי לשחק.
      </p>
      <div
        className="relative mx-auto overflow-hidden rounded-3xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] bg-black/20"
        style={{ width: "862px", height: "640px" }}
      >
        <iframe
          title="ההרפתקה של אלג"
          src={src}
          className="h-full w-full"
          style={{ border: 0 }}
        />
      </div>
    </section>
  );
}

