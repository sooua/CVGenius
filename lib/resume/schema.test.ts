import { describe, expect, it } from "vitest";
import { emptyResumeContent, parseResumeContent } from "./schema";

describe("parseResumeContent", () => {
  it("falls back to empty content on invalid input", () => {
    expect(parseResumeContent(null)).toEqual(emptyResumeContent());
    expect(parseResumeContent("nope")).toEqual(emptyResumeContent());
    expect(parseResumeContent(42)).toEqual(emptyResumeContent());
  });

  it("fills defaults for missing fields (incl. new ones)", () => {
    const c = parseResumeContent({ basicInfo: { name: "Xia" } });
    expect(c.basicInfo.name).toBe("Xia");
    expect(c.basicInfo.github).toBe("");
    expect(c.basicInfo.linkedin).toBe("");
    expect(c.languages).toEqual([]);
    expect(c.experiences).toEqual([]);
  });

  it("preserves valid nested content", () => {
    const c = parseResumeContent({
      basicInfo: { name: "Xia", github: "https://github.com/x" },
      languages: [{ id: "l1", name: "English", level: "Fluent" }],
    });
    expect(c.basicInfo.github).toBe("https://github.com/x");
    expect(c.languages[0].name).toBe("English");
  });

  it("emptyResumeContent is itself valid (round-trips)", () => {
    expect(parseResumeContent(emptyResumeContent())).toEqual(
      emptyResumeContent(),
    );
  });
});
