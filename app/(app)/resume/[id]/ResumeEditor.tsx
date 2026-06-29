"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormGetValues,
} from "react-hook-form";
import dynamic from "next/dynamic";
import { getResumePageCount } from "@/app/actions/pdf";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  cloneResume,
  deleteResume,
  listResumeVersions,
  restoreResumeVersion,
  saveResumeVersion,
  setResumeSectionOrder,
  setResumeTemplate,
  setShareEnabled,
  updateResume,
} from "@/app/actions/resumes";
import {
  RESUME_TEMPLATES,
  type TemplateId,
} from "@/lib/resume/templates";
import {
  type SectionKey,
} from "@/lib/resume/sections";
import {
  generateCoverLetter,
  generateHighlights,
  generateInterviewPrep,
  listResumeAiHistory,
  rewriteHighlight,
  runResumeCheckup,
  runResumeMatch,
  type AiHistoryItem,
} from "@/app/actions/ai";
import { clientEnv } from "@/lib/env";
import type {
  CheckupIssue,
  CheckupResult,
  InterviewPrepResult,
  InterviewQuestion,
  MatchResult,
  RewriteBlock,
} from "@/services/ai/schemas";
import {
  experienceKinds,
  experienceKindLabels,
  parseResumeContent,
  type ExperienceKind,
  type ResumeContent,
} from "@/lib/resume/schema";
import { jobsSection } from "@/content/landing/sections";

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

type CheckupState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "result"; data: CheckupResult; at: Date }
  | { kind: "error"; message: string };

type MatchState =
  | { kind: "idle" }
  | { kind: "input" }
  | { kind: "running" }
  | { kind: "result"; data: MatchResult }
  | { kind: "error"; message: string };

type CoverLetterState =
  | { kind: "idle" }
  | { kind: "input" }
  | { kind: "running" }
  | { kind: "result"; text: string }
  | { kind: "error"; message: string };

type InterviewState =
  | { kind: "idle" }
  | { kind: "input" }
  | { kind: "running" }
  | { kind: "result"; data: InterviewPrepResult }
  | { kind: "error"; message: string };

type QuotaSnapshot = {
  rewriteUsed: number;
  rewriteLimit: number;
  checkupUsed: number;
  checkupLimit: number;
  uploadUsed: number;
  uploadLimit: number;
  matchUsed: number;
  matchLimit: number;
  coverLetterUsed: number;
  coverLetterLimit: number;
  interviewUsed: number;
  interviewLimit: number;
  plan: string;
  unlimited: boolean;
};

type ShareSnapshot = {
  enabled: boolean;
  token: string | null;
  expiresAt: string | null;
  hasPasscode: boolean;
  viewCount: number;
  lastViewedAt: string | null;
};

type VersionSummary = {
  id: string;
  label: string | null;
  at: string;
};

const AUTOSAVE_DELAY_MS = 800;

function newId() {
  return crypto.randomUUID();
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ResumeEditor({
  resumeId,
  initialContent,
  initialCheckup,
  initialQuota,
  initialShare,
  initialVersions,
  initialTemplate,
  initialSectionOrder,
}: {
  resumeId: string;
  initialContent: ResumeContent;
  initialCheckup: { data: CheckupResult; at: string } | null;
  initialQuota: QuotaSnapshot;
  initialShare: ShareSnapshot;
  initialVersions: VersionSummary[];
  initialTemplate: TemplateId;
  initialSectionOrder: SectionKey[];
}) {
  const t = useTranslations("editor");
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isDeleting, startDelete] = useTransition();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [checkup, setCheckup] = useState<CheckupState>(() =>
    initialCheckup
      ? {
          kind: "result",
          data: initialCheckup.data,
          at: new Date(initialCheckup.at),
        }
      : { kind: "idle" },
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaSnapshot>(initialQuota);
  const [match, setMatch] = useState<MatchState>({ kind: "idle" });
  const [jobDescription, setJobDescription] = useState("");
  const [cover, setCover] = useState<CoverLetterState>({ kind: "idle" });
  const [coverJd, setCoverJd] = useState("");
  const [coverExtra, setCoverExtra] = useState("");
  const [interview, setInterview] = useState<InterviewState>({ kind: "idle" });
  const [interviewJd, setInterviewJd] = useState("");

  const canRewrite =
    quota.unlimited || quota.rewriteUsed < quota.rewriteLimit;
  const canCheckup =
    quota.unlimited || quota.checkupUsed < quota.checkupLimit;
  const canMatch =
    quota.unlimited || quota.matchUsed < quota.matchLimit;
  const canCover =
    quota.unlimited || quota.coverLetterUsed < quota.coverLetterLimit;
  const canInterview =
    quota.unlimited || quota.interviewUsed < quota.interviewLimit;
  const matchRemaining = quota.matchLimit - quota.matchUsed;
  const coverRemaining = quota.coverLetterLimit - quota.coverLetterUsed;
  const interviewRemaining = quota.interviewLimit - quota.interviewUsed;

  const notifyRewriteResult = useCallback(
    (outcome: "success" | "quota-exceeded" | "other-error") => {
      setQuota((prev) => {
        if (outcome === "success") {
          return { ...prev, rewriteUsed: prev.rewriteUsed + 1 };
        }
        if (outcome === "quota-exceeded") {
          return { ...prev, rewriteUsed: prev.rewriteLimit };
        }
        return prev;
      });
    },
    [],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
  } = useForm<ResumeContent>({
    defaultValues: initialContent,
  });

  const experiencesField = useFieldArray({ control, name: "experiences" });
  const skillsField = useFieldArray({ control, name: "skills" });
  const awardsField = useFieldArray({ control, name: "awards" });
  const certificationsField = useFieldArray({
    control,
    name: "certifications",
  });
  const languagesField = useFieldArray({ control, name: "languages" });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef<ResumeContent>(initialContent);
  const isFirstChangeRef = useRef(true);

  const flushSave = useCallback(async () => {
    setSaveState({ kind: "saving" });
    const result = await updateResume(resumeId, latestValuesRef.current);
    if (result.ok) {
      setSaveState({ kind: "saved", at: new Date() });
    } else {
      setSaveState({ kind: "error", message: result.error });
    }
  }, [resumeId]);

  useEffect(() => {
    const subscription = watch((values) => {
      latestValuesRef.current = values as ResumeContent;
      // RHF fires watch once on mount with the initial values; ignore it.
      if (isFirstChangeRef.current) {
        isFirstChangeRef.current = false;
        return;
      }
      setSaveState({ kind: "dirty" });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [watch, flushSave]);

  // Warn before leaving with unsaved/in-flight changes.
  useEffect(() => {
    const needsGuard =
      saveState.kind === "dirty" ||
      saveState.kind === "saving" ||
      saveState.kind === "error";
    if (!needsGuard) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState.kind]);

  const saveNow = handleSubmit(async (data) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    latestValuesRef.current = data;
    await flushSave();
  });

  // Cmd/Ctrl+S forces a save right away.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveNow]);

  const onDelete = () => {
    if (!confirm(t("confirm.delete"))) return;
    startDelete(async () => {
      await deleteResume(resumeId);
      router.push("/dashboard");
    });
  };

  const [isCloning, startClone] = useTransition();
  const onClone = async () => {
    // Flush any pending edits first so the clone captures the latest content.
    if (saveState.kind === "dirty" || saveState.kind === "saving") {
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave();
    }
    startClone(() => {
      cloneResume(resumeId);
    });
  };

  const triggerCheckup = async () => {
    if (saveState.kind === "dirty" || saveState.kind === "saving") {
      // Flush pending auto-save first so the checkup sees the latest content.
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave();
    }
    setPanelOpen(true);
    setCheckup({ kind: "running" });
    const response = await runResumeCheckup(resumeId);
    if (response.ok) {
      setCheckup({ kind: "result", data: response.result, at: new Date() });
      setQuota((prev) => ({ ...prev, checkupUsed: prev.checkupUsed + 1 }));
    } else {
      setCheckup({ kind: "error", message: response.error });
      if (response.error.includes("已用完")) {
        setQuota((prev) => ({ ...prev, checkupUsed: prev.checkupLimit }));
      }
    }
  };

  const onCoverButtonClick = () => {
    if (cover.kind === "running") return;
    if (cover.kind === "idle") {
      setCover({ kind: "input" });
    } else {
      setCover({ kind: "idle" });
    }
  };

  const triggerCoverLetter = async () => {
    if (saveState.kind === "dirty" || saveState.kind === "saving") {
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave();
    }
    setCover({ kind: "running" });
    const response = await generateCoverLetter({
      resumeId,
      jobDescription: coverJd || undefined,
      extra: coverExtra || undefined,
    });
    if (response.ok) {
      setCover({ kind: "result", text: response.text });
      setQuota((prev) =>
        prev.unlimited
          ? prev
          : { ...prev, coverLetterUsed: prev.coverLetterUsed + 1 },
      );
    } else {
      setCover({ kind: "error", message: response.error });
      if (response.requiresUpgrade) {
        setQuota((prev) => ({
          ...prev,
          coverLetterUsed: prev.coverLetterLimit,
        }));
      }
    }
  };

  const onInterviewButtonClick = () => {
    if (interview.kind === "running") return;
    setInterview(interview.kind === "idle" ? { kind: "input" } : { kind: "idle" });
  };

  const triggerInterview = async () => {
    if (saveState.kind === "dirty" || saveState.kind === "saving") {
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave();
    }
    setInterview({ kind: "running" });
    const response = await generateInterviewPrep({
      resumeId,
      jobDescription: interviewJd || undefined,
    });
    if (response.ok) {
      setInterview({ kind: "result", data: response.result });
      setQuota((prev) =>
        prev.unlimited
          ? prev
          : { ...prev, interviewUsed: prev.interviewUsed + 1 },
      );
    } else {
      setInterview({ kind: "error", message: response.error });
      if (response.requiresUpgrade) {
        setQuota((prev) => ({ ...prev, interviewUsed: prev.interviewLimit }));
      }
    }
  };

  const onMatchButtonClick = () => {
    if (match.kind === "running") return;
    if (match.kind === "idle") {
      setMatch({ kind: "input" });
    } else {
      setMatch({ kind: "idle" });
    }
  };

  const triggerMatch = async () => {
    if (saveState.kind === "dirty" || saveState.kind === "saving") {
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave();
    }
    setMatch({ kind: "running" });
    const response = await runResumeMatch({
      resumeId,
      jobDescription,
    });
    if (response.ok) {
      setMatch({ kind: "result", data: response.result });
      setQuota((prev) =>
        prev.unlimited ? prev : { ...prev, matchUsed: prev.matchUsed + 1 },
      );
    } else {
      setMatch({ kind: "error", message: response.error });
      if (response.requiresUpgrade) {
        setQuota((prev) => ({ ...prev, matchUsed: prev.matchLimit }));
      }
    }
  };

  const onCheckupButtonClick = () => {
    if (checkup.kind === "running") return;
    if (checkup.kind === "result") {
      setPanelOpen((prev) => !prev);
      return;
    }
    if (!canCheckup) {
      setPanelOpen(true);
      setCheckup({
        kind: "error",
        message: t("checkup.quotaExceeded", {
          used: quota.checkupUsed,
          limit: quota.checkupLimit,
        }),
      });
      return;
    }
    triggerCheckup();
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8 pb-20">
      <header className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 md:py-4 bg-parchment/90 backdrop-blur-sm border-b border-border-warm flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="overline mb-1 md:mb-1.5">{t("header.overline")}</p>
          <h1 className="font-serif text-[18px] md:text-[22px] leading-tight text-near-black">
            {t("header.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
          <SaveIndicator state={saveState} />
          <button
            type="button"
            onClick={onCheckupButtonClick}
            disabled={checkup.kind === "running"}
            title={
              !canCheckup && checkup.kind !== "result"
                ? t("checkup.quotaTitle", {
                    used: quota.checkupUsed,
                    limit: quota.checkupLimit,
                  })
                : undefined
            }
            className={
              "rounded-lg px-3 py-1.5 text-[13px] transition disabled:cursor-wait " +
              (!canCheckup && checkup.kind !== "result"
                ? "bg-border-cream text-stone-gray"
                : "bg-warm-sand text-charcoal-warm hover:bg-border-cream disabled:opacity-60")
            }
          >
            {checkup.kind === "running"
              ? t("checkup.running")
              : checkup.kind === "result"
                ? t("checkup.score", { score: checkup.data.overallScore })
                : !canCheckup
                  ? t("checkup.full")
                  : t("checkup.label")}
          </button>
          {canMatch ? (
            <button
              type="button"
              onClick={onMatchButtonClick}
              disabled={match.kind === "running"}
              title={
                quota.unlimited
                  ? undefined
                  : t("trialTitle", { remaining: matchRemaining })
              }
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream disabled:opacity-60 disabled:cursor-wait transition"
            >
              {match.kind === "running"
                ? t("match.running")
                : quota.unlimited
                  ? t("match.label")
                  : t("match.labelRemaining", { remaining: matchRemaining })}
            </button>
          ) : (
            <Link
              href="/billing/start"
              title={t("upgradeTitle")}
              className="rounded-lg bg-warm-sand/60 px-3 py-1.5 text-[13px] text-stone-gray hover:bg-warm-sand hover:text-charcoal-warm transition"
            >
              {t("match.pro")}
            </Link>
          )}
          {canCover ? (
            <button
              type="button"
              onClick={onCoverButtonClick}
              disabled={cover.kind === "running"}
              title={
                quota.unlimited
                  ? undefined
                  : t("trialTitle", { remaining: coverRemaining })
              }
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream disabled:opacity-60 disabled:cursor-wait transition"
            >
              {cover.kind === "running"
                ? t("cover.running")
                : quota.unlimited
                  ? t("cover.label")
                  : t("cover.labelRemaining", { remaining: coverRemaining })}
            </button>
          ) : (
            <Link
              href="/billing/start"
              title={t("upgradeTitle")}
              className="rounded-lg bg-warm-sand/60 px-3 py-1.5 text-[13px] text-stone-gray hover:bg-warm-sand hover:text-charcoal-warm transition"
            >
              {t("cover.pro")}
            </Link>
          )}
          {canInterview ? (
            <button
              type="button"
              onClick={onInterviewButtonClick}
              disabled={interview.kind === "running"}
              title={
                quota.unlimited
                  ? undefined
                  : t("trialTitle", { remaining: interviewRemaining })
              }
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream disabled:opacity-60 disabled:cursor-wait transition"
            >
              {interview.kind === "running"
                ? t("interview.running")
                : quota.unlimited
                  ? t("interview.label")
                  : t("interview.labelRemaining", {
                      remaining: interviewRemaining,
                    })}
            </button>
          ) : (
            <Link
              href="/billing/start"
              title={t("upgradeTitle")}
              className="rounded-lg bg-warm-sand/60 px-3 py-1.5 text-[13px] text-stone-gray hover:bg-warm-sand hover:text-charcoal-warm transition"
            >
              {t("interview.pro")}
            </Link>
          )}
          <ExportDropdown resumeId={resumeId} canEnglish={canMatch} />
        </div>
      </header>

      <FirstRunGuide />

      <Section title={t("targetRole.heading")}>
        <TargetRolePicker
          value={watch("targetRole") ?? ""}
          onChange={(v) =>
            setValue("targetRole", v, {
              shouldDirty: true,
              shouldTouch: true,
            })
          }
        />
        <p className="mt-2 text-[12px] text-stone-gray leading-relaxed">
          {t("targetRole.hint")}
        </p>
      </Section>

      <Section title={t("basic.heading")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("basic.name")}>
            <input
              {...register("basicInfo.name")}
              placeholder={t("basic.namePlaceholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("basic.headline")}>
            <input
              {...register("basicInfo.headline")}
              placeholder={t("basic.headlinePlaceholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("basic.email")}>
            <input
              {...register("basicInfo.email")}
              type="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <Field label={t("basic.phone")}>
            <input
              {...register("basicInfo.phone")}
              placeholder="+86 ..."
              className={inputClass}
            />
          </Field>
          <Field label={t("basic.location")}>
            <input
              {...register("basicInfo.location")}
              placeholder={t("basic.locationPlaceholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("basic.portfolio")}>
            <input
              {...register("basicInfo.portfolioUrl")}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
          <Field label="GitHub">
            <input
              {...register("basicInfo.github")}
              placeholder={t("basic.githubPlaceholder")}
              className={inputClass}
            />
          </Field>
          <Field label="LinkedIn">
            <input
              {...register("basicInfo.linkedin")}
              placeholder={t("basic.linkedinPlaceholder")}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("summary.heading")}>
        <textarea
          {...register("summary")}
          rows={4}
          placeholder={t("summary.placeholder")}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </Section>

      <Section
        title={t("experience.heading")}
        actions={
          <div className="flex gap-2">
            {experienceKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const id = newId();
                  experiencesField.append({
                    id,
                    kind,
                    title: "",
                    org: "",
                    role: "",
                    startDate: "",
                    endDate: "",
                    location: "",
                    highlights: [],
                  });
                  // Newly added cards start expanded; no-op against the Set.
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                }}
                className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
              >
                + {t(`expKind.${kind}`)}
              </button>
            ))}
          </div>
        }
      >
        {experiencesField.fields.length === 0 ? (
          <EmptyRow text={t("experience.empty")} />
        ) : (
          <ul className="space-y-3">
            {experiencesField.fields.map((field, index) => {
              const isCollapsed = collapsed.has(field.id);
              const live = watch(`experiences.${index}`);
              const title = live?.title || t("experience.untitledItem");
              const meta = [live?.org, live?.role, dateRange(live?.startDate, live?.endDate)]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={field.id}
                  className="rounded-2xl bg-ivory ring-1 ring-border-warm"
                >
                  <div className="flex items-center justify-between gap-2 px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(field.id)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      <span className="text-[12.5px] text-terracotta tracking-wide shrink-0 w-16">
                        {t(`expKind.${field.kind as ExperienceKind}`)}
                      </span>
                      <span className="font-serif text-[15px] text-near-black truncate">
                        {title}
                      </span>
                      <span className="text-[12.5px] text-olive-gray truncate">
                        {meta}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 text-stone-gray">
                      <IconButton
                        title={t("move.up")}
                        disabled={index === 0}
                        onClick={() => experiencesField.move(index, index - 1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        title={t("move.down")}
                        disabled={index === experiencesField.fields.length - 1}
                        onClick={() => experiencesField.move(index, index + 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        title={isCollapsed ? t("expand") : t("collapse")}
                        onClick={() => toggleCollapse(field.id)}
                      >
                        {isCollapsed ? "＋" : "−"}
                      </IconButton>
                      <IconButton
                        title={t("delete")}
                        onClick={() => experiencesField.remove(index)}
                        danger
                      >
                        ×
                      </IconButton>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="border-t border-border-warm px-5 py-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={t("experience.field.title")}>
                          <input
                            {...register(`experiences.${index}.title`)}
                            placeholder={t("experience.field.titlePlaceholder")}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t("experience.field.org")}>
                          <input
                            {...register(`experiences.${index}.org`)}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t("experience.field.role")}>
                          <input
                            {...register(`experiences.${index}.role`)}
                            placeholder={t("experience.field.rolePlaceholder")}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t("experience.field.location")}>
                          <input
                            {...register(`experiences.${index}.location`)}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t("experience.field.start")}>
                          <input
                            {...register(`experiences.${index}.startDate`)}
                            placeholder="2024.09"
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t("experience.field.end")}>
                          <input
                            {...register(`experiences.${index}.endDate`)}
                            placeholder={t("experience.field.endPlaceholder")}
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <HighlightsEditor
                        control={control}
                        register={register}
                        setValue={setValue}
                        getValues={getValues}
                        resumeId={resumeId}
                        nestIndex={index}
                        canRewrite={canRewrite}
                        onRewriteOutcome={notifyRewriteResult}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title={t("skills.heading")}
        actions={
          <button
            type="button"
            onClick={() =>
              skillsField.append({ id: newId(), category: "", items: [] })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            {t("skills.addCategory")}
          </button>
        }
      >
        {skillsField.fields.length === 0 ? (
          <EmptyRow text={t("skills.empty")} />
        ) : (
          <ul className="space-y-3">
            {skillsField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`skills.${index}.category`)}
                  placeholder={t("skills.categoryPlaceholder")}
                  className={`${inputClass} w-40`}
                />
                <SkillItemsEditor
                  control={control}
                  register={register}
                  nestIndex={index}
                />
                <button
                  type="button"
                  onClick={() => skillsField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("awards.heading")}
        actions={
          <button
            type="button"
            onClick={() =>
              awardsField.append({
                id: newId(),
                title: "",
                date: "",
                issuer: "",
              })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            {t("addItem")}
          </button>
        }
      >
        {awardsField.fields.length === 0 ? (
          <EmptyRow text={t("awards.empty")} />
        ) : (
          <ul className="space-y-2">
            {awardsField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`awards.${index}.date`)}
                  placeholder="2024.10"
                  className={`${inputClass} w-24`}
                />
                <input
                  {...register(`awards.${index}.title`)}
                  placeholder={t("awards.titlePlaceholder")}
                  className={`${inputClass} flex-1`}
                />
                <input
                  {...register(`awards.${index}.issuer`)}
                  placeholder={t("awards.issuerPlaceholder")}
                  className={`${inputClass} w-44`}
                />
                <button
                  type="button"
                  onClick={() => awardsField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("certs.heading")}
        actions={
          <button
            type="button"
            onClick={() =>
              certificationsField.append({
                id: newId(),
                title: "",
                date: "",
                issuer: "",
              })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            {t("addItem")}
          </button>
        }
      >
        {certificationsField.fields.length === 0 ? (
          <EmptyRow text={t("certs.empty")} />
        ) : (
          <ul className="space-y-2">
            {certificationsField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`certifications.${index}.date`)}
                  placeholder="2024.06"
                  className={`${inputClass} w-24`}
                />
                <input
                  {...register(`certifications.${index}.title`)}
                  placeholder={t("certs.titlePlaceholder")}
                  className={`${inputClass} flex-1`}
                />
                <input
                  {...register(`certifications.${index}.issuer`)}
                  placeholder={t("certs.issuerPlaceholder")}
                  className={`${inputClass} w-44`}
                />
                <button
                  type="button"
                  onClick={() => certificationsField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("languages.heading")}
        actions={
          <button
            type="button"
            onClick={() =>
              languagesField.append({ id: newId(), name: "", level: "" })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            {t("addItem")}
          </button>
        }
      >
        {languagesField.fields.length === 0 ? (
          <EmptyRow text={t("languages.empty")} />
        ) : (
          <ul className="space-y-2">
            {languagesField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`languages.${index}.name`)}
                  placeholder={t("languages.namePlaceholder")}
                  className={`${inputClass} w-40`}
                />
                <input
                  {...register(`languages.${index}.level`)}
                  placeholder={t("languages.levelPlaceholder")}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => languagesField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {panelOpen && checkup.kind !== "idle" && (
        <CheckupPanel
          state={checkup}
          onDismiss={() => setPanelOpen(false)}
          onRerun={triggerCheckup}
        />
      )}

      {match.kind !== "idle" && (
        <MatchPanel
          state={match}
          jd={jobDescription}
          onJdChange={setJobDescription}
          onSubmit={triggerMatch}
          onReset={() => setMatch({ kind: "input" })}
          onDismiss={() => setMatch({ kind: "idle" })}
        />
      )}

      {cover.kind !== "idle" && (
        <CoverLetterPanel
          state={cover}
          jd={coverJd}
          extra={coverExtra}
          onJdChange={setCoverJd}
          onExtraChange={setCoverExtra}
          onSubmit={triggerCoverLetter}
          onReset={() => setCover({ kind: "input" })}
          onDismiss={() => setCover({ kind: "idle" })}
        />
      )}

      {interview.kind !== "idle" && (
        <InterviewPanel
          state={interview}
          jd={interviewJd}
          onJdChange={setInterviewJd}
          onSubmit={triggerInterview}
          onReset={() => setInterview({ kind: "input" })}
          onDismiss={() => setInterview({ kind: "idle" })}
        />
      )}

      <TemplatePanel
        resumeId={resumeId}
        initialTemplate={initialTemplate}
        initialSectionOrder={initialSectionOrder}
        control={control}
      />

      <SharePanel resumeId={resumeId} initial={initialShare} />

      <HistoryPanel resumeId={resumeId} />

      <VersionsPanel
        resumeId={resumeId}
        initialVersions={initialVersions}
        flushPendingSave={async () => {
          if (saveState.kind === "dirty" || saveState.kind === "saving") {
            if (timerRef.current) clearTimeout(timerRef.current);
            await flushSave();
          }
        }}
        onRestored={(content) => {
          reset(content);
          latestValuesRef.current = content;
          setSaveState({ kind: "saved", at: new Date() });
        }}
      />

      <footer className="flex items-center justify-between pt-4 border-t border-border-warm">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-[13px] text-stone-gray hover:text-error disabled:opacity-50 transition"
          >
            {isDeleting ? t("footer.deleting") : t("footer.delete")}
          </button>
          <button
            type="button"
            onClick={onClone}
            disabled={isCloning}
            className="text-[13px] text-stone-gray hover:text-near-black disabled:opacity-50 transition"
            title={t("footer.cloneTitle")}
          >
            {isCloning ? t("footer.cloning") : t("footer.clone")}
          </button>
        </div>
        <p className="text-[12px] text-stone-gray">
          {t("footer.saveHint")}
        </p>
      </footer>
    </form>
  );
}

function dateRange(start?: string, end?: string) {
  if (!start && !end) return "";
  return `${start ?? ""} – ${end ?? ""}`.trim();
}

const GUIDE_DISMISS_KEY = "firstcv-editor-guide-dismissed";

function FirstRunGuide() {
  const t = useTranslations("editor");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = true;
    try {
      dismissed = !!localStorage.getItem(GUIDE_DISMISS_KEY);
    } catch {
      /* storage blocked — just don't show */
    }
    if (dismissed) return;
    const t = setTimeout(() => setShow(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(GUIDE_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="motion-slide-in-soft rounded-2xl bg-ivory ring-1 ring-border-warm px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="overline mb-1.5">{t("guide.overline")}</p>
        <p className="text-[13px] text-olive-gray leading-relaxed">
          {t.rich("guide.body", {
            gen: (chunks) => (
              <span className="text-terracotta">{chunks}</span>
            ),
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12px] hover:bg-border-cream transition"
      >
        {t("guide.dismiss")}
      </button>
    </div>
  );
}

function HighlightsEditor({
  control,
  register,
  setValue,
  getValues,
  resumeId,
  nestIndex,
  canRewrite,
  onRewriteOutcome,
}: {
  control: Control<ResumeContent>;
  register: UseFormRegister<ResumeContent>;
  setValue: UseFormSetValue<ResumeContent>;
  getValues: UseFormGetValues<ResumeContent>;
  resumeId: string;
  nestIndex: number;
  canRewrite: boolean;
  onRewriteOutcome: (
    outcome: "success" | "quota-exceeded" | "other-error",
  ) => void;
}) {
  const t = useTranslations("editor");
  const { fields, append, remove } = useFieldArray({
    control,
    name: `experiences.${nestIndex}.highlights` as never,
  });

  const [genText, setGenText] = useState("");
  const [genState, setGenState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const generate = async () => {
    const description = genText.trim();
    if (!description) {
      setGenState({ kind: "error", message: t("highlight.genEmpty") });
      return;
    }
    if (!canRewrite) {
      setGenState({ kind: "error", message: t("highlight.quotaExceeded") });
      return;
    }
    const exp = getValues(`experiences.${nestIndex}`);
    const context: Record<string, string> = {
      类型: experienceKindLabels[exp.kind as ExperienceKind],
    };
    if (exp.title) context["名称"] = exp.title;
    if (exp.org) context["机构"] = exp.org;
    if (exp.role) context["角色"] = exp.role;

    setGenState({ kind: "loading" });
    const res = await generateHighlights({ resumeId, description, context });
    if (res.ok) {
      for (const h of res.highlights) append(h as never);
      setGenText("");
      setGenState({ kind: "idle" });
      onRewriteOutcome("success");
    } else {
      setGenState({ kind: "error", message: res.error });
      onRewriteOutcome(
        res.error.includes("已用完") ? "quota-exceeded" : "other-error",
      );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] text-olive-gray">{t("highlight.label")}</span>
        <button
          type="button"
          onClick={() => append("" as never)}
          className="text-[12px] text-terracotta hover:underline"
        >
          {t("addItem")}
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="text-[12.5px] text-stone-gray">
          {t("highlight.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((field, hi) => (
            <HighlightRow
              key={field.id}
              register={register}
              setValue={setValue}
              getValues={getValues}
              resumeId={resumeId}
              nestIndex={nestIndex}
              highlightIndex={hi}
              onRemove={() => remove(hi)}
              canRewrite={canRewrite}
              onRewriteOutcome={onRewriteOutcome}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-xl bg-parchment ring-1 ring-border-warm px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className="pt-2 text-[12px] text-terracotta shrink-0">✨</span>
          <textarea
            value={genText}
            onChange={(e) => {
              setGenText(e.target.value);
              if (genState.kind === "error") setGenState({ kind: "idle" });
            }}
            rows={2}
            disabled={genState.kind === "loading"}
            placeholder={t("highlight.genPlaceholder")}
            className={`${inputClass} flex-1 resize-y text-[13px]`}
          />
          <button
            type="button"
            onClick={generate}
            disabled={genState.kind === "loading" || !canRewrite}
            title={canRewrite ? t("highlight.genTitle") : t("highlight.quotaExceeded")}
            className="mt-0.5 shrink-0 rounded-lg bg-terracotta text-ivory px-3 py-2 text-[12px] hover:bg-coral disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {genState.kind === "loading" ? t("highlight.generating") : t("highlight.generate")}
          </button>
        </div>
        {genState.kind === "error" && (
          <p className="mt-1.5 ml-6 text-[12px] text-error">
            {genState.message}
          </p>
        )}
      </div>
    </div>
  );
}

type RewriteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; block: RewriteBlock }
  | { kind: "error"; message: string };

function HighlightRow({
  register,
  setValue,
  getValues,
  resumeId,
  nestIndex,
  highlightIndex,
  onRemove,
  canRewrite,
  onRewriteOutcome,
}: {
  register: UseFormRegister<ResumeContent>;
  setValue: UseFormSetValue<ResumeContent>;
  getValues: UseFormGetValues<ResumeContent>;
  resumeId: string;
  nestIndex: number;
  highlightIndex: number;
  onRemove: () => void;
  canRewrite: boolean;
  onRewriteOutcome: (
    outcome: "success" | "quota-exceeded" | "other-error",
  ) => void;
}) {
  const t = useTranslations("editor");
  const [rewrite, setRewrite] = useState<RewriteState>({ kind: "idle" });

  const fieldPath =
    `experiences.${nestIndex}.highlights.${highlightIndex}` as const;

  const triggerRewrite = async () => {
    const current = getValues(fieldPath) ?? "";
    if (!current.trim()) {
      setRewrite({ kind: "error", message: t("rewrite.empty") });
      return;
    }
    const experience = getValues(`experiences.${nestIndex}`);
    const context: Record<string, string> = {
      类型: experienceKindLabels[experience.kind as ExperienceKind],
    };
    if (experience.title) context["名称"] = experience.title;
    if (experience.org) context["机构"] = experience.org;
    if (experience.role) context["角色"] = experience.role;

    if (!canRewrite) {
      setRewrite({ kind: "error", message: t("rewrite.quotaExceeded") });
      return;
    }
    setRewrite({ kind: "loading" });
    const response = await rewriteHighlight({
      resumeId,
      text: current,
      context,
    });
    if (response.ok) {
      setRewrite({ kind: "result", block: response.result });
      onRewriteOutcome("success");
    } else {
      setRewrite({ kind: "error", message: response.error });
      onRewriteOutcome(
        response.error.includes("已用完") ? "quota-exceeded" : "other-error",
      );
    }
  };

  const accept = () => {
    if (rewrite.kind !== "result") return;
    setValue(fieldPath, rewrite.block.rewritten, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setRewrite({ kind: "idle" });
  };

  return (
    <li className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="pt-2.5 text-olive-gray">·</span>
        <textarea
          {...register(fieldPath)}
          rows={2}
          className={`${inputClass} flex-1 resize-y`}
          placeholder={t("highlight.rowPlaceholder")}
        />
        <div className="pt-1 flex flex-col gap-1 items-center">
          <button
            type="button"
            onClick={triggerRewrite}
            disabled={rewrite.kind === "loading" || !canRewrite}
            title={canRewrite ? t("rewrite.title") : t("rewrite.quotaExceeded")}
            className={
              "text-[11px] disabled:opacity-50 disabled:cursor-not-allowed " +
              (canRewrite
                ? "text-terracotta hover:underline disabled:cursor-wait"
                : "text-stone-gray")
            }
          >
            {rewrite.kind === "loading"
              ? t("rewrite.running")
              : !canRewrite
                ? t("rewrite.full")
                : t("rewrite.label")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={t("highlight.removeRow")}
            className="text-[12px] text-stone-gray hover:text-error"
          >
            ×
          </button>
        </div>
      </div>
      {rewrite.kind === "result" && (
        <RewritePreview
          block={rewrite.block}
          onAccept={accept}
          onDiscard={() => setRewrite({ kind: "idle" })}
        />
      )}
      {rewrite.kind === "error" && (
        <p className="ml-4 text-[12px] text-error">{rewrite.message}</p>
      )}
    </li>
  );
}

function RewritePreview({
  block,
  onAccept,
  onDiscard,
}: {
  block: RewriteBlock;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("editor");
  return (
    <div className="motion-slide-in-soft ml-4 rounded-2xl bg-parchment ring-1 ring-border-warm px-4 py-4 space-y-3">
      <div>
        <p className="text-[11px] text-stone-gray mb-1 tracking-wide">{t("rewrite.original")}</p>
        <p className="text-[13px] text-olive-gray leading-relaxed line-through decoration-stone-gray/60">
          {block.original}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-terracotta mb-1 tracking-wide">
          {t("rewrite.aiRewrite")}
        </p>
        <p className="text-[13.5px] text-near-black leading-relaxed">
          {block.rewritten}
        </p>
      </div>
      {block.reasons.length > 0 && (
        <div>
          <p className="text-[11px] text-stone-gray mb-1 tracking-wide">
            {t("rewrite.why")}
          </p>
          <ul className="text-[12.5px] text-olive-gray leading-relaxed space-y-0.5">
            {block.reasons.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {block.preservedFacts.length > 0 && (
        <div>
          <p className="text-[11px] text-stone-gray mb-1 tracking-wide">
            {t("rewrite.preservedFacts")}
          </p>
          <p className="text-[12px] text-olive-gray leading-relaxed">
            {block.preservedFacts.join("、")}
          </p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-lg bg-terracotta text-ivory px-3 py-1.5 text-[12.5px] font-medium hover:bg-coral transition"
        >
          {t("rewrite.accept")}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
        >
          {t("rewrite.discard")}
        </button>
      </div>
    </div>
  );
}

function SkillItemsEditor({
  control,
  register,
  nestIndex,
}: {
  control: Control<ResumeContent>;
  register: UseFormRegister<ResumeContent>;
  nestIndex: number;
}) {
  const t = useTranslations("editor");
  const { fields, append, remove } = useFieldArray({
    control,
    name: `skills.${nestIndex}.items` as never,
  });

  return (
    <div className="flex-1 flex flex-wrap items-center gap-2">
      {fields.map((field, si) => (
        <span
          key={field.id}
          className="inline-flex items-center gap-1 rounded-lg bg-warm-sand px-2 py-1"
        >
          <input
            {...register(`skills.${nestIndex}.items.${si}` as const)}
            className="bg-transparent text-[13px] text-near-black outline-none w-24"
          />
          <button
            type="button"
            onClick={() => remove(si)}
            className="text-[11px] text-stone-gray hover:text-error"
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => append("" as never)}
        className="text-[12px] text-terracotta hover:underline"
      >
        {t("skills.addItem")}
      </button>
    </div>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-serif text-[20px] text-near-black">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-ivory/60 ring-1 ring-dashed ring-border-warm px-5 py-6 text-center">
      <p className="text-[13px] text-stone-gray leading-relaxed">{text}</p>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[14px] transition ${
        danger
          ? "hover:bg-error/10 hover:text-error"
          : "hover:bg-warm-sand hover:text-near-black"
      } disabled:opacity-30 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("editor");
  if (state.kind === "idle") {
    return <span className="text-[12.5px] text-stone-gray">{t("save.idle")}</span>;
  }
  if (state.kind === "dirty") {
    return (
      <span className="text-[12.5px] text-olive-gray flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-olive-gray animate-pulse" />
        {t("save.dirty")}
      </span>
    );
  }
  if (state.kind === "saving") {
    return (
      <span className="text-[12.5px] text-olive-gray flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
        {t("save.saving")}
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="text-[12.5px] text-olive-gray">
        {t("save.saved", { time: formatTime(state.at) })}
      </span>
    );
  }
  return (
    <span className="text-[12.5px] text-error">
      {t("save.error", { message: state.message })}
    </span>
  );
}

const inputClass =
  "w-full rounded-xl bg-white ring-1 ring-border-warm px-3 py-2 text-[14px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition";

function MatchPanel({
  state,
  jd,
  onJdChange,
  onSubmit,
  onReset,
  onDismiss,
}: {
  state: Exclude<MatchState, { kind: "idle" }>;
  jd: string;
  onJdChange: (v: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("editor");
  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-5 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">{t("match.overline")}</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "input"
              ? t("match.inputTitle")
              : state.kind === "running"
                ? t("match.runningTitle")
                : state.kind === "result"
                  ? t("match.resultTitle", { score: state.data.overallScore })
                  : t("match.errorTitle")}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "result" && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
            >
              {t("match.changeJd")}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            {t("panel.hide")}
          </button>
        </div>
      </div>

      {state.kind === "input" && (
        <div className="space-y-3">
          <textarea
            value={jd}
            onChange={(e) => onJdChange(e.target.value)}
            rows={8}
            placeholder={t("match.jdPlaceholder")}
            className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
          />
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-stone-gray">
              {jd.trim().length < 40
                ? t("match.charsNeeded", {
                    n: Math.max(0, 40 - jd.trim().length),
                  })
                : t("match.charsEnough", { n: jd.trim().length })}
            </p>
            <button
              type="button"
              onClick={onSubmit}
              disabled={jd.trim().length < 40}
              className="rounded-xl bg-terracotta text-ivory px-5 py-2 text-[13.5px] font-medium hover:bg-coral disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {t("match.analyze")}
            </button>
          </div>
        </div>
      )}

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          {t("match.runningHint")}
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-[13.5px] text-error leading-relaxed">
          {state.message}
        </p>
      )}

      {state.kind === "result" && <MatchReport data={state.data} />}
    </section>
  );
}

function MatchReport({ data }: { data: MatchResult }) {
  const t = useTranslations("editor");
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 items-start">
        <div className="flex flex-col items-center">
          <span className="font-serif text-[44px] sm:text-[52px] leading-none text-near-black">
            {data.overallScore}
          </span>
          <span className="text-[11px] text-stone-gray mt-1 tracking-wide">
            {t("match.scoreCaption")}
          </span>
        </div>
        <p className="text-[13.5px] sm:text-[14px] text-charcoal-warm leading-relaxed pt-1">
          {data.summary}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["skills", "experience", "tone"] as const).map((key) => {
          const score = data.dimensionScores[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] text-olive-gray">
                  {t(`match.dim.${key}`)}
                </span>
                <span className="text-[13px] text-near-black tabular-nums">
                  {score}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-warm-sand overflow-hidden">
                <div
                  className="h-full bg-terracotta rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-[12.5px] text-olive-gray tracking-wide mb-2">
            {t("match.matched", { n: data.matchedKeywords.length })}
          </p>
          {data.matchedKeywords.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray">{t("match.none")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.matchedKeywords.map((k, i) => (
                <span
                  key={i}
                  className="rounded-full bg-terracotta/10 text-terracotta ring-1 ring-terracotta/20 px-2.5 py-0.5 text-[12px]"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[12.5px] text-olive-gray tracking-wide mb-2">
            {t("match.missing", { n: data.missingKeywords.length })}
          </p>
          {data.missingKeywords.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray">{t("match.none")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.missingKeywords.map((k, i) => (
                <span
                  key={i}
                  className="rounded-full bg-warm-sand text-charcoal-warm ring-1 ring-border-warm px-2.5 py-0.5 text-[12px]"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.suggestions.length > 0 && (
        <div>
          <p className="text-[12.5px] text-olive-gray tracking-wide mb-3">
            {t("match.suggestions", { n: data.suggestions.length })}
          </p>
          <ul className="space-y-3">
            {data.suggestions.map((s, i) => (
              <li
                key={i}
                className="rounded-2xl bg-white ring-1 ring-border-warm px-5 py-4"
              >
                <p className="font-serif text-[14.5px] text-near-black mb-1.5 leading-snug">
                  {s.title}
                </p>
                <p className="text-[13px] text-olive-gray leading-relaxed">
                  {s.detail}
                </p>
                {s.suggestedHighlight && (
                  <div className="mt-3 rounded-xl bg-parchment px-4 py-2.5">
                    <p className="text-[11px] text-terracotta tracking-wide mb-1">
                      {t("match.suggestedHighlight")}
                    </p>
                    <p className="text-[13px] text-near-black leading-relaxed">
                      {s.suggestedHighlight}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExportDropdown({
  resumeId,
  canEnglish,
}: {
  resumeId: string;
  canEnglish: boolean;
}) {
  const t = useTranslations("editor");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream transition"
      >
        {t("export.button")}
      </button>
      {open && (
        <div className="motion-slide-in-soft absolute right-0 top-full mt-1 min-w-[180px] rounded-xl bg-white ring-1 ring-border-warm shadow-[0_12px_32px_-16px_rgba(20,20,19,0.18)] py-1 z-30">
          <a
            href={`/api/resumes/${resumeId}/pdf`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-[13px] text-near-black hover:bg-parchment transition"
          >
            {t("export.zhVersion")}
          </a>
          {canEnglish ? (
            <a
              href={`/api/resumes/${resumeId}/pdf?lang=en`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[13px] text-near-black hover:bg-parchment transition"
            >
              {t("export.enVersion")}
            </a>
          ) : (
            <Link
              href="/billing/start"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[13px] text-stone-gray hover:bg-parchment transition"
            >
              {t("export.enPro")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function CoverLetterPanel({
  state,
  jd,
  extra,
  onJdChange,
  onExtraChange,
  onSubmit,
  onReset,
  onDismiss,
}: {
  state: Exclude<CoverLetterState, { kind: "idle" }>;
  jd: string;
  extra: string;
  onJdChange: (v: string) => void;
  onExtraChange: (v: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("editor");
  const [copied, setCopied] = useState(false);

  const copyLetter = async () => {
    if (state.kind !== "result") return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-5 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">{t("cover.overline")}</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "input"
              ? t("cover.inputTitle")
              : state.kind === "running"
                ? t("cover.runningTitle")
                : state.kind === "result"
                  ? t("cover.resultTitle")
                  : t("cover.errorTitle")}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "result" && (
            <>
              <button
                type="button"
                onClick={copyLetter}
                className="rounded-lg bg-terracotta text-ivory px-3 py-1.5 text-[12.5px] hover:bg-coral transition"
              >
                {copied ? t("copied") : t("copy")}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
              >
                {t("cover.regenerate")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            {t("panel.hide")}
          </button>
        </div>
      </div>

      {state.kind === "input" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              {t("cover.jdLabel")}
            </label>
            <textarea
              value={jd}
              onChange={(e) => onJdChange(e.target.value)}
              rows={5}
              placeholder={t("cover.jdPlaceholder")}
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
            />
          </div>
          <div>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              {t("cover.extraLabel")}
            </label>
            <textarea
              value={extra}
              onChange={(e) => onExtraChange(e.target.value)}
              rows={2}
              placeholder={t("cover.extraPlaceholder")}
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-xl bg-terracotta text-ivory px-5 py-2 text-[13.5px] font-medium hover:bg-coral transition"
            >
              {t("cover.generate")}
            </button>
          </div>
        </div>
      )}

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          {t("cover.runningHint")}
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-[13.5px] text-error leading-relaxed">
          {state.message}
        </p>
      )}

      {state.kind === "result" && (
        <article className="rounded-2xl bg-white ring-1 ring-border-warm px-6 md:px-8 py-6">
          <pre className="font-serif text-[14.5px] leading-[1.9] text-near-black whitespace-pre-wrap break-words">
            {state.text}
          </pre>
        </article>
      )}
    </section>
  );
}

function VersionsPanel({
  resumeId,
  initialVersions,
  flushPendingSave,
  onRestored,
}: {
  resumeId: string;
  initialVersions: VersionSummary[];
  flushPendingSave: () => Promise<void>;
  onRestored: (content: ResumeContent) => void;
}) {
  const t = useTranslations("editor");
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>(initialVersions);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const rows = await listResumeVersions(resumeId);
    setVersions(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        at:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      })),
    );
  };

  const onSaveSnapshot = async () => {
    setError(null);
    setBusy("saving");
    await flushPendingSave();
    const res = await saveResumeVersion(resumeId, label || undefined);
    if (res.ok) {
      setLabel("");
      await refresh();
    } else {
      setError(res.error);
    }
    setBusy(null);
  };

  const onRestore = async (versionId: string) => {
    if (!confirm(t("versions.restoreConfirm"))) {
      return;
    }
    setError(null);
    setBusy(versionId);
    await flushPendingSave();
    const res = await restoreResumeVersion(versionId);
    if (res.ok) {
      onRestored(res.content);
      await refresh();
    } else {
      setError(res.error);
    }
    setBusy(null);
  };

  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-6 md:px-8 py-6">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        <div>
          <p className="overline mb-1.5">{t("versions.overline")}</p>
          <h2 className="font-serif text-[17px] text-near-black">
            {t("versions.title")}
          </h2>
          <p className="mt-1 text-[12.5px] text-stone-gray">
            {versions.length > 0
              ? t("versions.count", { n: versions.length })
              : t("versions.empty")}
          </p>
        </div>
        <span className="text-[12px] text-stone-gray shrink-0 pt-2">
          {open ? t("versions.hide") : t("versions.show")}
        </span>
      </button>

      {open && (
        <div className="motion-slide-in-soft mt-5 space-y-4">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("versions.labelPlaceholder")}
              maxLength={80}
              className={inputClass + " flex-1"}
            />
            <button
              type="button"
              onClick={onSaveSnapshot}
              disabled={busy === "saving"}
              className="rounded-lg bg-terracotta text-ivory px-4 py-2 text-[13px] hover:bg-coral disabled:opacity-60 transition"
            >
              {busy === "saving" ? t("versions.saving") : t("versions.save")}
            </button>
          </div>

          {versions.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray leading-relaxed">
              {t("versions.hint")}
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-serif text-[14px] text-near-black truncate">
                      {v.label || t("versions.untitled")}
                    </p>
                    <p className="text-[11.5px] text-stone-gray mt-0.5">
                      {new Intl.DateTimeFormat("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(v.at))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(v.id)}
                    disabled={busy === v.id}
                    className="shrink-0 rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12px] hover:bg-border-cream disabled:opacity-60 transition"
                  >
                    {busy === v.id ? t("versions.restoring") : t("versions.restore")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p className="text-[12.5px] text-error">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

// react-pdf's browser build is heavy + client-only — load it on demand.
function LivePreviewLoading() {
  const t = useTranslations("editor");
  return (
    <div className="flex h-[72vh] items-center justify-center rounded-xl ring-1 ring-border-warm bg-white">
      <p className="text-[13px] text-stone-gray">{t("template.loadingPreview")}</p>
    </div>
  );
}

const LivePreview = dynamic(() => import("./LivePreview"), {
  ssr: false,
  loading: () => <LivePreviewLoading />,
});

const PREVIEW_DEBOUNCE_MS = 500;

function HistoryPanel({ resumeId }: { resumeId: string }) {
  const t = useTranslations("editor");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AiHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && items === null && !loading) {
      setLoading(true);
      const data = await listResumeAiHistory(resumeId);
      setItems(data);
      setLoading(false);
    }
  };

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-6 md:px-8 py-6">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        <div>
          <p className="overline mb-1.5">{t("history.title")}</p>
          <h2 className="font-serif text-[17px] text-near-black">
            {t("history.subtitle")}
          </h2>
        </div>
        <span className="text-[12px] text-stone-gray shrink-0 pt-2">
          {open ? t("history.toggleClose") : t("history.toggleOpen")}
        </span>
      </button>

      {open && (
        <div className="motion-slide-in-soft mt-5">
          {loading ? (
            <p className="text-[12.5px] text-stone-gray">
              {t("history.loading")}
            </p>
          ) : !items || items.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray leading-relaxed">
              {t("history.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const isOpen = expanded.has(it.id);
                return (
                  <li
                    key={it.id}
                    className="rounded-xl bg-white ring-1 ring-border-warm px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={
                            "shrink-0 rounded-md ring-1 px-2 py-0.5 text-[11px] " +
                            (it.kind === "cover"
                              ? "bg-terracotta/10 text-terracotta ring-terracotta/20"
                              : "bg-warm-sand text-charcoal-warm ring-border-warm")
                          }
                        >
                          {it.kind === "cover"
                            ? t("history.badgeCover")
                            : t("history.badgeInterview")}
                        </span>
                        <span className="text-[12px] text-stone-gray truncate">
                          {it.kind === "interview"
                            ? t("history.questionsCount", {
                                count: it.questions.length,
                              })
                            : it.text.slice(0, 28)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11.5px] text-stone-gray">
                          {fmt(it.at)}
                        </span>
                        {it.kind === "cover" && (
                          <button
                            type="button"
                            onClick={() => copy(it.id, it.text)}
                            className="text-[12px] text-terracotta hover:underline"
                          >
                            {copiedId === it.id
                              ? t("history.copied")
                              : t("history.copy")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(it.id)) n.delete(it.id);
                              else n.add(it.id);
                              return n;
                            })
                          }
                          className="text-[12px] text-stone-gray hover:text-near-black"
                        >
                          {isOpen ? t("history.hide") : t("history.view")}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-border-warm">
                        {it.kind === "cover" ? (
                          <pre className="font-serif text-[13px] leading-[1.8] text-near-black whitespace-pre-wrap break-words">
                            {it.text}
                          </pre>
                        ) : (
                          <ul className="space-y-2">
                            {it.questions.map((q, i) => (
                              <li key={i}>
                                <p className="text-[13px] text-near-black leading-snug">
                                  {q.question}
                                </p>
                                <p className="text-[12px] text-olive-gray leading-relaxed mt-0.5">
                                  {q.tip}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TemplatePanel({
  resumeId,
  initialTemplate,
  initialSectionOrder,
  control,
}: {
  resumeId: string;
  initialTemplate: TemplateId;
  initialSectionOrder: SectionKey[];
  control: Control<ResumeContent>;
}) {
  const t = useTranslations("editor");
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [order, setOrder] = useState<SectionKey[]>(initialSectionOrder);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [, startSave] = useTransition();

  // Subscribe to live form values here (not in the parent) so only this panel
  // re-renders while typing. Debounce before feeding the heavy PDF renderer.
  const liveValues = useWatch({ control });
  const liveContent = useMemo(
    () => parseResumeContent(liveValues),
    [liveValues],
  );
  const [debounced, setDebounced] = useState<ResumeContent>(liveContent);

  useEffect(() => {
    if (!previewOpen) return;
    const timer = setTimeout(
      () => setDebounced(liveContent),
      PREVIEW_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [liveContent, previewOpen]);

  // Page-count check (one-page discipline). Rendering a PDF server-side just to
  // count pages is expensive, so we DON'T re-run it on every keystroke — only
  // when the preview opens, the template/order changes, or the user asks.
  // Latest content is read from a ref so those triggers don't depend on it.
  const [pages, setPages] = useState<number | null>(null);
  const contentRef = useRef(debounced);
  useEffect(() => {
    contentRef.current = debounced;
  }, [debounced]);

  const checkPages = useCallback(async () => {
    const res = await getResumePageCount({
      content: contentRef.current,
      template,
      sectionOrder: order,
    });
    setPages("pages" in res ? res.pages : null);
  }, [template, order]);

  useEffect(() => {
    if (previewOpen) checkPages();
  }, [previewOpen, checkPages]);

  const choose = (id: TemplateId) => {
    if (id === template) return;
    setTemplate(id);
    // Persist the choice; export + share PDFs read it from the row.
    startSave(() => {
      setResumeTemplate(resumeId, id);
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startSave(() => {
      setResumeSectionOrder(resumeId, next);
    });
  };

  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-6 md:px-8 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="overline mb-1.5">{t("template.overline")}</p>
          <h2 className="font-serif text-[17px] text-near-black">
            {t("template.title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setDebounced(liveContent);
            setPreviewOpen((o) => !o);
          }}
          className="shrink-0 rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
        >
          {previewOpen ? t("template.hidePreview") : t("template.showPreview")}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {RESUME_TEMPLATES.map((tpl) => {
          const active = tpl.id === template;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => choose(tpl.id)}
              className={
                "rounded-2xl px-4 py-3 text-left ring-1 transition " +
                (active
                  ? "bg-parchment ring-terracotta"
                  : "bg-white ring-border-warm hover:ring-terracotta")
              }
            >
              <p className="font-serif text-[14.5px] text-near-black mb-0.5">
                {t(`template.${tpl.id}.name`)}
              </p>
              <p className="text-[11.5px] text-stone-gray leading-snug">
                {t(`template.${tpl.id}.desc`)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-[12px] text-olive-gray mb-2 tracking-wide">
          {t("template.orderHint")}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {order.map((key, i) => (
            <li
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white ring-1 ring-border-warm pl-3 pr-1.5 py-1"
            >
              <span className="text-[12.5px] text-charcoal-warm">
                {t(`section.${key}`)}
              </span>
              <span className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title={t("move.up")}
                  className="w-5 h-5 rounded text-[12px] text-stone-gray hover:bg-warm-sand hover:text-near-black disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  title={t("move.down")}
                  className="w-5 h-5 rounded text-[12px] text-stone-gray hover:bg-warm-sand hover:text-near-black disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {previewOpen && (
        <div className="motion-slide-in-soft mt-4">
          <LivePreview
            content={debounced}
            template={template}
            sectionOrder={order}
          />
          <div className="mt-2 flex items-center gap-2">
            {pages !== null && pages > 1 ? (
              <span className="rounded-lg bg-error/5 ring-1 ring-error/20 px-3 py-1.5 text-[12px] text-error">
                {t("pageCount.over", { pages })}
              </span>
            ) : pages === 1 ? (
              <span className="text-[12px] text-olive-gray">
                {t("pageCount.ok")}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => checkPages()}
              className="text-[12px] text-stone-gray hover:text-near-black transition"
            >
              {t("pageCount.recheck")}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-stone-gray">
              {t("template.previewNote")}
            </p>
            <a
              href={`/api/resumes/${resumeId}/pdf?template=${template}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[12px] text-terracotta hover:underline"
            >
              {t("template.openFull")}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

const SHARE_EXPIRY_OPTIONS: { days: number | null }[] = [
  { days: null },
  { days: 7 },
  { days: 30 },
];

function formatExpiry(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function SharePanel({
  resumeId,
  initial,
}: {
  resumeId: string;
  initial: ShareSnapshot;
}) {
  const t = useTranslations("editor");
  const [state, setState] = useState<ShareSnapshot>(initial);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState<number | null>(
    initial.expiresAt ? 7 : null,
  );
  const [passcode, setPasscode] = useState("");

  const url =
    state.enabled && state.token
      ? `${clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/r/${state.token}`
      : null;

  const run = (enabled: boolean, options?: Parameters<typeof setShareEnabled>[2]) => {
    setError(null);
    startTransition(async () => {
      const res = await setShareEnabled(resumeId, enabled, options);
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          enabled,
          token: res.token ?? prev.token,
          expiresAt: res.expiresAt,
          hasPasscode: res.hasPasscode,
        }));
        setPasscode("");
      } else {
        setError(res.error);
      }
    });
  };

  // First-time enable / re-enable carries the chosen expiry + passcode.
  const enableWithSettings = () =>
    run(true, {
      expiresInDays: expiryDays,
      passcode: passcode.trim() ? passcode : null,
    });

  // Re-apply settings on a live link; blank passcode keeps the existing one.
  const saveSettings = () =>
    run(true, {
      expiresInDays: expiryDays,
      ...(passcode.trim() ? { passcode } : {}),
    });

  const removePasscode = () => run(true, { passcode: null });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("share.copyError"));
    }
  };

  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-6 md:px-8 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="overline mb-1.5">{t("share.overline")}</p>
          <h2 className="font-serif text-[17px] text-near-black">
            {t("share.title")}
          </h2>
        </div>
        {state.enabled ? (
          <button
            type="button"
            onClick={() => run(false)}
            disabled={pending}
            className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition disabled:opacity-60"
          >
            {pending ? t("share.disabling") : t("share.disable")}
          </button>
        ) : null}
      </div>

      {state.enabled && url ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 rounded-lg bg-white ring-1 ring-border-warm px-3 py-2 text-[13px] text-near-black font-mono"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-warm-sand text-charcoal-warm px-3 py-2 text-[13px] hover:bg-border-cream transition"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-stone-gray">
              {state.expiresAt
                ? t("share.expiresOn", { date: formatExpiry(state.expiresAt) })
                : t("share.neverExpires")}
            </span>
            <span className="text-border-cream">·</span>
            {state.hasPasscode ? (
              <span className="inline-flex items-center gap-1 text-terracotta">
                {t("share.hasPasscode")}
                <button
                  type="button"
                  onClick={removePasscode}
                  disabled={pending}
                  className="text-stone-gray hover:text-error underline disabled:opacity-60"
                >
                  {t("share.removePasscode")}
                </button>
              </span>
            ) : (
              <span className="text-stone-gray">{t("share.noPasscode")}</span>
            )}
            <span className="text-border-cream">·</span>
            <span className="text-stone-gray">
              {state.viewCount > 0
                ? t("share.viewedCount", { count: state.viewCount }) +
                  (state.lastViewedAt
                    ? t("share.lastViewedSuffix", {
                        date: formatExpiry(state.lastViewedAt),
                      })
                    : "")
                : t("share.noViews")}
            </span>
          </div>

          <ShareSettings
            expiryDays={expiryDays}
            onExpiryChange={setExpiryDays}
            passcode={passcode}
            onPasscodeChange={setPasscode}
            hasPasscode={state.hasPasscode}
            pending={pending}
            onSave={saveSettings}
            saveLabel={t("share.updateSettings")}
          />

          <p className="text-[12px] text-stone-gray leading-relaxed">
            {t("share.liveHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-olive-gray leading-relaxed">
            {t("share.offHint")}
          </p>
          <ShareSettings
            expiryDays={expiryDays}
            onExpiryChange={setExpiryDays}
            passcode={passcode}
            onPasscodeChange={setPasscode}
            hasPasscode={false}
            pending={pending}
            onSave={enableWithSettings}
            saveLabel={pending ? t("share.generating") : t("share.generateLink")}
            primary
          />
        </div>
      )}

      {error ? (
        <p className="mt-2 text-[12.5px] text-error">{error}</p>
      ) : null}
    </section>
  );
}

function ShareSettings({
  expiryDays,
  onExpiryChange,
  passcode,
  onPasscodeChange,
  hasPasscode,
  pending,
  onSave,
  saveLabel,
  primary,
}: {
  expiryDays: number | null;
  onExpiryChange: (days: number | null) => void;
  passcode: string;
  onPasscodeChange: (v: string) => void;
  hasPasscode: boolean;
  pending: boolean;
  onSave: () => void;
  saveLabel: string;
  primary?: boolean;
}) {
  const t = useTranslations("editor");
  return (
    <div className="rounded-2xl bg-parchment ring-1 ring-border-warm px-4 py-4 space-y-3">
      <div>
        <p className="text-[12px] text-olive-gray mb-1.5 tracking-wide">
          {t("share.validity")}
        </p>
        <div className="flex gap-1.5">
          {SHARE_EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.days ?? "forever"}
              type="button"
              onClick={() => onExpiryChange(opt.days)}
              className={
                "rounded-lg px-3 py-1.5 text-[12.5px] ring-1 transition " +
                (expiryDays === opt.days
                  ? "bg-terracotta text-ivory ring-terracotta"
                  : "bg-white text-charcoal-warm ring-border-warm hover:ring-terracotta")
              }
            >
              {t(`share.expiry.${opt.days ?? "forever"}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[12px] text-olive-gray mb-1.5 tracking-wide">
          {t("share.passcodeLabel")}
        </p>
        <input
          value={passcode}
          onChange={(e) => onPasscodeChange(e.target.value)}
          placeholder={hasPasscode ? t("share.passcodeKeep") : t("share.passcodePlaceholder")}
          maxLength={12}
          className="w-full rounded-lg bg-white ring-1 ring-border-warm px-3 py-2 text-[13.5px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
        />
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className={
          "rounded-lg px-4 py-2 text-[13px] transition disabled:opacity-60 " +
          (primary
            ? "bg-terracotta text-ivory hover:bg-coral font-medium"
            : "bg-warm-sand text-charcoal-warm hover:bg-border-cream")
        }
      >
        {saveLabel}
      </button>
    </div>
  );
}

const INTERVIEW_CATEGORY: Record<
  InterviewQuestion["category"],
  { className: string }
> = {
  behavioral: {
    className: "bg-warm-sand text-charcoal-warm ring-border-warm",
  },
  technical: {
    className: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  },
  project: {
    className: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  },
  fit: {
    className: "bg-warm-sand text-charcoal-warm ring-border-warm",
  },
};

function InterviewPanel({
  state,
  jd,
  onJdChange,
  onSubmit,
  onReset,
  onDismiss,
}: {
  state: Exclude<InterviewState, { kind: "idle" }>;
  jd: string;
  onJdChange: (v: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("editor");
  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-5 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">{t("interview.overline")}</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "input"
              ? t("interview.inputTitle")
              : state.kind === "running"
                ? t("interview.runningTitle")
                : state.kind === "result"
                  ? t("interview.resultTitle", {
                      n: state.data.questions.length,
                    })
                  : t("interview.errorTitle")}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "result" && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
            >
              {t("interview.changeJd")}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            {t("panel.hide")}
          </button>
        </div>
      </div>

      {state.kind === "input" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              {t("interview.jdLabel")}
            </label>
            <textarea
              value={jd}
              onChange={(e) => onJdChange(e.target.value)}
              rows={5}
              placeholder={t("interview.jdPlaceholder")}
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-xl bg-terracotta text-ivory px-5 py-2 text-[13.5px] font-medium hover:bg-coral transition"
            >
              {t("interview.predict")}
            </button>
          </div>
        </div>
      )}

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          {t("interview.runningHint")}
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-[13.5px] text-error leading-relaxed">
          {state.message}
        </p>
      )}

      {state.kind === "result" && (
        <ul className="space-y-3">
          {state.data.questions.map((q, i) => {
            const cat = INTERVIEW_CATEGORY[q.category];
            return (
              <li
                key={i}
                className="rounded-2xl bg-white ring-1 ring-border-warm px-5 py-4"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded-md ring-1 px-2 py-0.5 text-[11px] ${cat.className}`}
                  >
                    {t(`interview.cat.${q.category}`)}
                  </span>
                  <p className="font-serif text-[15px] text-near-black leading-snug">
                    {q.question}
                  </p>
                </div>
                <p className="text-[12.5px] text-stone-gray leading-relaxed mb-1.5">
                  {t("interview.probe", { probe: q.probe })}
                </p>
                <div className="rounded-xl bg-parchment px-4 py-2.5">
                  <p className="text-[11px] text-terracotta tracking-wide mb-1">
                    {t("interview.howToAnswer")}
                  </p>
                  <p className="text-[13px] text-olive-gray leading-relaxed">
                    {q.tip}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TargetRolePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("editor");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {jobsSection.categories.map((cat) => {
          const active = value.trim() === cat.name;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onChange(active ? "" : cat.name)}
              className={
                "rounded-full px-3.5 py-1.5 text-[12.5px] ring-1 transition-all duration-200 " +
                (active
                  ? "bg-terracotta text-ivory ring-terracotta shadow-[0_6px_18px_-12px_rgba(201,100,66,0.8)]"
                  : "bg-white text-charcoal-warm ring-border-warm hover:ring-terracotta hover:text-near-black")
              }
            >
              {t(`jobs.${cat.key}`)}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("targetRole.placeholder")}
        className={inputClass}
      />
    </div>
  );
}

const DIMENSION_KEYS = [
  "structure",
  "jobMatch",
  "professionalTone",
  "outcome",
  "conciseness",
] as const;

const severityOrder: Record<CheckupIssue["severity"], number> = {
  critical: 0,
  moderate: 1,
  suggestion: 2,
};

const severityStyle: Record<CheckupIssue["severity"], { className: string }> = {
  critical: {
    className: "bg-error/10 text-error ring-error/20",
  },
  moderate: {
    className: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  },
  suggestion: {
    className: "bg-warm-sand text-charcoal-warm ring-border-warm",
  },
};

function CheckupPanel({
  state,
  onDismiss,
  onRerun,
}: {
  state: Exclude<CheckupState, { kind: "idle" }>;
  onDismiss: () => void;
  onRerun: () => void;
}) {
  const t = useTranslations("editor");
  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-5 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">{t("checkup.overline")}</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "running"
              ? t("checkup.runningTitle")
              : state.kind === "error"
                ? t("checkup.errorTitle")
                : t("checkup.resultTitle")}
          </h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {state.kind === "result" && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
            >
              {t("checkup.rerun")}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            {t("panel.hide")}
          </button>
        </div>
      </div>

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          {t("checkup.runningHint")}
        </p>
      )}

      {state.kind === "error" && (
        <p className="text-[13.5px] text-error leading-relaxed">
          {state.message}
        </p>
      )}

      {state.kind === "result" && <CheckupReport data={state.data} />}
    </section>
  );
}

function CheckupReport({ data }: { data: CheckupResult }) {
  const t = useTranslations("editor");
  const sortedIssues = [...data.issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 items-start">
        <div className="flex flex-col items-center">
          <span className="font-serif text-[44px] sm:text-[52px] leading-none text-near-black">
            {data.overallScore}
          </span>
          <span className="text-[11px] text-stone-gray mt-1 tracking-wide">
            {t("checkup.scoreCaption")}
          </span>
        </div>
        <p className="text-[13.5px] sm:text-[14px] text-charcoal-warm leading-relaxed pt-1">
          {data.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {DIMENSION_KEYS.map((key) => {
          const score = data.dimensionScores[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] text-olive-gray">
                  {t(`checkup.dim.${key}`)}
                </span>
                <span className="text-[13px] text-near-black tabular-nums">
                  {score}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-warm-sand overflow-hidden">
                <div
                  className="h-full bg-terracotta rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sortedIssues.length > 0 && (
        <div>
          <p className="text-[12.5px] text-olive-gray tracking-wide mb-3">
            {t("checkup.issuesCount", { n: sortedIssues.length })}
          </p>
          <ul className="space-y-3">
            {sortedIssues.map((issue, i) => {
              const sev = severityStyle[issue.severity];
              const dim = (DIMENSION_KEYS as readonly string[]).includes(
                issue.dimension,
              )
                ? t(`checkup.dim.${issue.dimension}`)
                : issue.dimension;
              return (
                <li
                  key={i}
                  className="rounded-2xl bg-white ring-1 ring-border-warm px-5 py-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`rounded-md ring-1 px-2 py-0.5 text-[11px] font-medium ${sev.className}`}
                    >
                      {t(`checkup.sev.${issue.severity}`)}
                    </span>
                    <span className="text-[11.5px] text-stone-gray">
                      {dim}
                    </span>
                    {issue.section && (
                      <span className="text-[11.5px] text-stone-gray">
                        · {issue.section}
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-[14.5px] text-near-black mb-1.5 leading-snug">
                    {issue.title}
                  </p>
                  <p className="text-[13px] text-olive-gray leading-relaxed">
                    {issue.detail}
                  </p>
                  {issue.suggestedRewrite && (
                    <div className="mt-3 rounded-xl bg-parchment px-4 py-2.5">
                      <p className="text-[11px] text-terracotta tracking-wide mb-1">
                        {t("checkup.suggestedRewrite")}
                      </p>
                      <p className="text-[13px] text-near-black leading-relaxed">
                        {issue.suggestedRewrite}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
