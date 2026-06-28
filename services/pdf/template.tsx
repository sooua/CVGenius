import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  experienceKindLabels,
  type Award,
  type Certification,
  type Experience,
  type ExperienceKind,
  type Language,
  type ResumeContent,
  type SkillGroup,
} from "@/lib/resume/schema";
import { normalizeTemplate, type TemplateId } from "@/lib/resume/templates";

export type PdfLocale = "zh" | "en";

const experienceKindLabelsEn: Record<ExperienceKind, string> = {
  education: "Education",
  project: "Projects",
  internship: "Experience",
};

const sectionLabels = {
  zh: {
    targetRolePrefix: "目标方向",
    summary: "个人简介",
    skills: "技能",
    awards: "获奖荣誉",
    certifications: "证书",
    languages: "语言能力",
    fallbackCategory: "其他",
    fallbackName: "未命名简历",
    unnamedExperience: "（未命名）",
  },
  en: {
    targetRolePrefix: "Target",
    summary: "Summary",
    skills: "Skills",
    awards: "Awards",
    certifications: "Certifications",
    languages: "Languages",
    fallbackCategory: "Other",
    fallbackName: "Untitled Resume",
    unnamedExperience: "(Untitled)",
  },
} as const;

function pickKindLabels(locale: PdfLocale) {
  return locale === "en" ? experienceKindLabelsEn : experienceKindLabels;
}

// Font registration is runtime-specific (filesystem on the server, URLs in the
// browser preview) so it lives in the callers — see registerFonts.server.ts and
// the client LivePreview component. This module only references families by name
// and so stays isomorphic.

type HeaderStyle = "bar" | "underline" | "filled";

type Theme = {
  accent: string;
  ink: string;
  body: string;
  muted: string;
  faint: string;
  separator: string;
  nameFont: "NotoSerifSC" | "NotoSansSC";
  headerStyle: HeaderStyle;
  sectionTitleColor: string;
  uppercaseSections: boolean;
};

const THEMES: Record<TemplateId, Theme> = {
  classic: {
    accent: "#C96442",
    ink: "#141413",
    body: "#3D3D3A",
    muted: "#5E5D59",
    faint: "#87867F",
    separator: "#C0BFB8",
    nameFont: "NotoSerifSC",
    headerStyle: "bar",
    sectionTitleColor: "#141413",
    uppercaseSections: false,
  },
  minimal: {
    // Monochrome, ATS-friendly — accent collapses to ink so nothing is colored.
    accent: "#141413",
    ink: "#141413",
    body: "#33332F",
    muted: "#55554F",
    faint: "#8A8982",
    separator: "#D2D1CA",
    nameFont: "NotoSerifSC",
    headerStyle: "underline",
    sectionTitleColor: "#141413",
    uppercaseSections: true,
  },
  modern: {
    accent: "#3E4C59",
    ink: "#1F2933",
    body: "#3A4750",
    muted: "#52606D",
    faint: "#7B8794",
    separator: "#CBD2D9",
    nameFont: "NotoSerifSC",
    headerStyle: "filled",
    sectionTitleColor: "#FFFFFF",
    uppercaseSections: true,
  },
};

function makeStyles(t: Theme) {
  return StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 48,
      paddingHorizontal: 56,
      fontFamily: "NotoSansSC",
      fontSize: 10.5,
      color: t.body,
      lineHeight: 1.5,
      display: "flex",
      flexDirection: "column",
      gap: 18,
    },

    headerBlock: { display: "flex", flexDirection: "column", gap: 4 },
    overline: { fontSize: 9.5, color: t.accent, letterSpacing: 0.6 },
    name: {
      fontFamily: t.nameFont,
      fontSize: 32,
      lineHeight: 1.18,
      color: t.ink,
    },
    headline: { fontSize: 13, color: t.muted, lineHeight: 1.45 },

    contactRow: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
    },
    contactItem: { fontSize: 10, color: t.faint },
    contactSep: { fontSize: 10, color: t.separator },

    rule: { width: 36, height: 1.5, backgroundColor: t.accent },

    summary: { fontSize: 10.5, color: t.muted, lineHeight: 1.65 },
    targetRoleLine: { fontSize: 9.5, color: t.faint, letterSpacing: 0.4 },

    // Section header — "bar"
    sectionHeaderBar: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    sectionBar: { width: 3, height: 11, backgroundColor: t.accent },

    // Section header — "underline"
    sectionHeaderUnderline: {
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: t.separator,
    },

    // Section header — "filled"
    sectionHeaderFilled: {
      marginBottom: 8,
      alignSelf: "flex-start",
      backgroundColor: t.accent,
      paddingVertical: 2.5,
      paddingHorizontal: 7,
      borderRadius: 3,
    },

    sectionTitle: {
      fontFamily: "NotoSerifSC",
      fontSize: 13,
      color: t.sectionTitleColor,
      lineHeight: 1.2,
      letterSpacing: t.uppercaseSections ? 1.2 : 0,
    },
    sectionTitleFilled: {
      fontFamily: "NotoSansSC",
      fontWeight: 500,
      fontSize: 11,
      color: t.sectionTitleColor,
      lineHeight: 1.2,
      letterSpacing: 1,
    },

    expCard: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      marginBottom: 10,
    },
    expTitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
    },
    expTitle: {
      fontFamily: "NotoSerifSC",
      fontSize: 12.5,
      color: t.ink,
      lineHeight: 1.3,
      flex: 1,
    },
    expDates: { fontSize: 10, color: t.faint, letterSpacing: 0.4 },
    expMeta: { fontSize: 10, color: t.muted, lineHeight: 1.5 },

    highlightsGroup: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
      paddingTop: 4,
    },
    highlightRow: { display: "flex", flexDirection: "row", gap: 8 },
    highlightBullet: { fontSize: 11, color: t.accent, lineHeight: 1.6 },
    highlightText: { fontSize: 10.5, color: t.body, lineHeight: 1.6, flex: 1 },

    twoColRow: {
      display: "flex",
      flexDirection: "row",
      gap: 12,
      marginBottom: 4,
    },
    colLabel: {
      width: 72,
      fontSize: 10,
      color: t.faint,
      lineHeight: 1.6,
      letterSpacing: 0.4,
    },
    colBody: { flex: 1 },
    colBodyText: { fontSize: 10.5, color: t.body, lineHeight: 1.6 },
    itemTitle: {
      fontFamily: "NotoSerifSC",
      fontSize: 11,
      color: t.ink,
      lineHeight: 1.4,
    },
    itemMeta: { fontSize: 10, color: t.muted, lineHeight: 1.5 },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function shortUrl(u: string): string {
  return u.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function ContactRow({ content, s }: { content: ResumeContent; s: Styles }) {
  const b = content.basicInfo;
  const parts = [
    b.location,
    b.phone,
    b.email,
    shortUrl(b.portfolioUrl),
    shortUrl(b.github),
    shortUrl(b.linkedin),
  ].filter((p) => p.trim());
  if (parts.length === 0) return null;
  return (
    <View style={s.contactRow}>
      {parts.map((part, i) => (
        <View
          key={i}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Text style={s.contactItem}>{part}</Text>
          {i < parts.length - 1 ? (
            <Text style={s.contactSep}>·</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SectionHeader({
  label,
  s,
  headerStyle,
}: {
  label: string;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  if (headerStyle === "filled") {
    return (
      <View style={s.sectionHeaderFilled}>
        <Text style={s.sectionTitleFilled}>{label}</Text>
      </View>
    );
  }
  if (headerStyle === "underline") {
    return (
      <View style={s.sectionHeaderUnderline}>
        <Text style={s.sectionTitle}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={s.sectionHeaderBar}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle}>{label}</Text>
    </View>
  );
}

function ExperienceCard({
  exp,
  unnamedLabel,
  s,
}: {
  exp: Experience;
  unnamedLabel: string;
  s: Styles;
}) {
  const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
  const meta = [exp.role, exp.org, exp.location].filter(Boolean).join(" · ");
  const highlights = exp.highlights.filter((h) => h.trim());

  return (
    <View style={s.expCard} wrap={false}>
      <View style={s.expTitleRow}>
        <Text style={s.expTitle}>{exp.title || unnamedLabel}</Text>
        {dates ? <Text style={s.expDates}>{dates}</Text> : null}
      </View>
      {meta ? <Text style={s.expMeta}>{meta}</Text> : null}
      {highlights.length > 0 ? (
        <View style={s.highlightsGroup}>
          {highlights.map((h, i) => (
            <View key={i} style={s.highlightRow}>
              <Text style={s.highlightBullet}>·</Text>
              <Text style={s.highlightText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ExperienceSection({
  kind,
  items,
  locale,
  s,
  headerStyle,
}: {
  kind: ExperienceKind;
  items: Experience[];
  locale: PdfLocale;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  const labels = sectionLabels[locale];
  return (
    <View>
      <SectionHeader
        label={pickKindLabels(locale)[kind]}
        s={s}
        headerStyle={headerStyle}
      />
      {items.map((exp) => (
        <ExperienceCard
          key={exp.id}
          exp={exp}
          unnamedLabel={labels.unnamedExperience}
          s={s}
        />
      ))}
    </View>
  );
}

function SkillsSection({
  skills,
  locale,
  s,
  headerStyle,
}: {
  skills: SkillGroup[];
  locale: PdfLocale;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  const labels = sectionLabels[locale];
  const useful = skills.filter(
    (g) => g.category.trim() || g.items.some((i) => i.trim()),
  );
  if (useful.length === 0) return null;
  return (
    <View>
      <SectionHeader label={labels.skills} s={s} headerStyle={headerStyle} />
      {useful.map((g) => (
        <View key={g.id} style={s.twoColRow}>
          <Text style={s.colLabel}>
            {g.category || labels.fallbackCategory}
          </Text>
          <Text style={[s.colBodyText, { flex: 1 }]}>
            {g.items.filter((i) => i.trim()).join("  ·  ")}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AwardsSection({
  awards,
  locale,
  s,
  headerStyle,
}: {
  awards: Award[];
  locale: PdfLocale;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  const labels = sectionLabels[locale];
  const useful = awards.filter((a) => a.title.trim() || a.date.trim());
  if (useful.length === 0) return null;
  return (
    <View>
      <SectionHeader label={labels.awards} s={s} headerStyle={headerStyle} />
      {useful.map((a) => (
        <View key={a.id} style={s.twoColRow} wrap={false}>
          <Text style={s.colLabel}>{a.date}</Text>
          <View style={s.colBody}>
            <Text style={s.itemTitle}>{a.title}</Text>
            {a.issuer.trim() ? (
              <Text style={s.itemMeta}>{a.issuer}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function CertificationsSection({
  certs,
  locale,
  s,
  headerStyle,
}: {
  certs: Certification[];
  locale: PdfLocale;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  const labels = sectionLabels[locale];
  const useful = certs.filter((x) => x.title.trim() || x.date.trim());
  if (useful.length === 0) return null;
  return (
    <View>
      <SectionHeader
        label={labels.certifications}
        s={s}
        headerStyle={headerStyle}
      />
      {useful.map((cert) => {
        const title = cert.issuer.trim()
          ? `${cert.title} · ${cert.issuer}`
          : cert.title;
        return (
          <View key={cert.id} style={s.twoColRow} wrap={false}>
            <Text style={s.colLabel}>{cert.date}</Text>
            <Text style={[s.itemTitle, { flex: 1 }]}>{title}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LanguagesSection({
  languages,
  locale,
  s,
  headerStyle,
}: {
  languages: Language[];
  locale: PdfLocale;
  s: Styles;
  headerStyle: HeaderStyle;
}) {
  const labels = sectionLabels[locale];
  const useful = languages.filter((l) => l.name.trim() || l.level.trim());
  if (useful.length === 0) return null;
  return (
    <View>
      <SectionHeader label={labels.languages} s={s} headerStyle={headerStyle} />
      {useful.map((l) => (
        <View key={l.id} style={s.twoColRow} wrap={false}>
          <Text style={s.colLabel}>{l.name}</Text>
          <Text style={[s.colBodyText, { flex: 1 }]}>{l.level}</Text>
        </View>
      ))}
    </View>
  );
}

export function ResumeDocument({
  content,
  locale = "zh",
  template,
}: {
  content: ResumeContent;
  locale?: PdfLocale;
  template?: TemplateId;
}) {
  const theme = THEMES[normalizeTemplate(template)];
  const s = makeStyles(theme);
  const headerStyle = theme.headerStyle;

  const {
    basicInfo,
    targetRole,
    summary,
    experiences,
    skills,
    awards,
    certifications,
    languages,
  } = content;

  const labels = sectionLabels[locale];
  const displayName = basicInfo.name.trim() || labels.fallbackName;
  const groups: Record<ExperienceKind, Experience[]> = {
    education: [],
    project: [],
    internship: [],
  };
  for (const exp of experiences) {
    groups[exp.kind as ExperienceKind]?.push(exp);
  }
  const nonEmptyKinds = (
    ["project", "education", "internship"] as ExperienceKind[]
  ).filter((k) => groups[k].length > 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBlock}>
          {targetRole.trim() ? (
            <Text style={s.overline}>
              {labels.targetRolePrefix} · {targetRole}
            </Text>
          ) : null}
          <Text style={s.name}>{displayName}</Text>
          {basicInfo.headline.trim() ? (
            <Text style={s.headline}>{basicInfo.headline}</Text>
          ) : null}
        </View>

        <ContactRow content={content} s={s} />

        <View style={s.rule} />

        {summary.trim() ? (
          <Text style={s.summary}>{summary}</Text>
        ) : null}

        {nonEmptyKinds.map((kind) => (
          <ExperienceSection
            key={kind}
            kind={kind}
            items={groups[kind]}
            locale={locale}
            s={s}
            headerStyle={headerStyle}
          />
        ))}

        <SkillsSection
          skills={skills}
          locale={locale}
          s={s}
          headerStyle={headerStyle}
        />
        <AwardsSection
          awards={awards}
          locale={locale}
          s={s}
          headerStyle={headerStyle}
        />
        <CertificationsSection
          certs={certifications}
          locale={locale}
          s={s}
          headerStyle={headerStyle}
        />
        <LanguagesSection
          languages={languages}
          locale={locale}
          s={s}
          headerStyle={headerStyle}
        />
      </Page>
    </Document>
  );
}
