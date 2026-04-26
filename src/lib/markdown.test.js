import { describe, it, expect } from "vitest";
import { performanceReportMarkdown, matchAnalysisMarkdown } from "./markdown.js";
import { match, rally, shot } from "./__fixtures__.js";

describe("performanceReportMarkdown", () => {
  const buildMatch = () => match({
    rallies: [
      rally({ pointWonBy: "S", result: "W",  shots: [shot()] }),
      rally({ pointWonBy: "O", result: "UE", shots: [shot()] }),
    ],
  });

  const stimulusRally = (stim, resp, outcome = {}) => rally({
    server: "O",
    matchId: "M001",
    set: 1,
    score: outcome.score ?? "5-5",
    phase: outcome.phase ?? "Mid",
    pointWonBy: outcome.pointWonBy ?? "S",
    result: outcome.result ?? "W",
    shots: [
      shot({ shotType: stim.shotType, zone: stim.zone }),
      shot({
        shotType: resp.shotType,
        grip: resp.grip ?? "F",
        dir: resp.dir ?? "ST",
        zone: resp.zone,
      }),
    ],
  });

  it("returns the no-data placeholder when matches is empty", () => {
    expect(performanceReportMarkdown([])).toMatch(/No matches in scope/);
  });

  it("emits the Pro-Level Findings section with all 10 sub-sections", () => {
    const md = performanceReportMarkdown([buildMatch()], { playerName: "Test" });
    expect(md).toMatch(/Pro-level findings/);
    expect(md).toMatch(/1\. Data confidence/);
    expect(md).toMatch(/2\. Top performance leaks/);
    expect(md).toMatch(/3\. Rally-length truth/);
    expect(md).toMatch(/4\. Pressure & closing/);
    expect(md).toMatch(/5\. Serve \+ third shot/);
    expect(md).toMatch(/6\. Neutral-to-pressure/);
    expect(md).toMatch(/7\. Zone weakness/);
    expect(md).toMatch(/8\. Deception & variation/);
    expect(md).toMatch(/9\. Kill chains/);
    expect(md).toMatch(/10\. Training prescription/);
  });

  it("surfaces the 'directional only' confidence label in the callout for a small sample", () => {
    const md = performanceReportMarkdown([buildMatch()]);
    expect(md).toMatch(/directional only/i);
  });

  it("emits the deception caveat when no advanced tagging exists", () => {
    const md = performanceReportMarkdown([buildMatch()]);
    expect(md).toMatch(/Hold\/delay deception is not tracked/);
  });

  it("includes the Predictability & response patterns section", () => {
    const md = performanceReportMarkdown([buildMatch()]);
    expect(md).toMatch(/Predictability & response patterns/i);
    expect(md).toMatch(/Patterns are deterministic counts/i);
  });

  it("exports pressure-phase predictability comparison and insights", () => {
    const stim = { shotType: "CL", zone: 7 };
    const rallies = [
      ...Array(6).fill(0).map(() =>
        stimulusRally(stim, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }, { score: "18-18", phase: "Clutch" }),
      ),
      stimulusRally(stim, { shotType: "CL", grip: "F", dir: "ST", zone: 7 }, { score: "18-18", phase: "Clutch" }),
      stimulusRally(stim, { shotType: "LF", grip: "F", dir: "ST", zone: 9 }, { score: "18-18", phase: "Clutch" }),
      ...Array(3).fill(0).map(() =>
        stimulusRally(stim, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      ),
      ...Array(5).fill(0).map(() =>
        stimulusRally(stim, { shotType: "CL", grip: "F", dir: "ST", zone: 7 }),
      ),
      ...Array(4).fill(0).map(() =>
        stimulusRally(stim, { shotType: "LF", grip: "F", dir: "ST", zone: 9 }),
      ),
    ];

    const md = performanceReportMarkdown([match({ rallies })]);
    expect(md).toMatch(/Pressure-phase predictability comparison/);
    expect(md).toMatch(/Clutch \+30pp/);
    expect(md).toMatch(/In clutch points, Son becomes more predictable from Z7/);
  });
});

describe("matchAnalysisMarkdown", () => {
  it("emits the Pro-Level Findings block when rallies are present", () => {
    const m = match({
      rallies: [rally({ pointWonBy: "S", result: "W", shots: [shot()] })],
    });
    const md = matchAnalysisMarkdown(m, { playerName: "Test" });
    expect(md).toMatch(/Pro-level findings/);
  });

  it("falls back gracefully when no rallies were captured", () => {
    const m = match({ rallies: [] });
    const md = matchAnalysisMarkdown(m);
    expect(md).toMatch(/No rally data captured/);
  });
});
