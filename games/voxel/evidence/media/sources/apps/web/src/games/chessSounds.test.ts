import { describe, expect, it } from "vitest";
import { chessSounds } from "./chessSounds";

describe("chessSounds unit test", () => {
  it("does not throw outside browser environments", () => {
    expect(() => {
      chessSounds.prime();
      chessSounds.setMuted(true);
      chessSounds.playMove();
      chessSounds.playCapture();
      chessSounds.playCheck();
      chessSounds.playMate();
      chessSounds.playGameEnd(true);
      chessSounds.playGameEnd(false);
      chessSounds.playGameEnd(null);
      chessSounds.playGameOver(true);
      chessSounds.playGameOver(false);
      chessSounds.playGameOver(null);
      chessSounds.setMuted(false);
    }).not.toThrow();
  });
});
