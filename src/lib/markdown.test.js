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
