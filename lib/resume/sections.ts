/**
 * Orderable resume body sections. Like `template`, section order is
 * presentation metadata stored on the resume row — kept out of ResumeContent
 * so it never reaches AI schemas. The header (name/contact) is always first
 * and not reorderable. "experience" is one block (its three kind-groups keep
 * their internal order).
 */
export const SECTION_KEYS = [
  "summary",
  "experience",
  "skills",
  "awards",
  "certifications",
  "languages",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const DEFAULT_SECTION_ORDER: SectionKey[] = [...SECTION_KEYS];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "个人简介",
  experience: "经历",
  skills: "技能",
  awards: "获奖荣誉",
  certifications: "证书",
  languages: "语言能力",
};

/**
 * Coerces stored/unknown input into a valid, complete order: keeps valid known
 * keys in their given order, drops junk/duplicates, then appends any missing
 * keys so new sections always render even on old saved orders.
 */
export function normalizeSectionOrder(value: unknown): SectionKey[] {
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = [];
  if (Array.isArray(value)) {
    for (const v of value) {
      if (
        typeof v === "string" &&
        (SECTION_KEYS as readonly string[]).includes(v) &&
        !seen.has(v as SectionKey)
      ) {
        seen.add(v as SectionKey);
        out.push(v as SectionKey);
      }
    }
  }
  for (const k of SECTION_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
