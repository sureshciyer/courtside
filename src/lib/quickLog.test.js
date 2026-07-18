import { describe, it, expect } from "vitest";
import { matchAnalysisMarkdown } from "./markdown.js";

const base = {
  id: "M009", opponent: "Club session", date: "2026-07-18",
  quickLog: true, rallies: [], matchType: "Club casual", format: "Doubles",
  reflection: { ratings: { focus: 4 }, styleTags: [], strengths: [], weaknesses: [], focusNext: "" },
};

describe("quick-logged matches", () => {
  it("resultLabel drives Won/Lost in markdown when no scores exist", () => {
    const won = matchAnalysisMarkdown({ ...base, sets: [{ sonScore: 0, oppScore: 0 }], resultLabel: "won" });
    expect(won).toContain("✅ Won");
    const lost = matchAnalysisMarkdown({ ...base, sets: [{ sonScore: 0, oppScore: 0 }], resultLabel: "lost" });
    expect(lost).toContain("❌ Lost");
  });
  it("real scores still win over resultLabel absence", () => {
    const md = matchAnalysisMarkdown({ ...base, quickLog: false, sets: [{ sonScore: 21, oppScore: 12 }], resultLabel: null });
    expect(md).toContain("✅ Won");
  });
  it("reflection renders for quick-logged matches with no rallies", () => {
    const md = matchAnalysisMarkdown({ ...base, sets: [{ sonScore: 0, oppScore: 0 }] });
    expect(md).toContain("No rally data captured");
    expect(md).toContain("Player reflection");
    expect(md).toContain("| Focus & composure | 4 |");
  });
});
