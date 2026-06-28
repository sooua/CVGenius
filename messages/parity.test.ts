import { describe, expect, it } from "vitest";
import zh from "./zh.json";
import en from "./en.json";

function flatten(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n catalog parity", () => {
  const zhKeys = new Set(flatten(zh));
  const enKeys = new Set(flatten(en));

  it("every zh key has an en translation", () => {
    const missing = [...zhKeys].filter((k) => !enKeys.has(k));
    expect(missing, `missing in en: ${missing.join(", ")}`).toEqual([]);
  });

  it("every en key has a zh translation", () => {
    const missing = [...enKeys].filter((k) => !zhKeys.has(k));
    expect(missing, `missing in zh: ${missing.join(", ")}`).toEqual([]);
  });

  it("ICU placeholders match between zh and en", () => {
    const zhFlat = new Map<string, string>();
    const collect = (obj: unknown, prefix: string, map: Map<string, string>) => {
      if (typeof obj === "string") {
        map.set(prefix, obj);
        return;
      }
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          collect(v, prefix ? `${prefix}.${k}` : k, map);
        }
      }
    };
    const enFlat = new Map<string, string>();
    collect(zh, "", zhFlat);
    collect(en, "", enFlat);

    // Extract ICU argument names while ignoring plural/select sub-message text
    // (e.g. the `{character}` in `one {character} other {characters}}`): an
    // argument brace isn't preceded by a plural/select selector keyword.
    const vars = (s: string) =>
      new Set(
        [
          ...s.matchAll(
            /(?<!\b(?:zero|one|two|few|many|other|=\d+)\s)\{\s*(\w+)\s*[,}]/g,
          ),
        ].map((m) => m[1]),
      );

    const mismatches: string[] = [];
    for (const [key, zhVal] of zhFlat) {
      const enVal = enFlat.get(key);
      if (enVal == null) continue;
      const a = vars(zhVal);
      const b = vars(enVal);
      if (a.size !== b.size || [...a].some((v) => !b.has(v))) {
        mismatches.push(key);
      }
    }
    expect(mismatches, `placeholder mismatch: ${mismatches.join(", ")}`).toEqual(
      [],
    );
  });
});
