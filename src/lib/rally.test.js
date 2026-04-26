import { describe, it, expect } from "vitest";
import {
  shotHitter,
  isSonShot,
  isOpponentShot,
  deriveShotContext,
} from "./rally.js";
import { rally, shot } from "./__fixtures__.js";

describe("shotHitter / isSonShot / isOpponentShot", () => {
  it("when Son serves: even indices = Son, odd = Opp", () => {
    const r = rally({ server: "S", shots: [shot(), shot(), shot(), shot()] });
    expect(shotHitter(r, 0)).toBe("S");
    expect(shotHitter(r, 1)).toBe("O");
    expect(shotHitter(r, 2)).toBe("S");
    expect(shotHitter(r, 3)).toBe("O");
    expect(isSonShot(r, 0)).toBe(true);
    expect(isOpponentShot(r, 1)).toBe(true);
  });

  it("when Opp serves: even indices = Opp, odd = Son", () => {
    const r = rally({ server: "O", shots: [shot(), shot(), shot()] });
    expect(shotHitter(r, 0)).toBe("O");
    expect(shotHitter(r, 1)).toBe("S");
    expect(shotHitter(r, 2)).toBe("O");
  });

  it("returns null when server is unset (defensive)", () => {
    const r = rally({ server: null, shots: [shot()] });
    expect(shotHitter(r, 0)).toBe(null);
  });
});

describe("deriveShotContext", () => {
  // ---- Quality-perspective tests (user spec items 1, 2, 3) ----
  it("Son E shot remains 'Effective' for Son", () => {
    const r = rally({
      server: "S",
      shots: [shot({ shotType: "LS" }), shot(), shot({ quality: "Effective" })],
    });
    const ctx = deriveShotContext(r, 2);
    expect(ctx.hitBy).toBe("S");
    expect(ctx.qualityFromHitterPerspective).toBe("Effective");
    expect(ctx.qualityForSonPerspective).toBe("Effective");
  });

  it("Opp E return becomes 'pressuring' for Son", () => {
    // Son serves; opp's return at shots[1] tagged Effective from the
    // opponent's hitter perspective.
    const r = rally({
      server: "S",
      shots: [
        shot({ shotType: "LS" }),
        shot({ shotType: "DR", quality: "Effective" }),
      ],
    });
    const ctx = deriveShotContext(r, 1);
    expect(ctx.hitBy).toBe("O");
    expect(ctx.qualityFromHitterPerspective).toBe("Effective");
    expect(ctx.qualityForSonPerspective).toBe("pressuring");
  });

  it("Opp I return becomes 'weak' / opportunity for Son", () => {
    const r = rally({
      server: "S",
      shots: [
        shot({ shotType: "LS" }),
        shot({ shotType: "LF", quality: "Ineffective" }),
      ],
    });
    const ctx = deriveShotContext(r, 1);
    expect(ctx.qualityForSonPerspective).toBe("weak");
  });

  it("Opp N return becomes 'neutral' for Son", () => {
    const r = rally({
      server: "S",
      shots: [shot({ shotType: "LS" }), shot({ shotType: "DR", quality: "Neutral" })],
    });
    const ctx = deriveShotContext(r, 1);
    expect(ctx.qualityForSonPerspective).toBe("neutral");
  });

  // ---- Origin inference (user spec item 4) ----
  it("Son's origin zone is inferred from the previous Opponent shot's zone", () => {
    // Opp serves to Son's Z7; Son hits the next shot. Son's origin = 7.
    const r = rally({
      server: "O",
      shots: [
        shot({ shotType: "LS", zone: 7 }),
        shot({ shotType: "CL", zone: 9, grip: "B" }),
      ],
    });
    const ctx = deriveShotContext(r, 1);
    expect(ctx.hitBy).toBe("S");
    expect(ctx.inferredOriginZone).toBe(7);
    expect(ctx.originZoneSource).toBe("derived_from_previous_opponent_shot");
    expect(ctx.previousOpponentShotType).toBe("LS");
    expect(ctx.previousOpponentShotZone).toBe(7);
  });

  it("explicit shot.originZone wins and reports 'captured' as the source", () => {
    const r = rally({
      server: "O",
      shots: [
        shot({ shotType: "LS", zone: 7 }),
        shot({ shotType: "CL", zone: 9, originZone: 4 }),
      ],
    });
    const ctx = deriveShotContext(r, 1);
    expect(ctx.inferredOriginZone).toBe(4);
    expect(ctx.originZoneSource).toBe("captured");
  });

  it("for the serve shot itself, originZone is null with source 'serve'", () => {
    const r = rally({ server: "S", shots: [shot({ shotType: "LS" })] });
    const ctx = deriveShotContext(r, 0);
    expect(ctx.inferredOriginZone).toBe(null);
    expect(ctx.originZoneSource).toBe("serve");
  });

  // ---- bodySide derivation (user spec item 5) ----
  it("bodySide is derived from grip", () => {
    const r = rally({
      server: "S",
      shots: [shot({ grip: "F" })],
    });
    expect(deriveShotContext(r, 0).bodySide).toBe("forehand");

    const r2 = rally({
      server: "S",
      shots: [shot({ grip: "B" })],
    });
    expect(deriveShotContext(r2, 0).bodySide).toBe("backhand");
  });

  // ---- target zone passthrough ----
  it("targetZone always equals shot.zone", () => {
    const r = rally({ server: "S", shots: [shot({ zone: 5 })] });
    expect(deriveShotContext(r, 0).targetZone).toBe(5);
  });

  it("returns null when the shot is missing", () => {
    expect(deriveShotContext(rally({ shots: [] }), 0)).toBe(null);
    expect(deriveShotContext(null, 0)).toBe(null);
  });

  // Phase-7 / pattern-mining additions —
  it("populates previousShot, nextShot, and previousOpponentShot fields", () => {
    const r = rally({
      server: "S",
      shots: [
        shot({ shotType: "LS", zone: 2 }),
        shot({ shotType: "LF", zone: 8 }),
        shot({ shotType: "SM", zone: 9 }),
      ],
    });
    const ctx = deriveShotContext(r, 1); // opp shot
    expect(ctx.previousShot?.shotType).toBe("LS");
    expect(ctx.nextShot?.shotType).toBe("SM");
    // shot[1] was hit by opp → its previousOpponentShot is null (prior was Son).
    expect(ctx.previousOpponentShot).toBe(null);
  });

  it("does NOT infer Son origin for opponent shots", () => {
    const r = rally({
      server: "S",
      shots: [shot({ shotType: "LS", zone: 2 }), shot({ shotType: "DR", zone: 5 })],
    });
    const ctx = deriveShotContext(r, 1); // opp shot
    expect(ctx.hitBy).toBe("O");
    expect(ctx.inferredOriginZone).toBe(null);
    expect(ctx.originZoneSource).toBe("not_inferred_for_opponent");
  });

  it("exposes shotType / grip / dir / score / phase passthroughs", () => {
    const r = rally({
      server: "S",
      score: "10-8",
      phase: "Mid",
      shots: [shot({ shotType: "LS", grip: null, dir: null, zone: 2 })],
    });
    const ctx = deriveShotContext(r, 0);
    expect(ctx.shotType).toBe("LS");
    expect(ctx.score).toBe("10-8");
    expect(ctx.phase).toBe("Mid");
  });
});
