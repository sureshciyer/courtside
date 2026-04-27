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

  it("exports the Unforced Error Breakdown with count/rate note and compact notation", () => {
    const ueRally = (incoming, response, outcome = {}) =>
      stimulusRally(incoming, response, { ...outcome, pointWonBy: "O", result: "UE" });
    const rallies = [
      ueRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      ueRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
      ueRally({ shotType: "NT", zone: 8 }, { shotType: "LF", grip: "B", dir: "ST", zone: 7 }),
      stimulusRally({ shotType: "NT", zone: 8 }, { shotType: "LF", grip: "B", dir: "ST", zone: 7 }),
      stimulusRally({ shotType: "NT", zone: 8 }, { shotType: "LF", grip: "B", dir: "ST", zone: 7 }),
    ];

    const md = performanceReportMarkdown([match({ rallies })]);
    expect(md).toMatch(/Unforced Error Breakdown/);
    expect(md).toMatch(/Count shows where errors occurred most often/);
    expect(md).toMatch(/F-DR-CR to Z3/);
    expect(md).toMatch(/directional only/);
  });

  it("exports Shot Mix & Effectiveness with Son mix, effectiveness, and low-sample wording", () => {
    const rallies = [
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3, quality: "Effective" }),
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3, quality: "Neutral" }),
      stimulusRally({ shotType: "CL", zone: 7 }, { shotType: "DR", grip: "F", dir: "CR", zone: 3, quality: "Ineffective" }),
    ];
    const md = performanceReportMarkdown([match({ rallies })]);
    expect(md).toMatch(/Shot Mix & Effectiveness/);
    expect(md).toMatch(/A\. Son Shot Mix/);
    expect(md).toMatch(/B\. Son Shot Effectiveness/);
    expect(md).toMatch(/low sample|directional only/i);
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

  it("includes the Unforced Error Breakdown for a single match export", () => {
    const m = match({
      rallies: [
        rally({
          server: "O",
          pointWonBy: "O",
          result: "UE",
          shots: [
            shot({ shotType: "CL", zone: 7 }),
            shot({ shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
          ],
        }),
      ],
    });
    const md = matchAnalysisMarkdown(m);
    expect(md).toMatch(/Unforced Error Breakdown/);
  });

  it("includes Shot Mix & Effectiveness for a single match export", () => {
    const m = match({
      rallies: [
        rally({
          server: "O",
          pointWonBy: "S",
          result: "W",
          shots: [
            shot({ shotType: "CL", zone: 7 }),
            shot({ shotType: "DR", grip: "F", dir: "CR", zone: 3 }),
          ],
        }),
      ],
    });
    const md = matchAnalysisMarkdown(m);
    expect(md).toMatch(/Shot Mix & Effectiveness/);
  });
});
