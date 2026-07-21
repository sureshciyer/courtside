import { describe, it, expect } from "vitest";
import { matchAnalysisMarkdown } from "./markdown.js";

const base = {
  id: "M009", opponent: "Club session", date: "2026-07-18",
  quickLog: true, rallies: [], matchType: "Casual Game", format: "Doubles",
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

describe("reflection markdown — club name + mindset + error notes", () => {
  const withReflection = (reflection, over = {}) =>
    matchAnalysisMarkdown({ ...base, sets: [{ sonScore: 0, oppScore: 0 }], reflection, ...over });

  it("includes the club/venue in the context line", () => {
    const md = withReflection(base.reflection, { club: "Springfield BC" });
    expect(md).toMatch(/\*\*Context:\*\*.*Springfield BC/);
  });

  it("renders feelings, big-point mindset, and tough-moment self-talk", () => {
    const md = withReflection({
      ...base.reflection,
      feelings: ["Nervous", "Frustrated"],
      bigPointMindset: "Tight / panicky",
      selfTalk: "kept smashing harder",
    });
    expect(md).toContain("**Feelings after the match:** Nervous, Frustrated");
    expect(md).toContain("**Mindset at big points:** Tight / panicky");
    expect(md).toContain("kept smashing harder");
  });

  it("renders per-topic error notes and the misc notes catch-all", () => {
    const md = withReflection({
      ...base.reflection,
      errorNotes: { "Serve errors": "3 into the net in set 2" },
      notes: "opponent kept me at the back",
    });
    expect(md).toContain("**Serve errors:** 3 into the net in set 2");
    expect(md).toContain("opponent kept me at the back");
  });

  it("skips empty error notes and blank mindset fields", () => {
    const md = withReflection({
      ...base.reflection,
      errorNotes: { "Serve errors": "   " },
      feelings: [],
      selfTalk: "",
    });
    // Assert on the rendered reflection lines, not the raw-JSON dump at the
    // bottom of the export (which echoes the full match object verbatim).
    expect(md).not.toContain("**Serve errors:**");
    expect(md).not.toContain("Feelings after the match");
    expect(md).not.toContain("Mindset at big points");
  });
});
