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
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  SECTION_LABELS,
  type SectionKey,
} from "@/lib/resume/sections";
import {
  generateCoverLetter,
  rewriteHighlight,
  runResumeCheckup,
  runResumeMatch,
} from "@/app/actions/ai";
import { clientEnv } from "@/lib/env";
import type {
  CheckupIssue,
  CheckupResult,
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
  plan: string;
  unlimited: boolean;
};

type ShareSnapshot = {
  enabled: boolean;
  token: string | null;
  expiresAt: string | null;
  hasPasscode: boolean;
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

  const canRewrite =
    quota.unlimited || quota.rewriteUsed < quota.rewriteLimit;
  const canCheckup =
    quota.unlimited || quota.checkupUsed < quota.checkupLimit;
  const canMatch =
    quota.unlimited || quota.matchUsed < quota.matchLimit;
  const canCover =
    quota.unlimited || quota.coverLetterUsed < quota.coverLetterLimit;
  const matchRemaining = quota.matchLimit - quota.matchUsed;
  const coverRemaining = quota.coverLetterLimit - quota.coverLetterUsed;

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
    if (!confirm("确认删除这份简历吗？无法恢复。")) return;
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
        message: `本月 AI 体检已用完（${quota.checkupUsed} / ${quota.checkupLimit}）。下月 1 号重置。`,
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
          <p className="overline mb-1 md:mb-1.5">编辑 · 简历</p>
          <h1 className="font-serif text-[18px] md:text-[22px] leading-tight text-near-black">
            写下你的经历
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
                ? `本月体检已用完（${quota.checkupUsed} / ${quota.checkupLimit}）`
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
              ? "体检中…"
              : checkup.kind === "result"
                ? `体检 · ${checkup.data.overallScore} 分`
                : !canCheckup
                  ? "本月已满"
                  : "体检"}
          </button>
          {canMatch ? (
            <button
              type="button"
              onClick={onMatchButtonClick}
              disabled={match.kind === "running"}
              title={
                quota.unlimited
                  ? undefined
                  : `免费试用 · 本月还剩 ${matchRemaining} 次`
              }
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream disabled:opacity-60 disabled:cursor-wait transition"
            >
              {match.kind === "running"
                ? "匹配中…"
                : quota.unlimited
                  ? "匹配 JD"
                  : `匹配 JD · 剩 ${matchRemaining}`}
            </button>
          ) : (
            <Link
              href="/billing/start"
              title="免费额度已用完 · 点击升级 Pro 不限次"
              className="rounded-lg bg-warm-sand/60 px-3 py-1.5 text-[13px] text-stone-gray hover:bg-warm-sand hover:text-charcoal-warm transition"
            >
              匹配 JD · Pro
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
                  : `免费试用 · 本月还剩 ${coverRemaining} 次`
              }
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[13px] text-charcoal-warm hover:bg-border-cream disabled:opacity-60 disabled:cursor-wait transition"
            >
              {cover.kind === "running"
                ? "写信中…"
                : quota.unlimited
                  ? "求职信"
                  : `求职信 · 剩 ${coverRemaining}`}
            </button>
          ) : (
            <Link
              href="/billing/start"
              title="免费额度已用完 · 点击升级 Pro 不限次"
              className="rounded-lg bg-warm-sand/60 px-3 py-1.5 text-[13px] text-stone-gray hover:bg-warm-sand hover:text-charcoal-warm transition"
            >
              求职信 · Pro
            </Link>
          )}
          <ExportDropdown resumeId={resumeId} canEnglish={canMatch} />
        </div>
      </header>

      <Section title="目标岗位">
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
          点下面的标签直接填入，或者在输入框里写得更具体（例如「前端工程师 · React 方向」）。
          留空会按「通用」方向写。
        </p>
      </Section>

      <Section title="基本信息">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="姓名">
            <input
              {...register("basicInfo.name")}
              placeholder="你的名字"
              className={inputClass}
            />
          </Field>
          <Field label="职业定位（一句话）">
            <input
              {...register("basicInfo.headline")}
              placeholder="前端工程师 / 产品经理实习生 ..."
              className={inputClass}
            />
          </Field>
          <Field label="邮箱">
            <input
              {...register("basicInfo.email")}
              type="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <Field label="手机">
            <input
              {...register("basicInfo.phone")}
              placeholder="+86 ..."
              className={inputClass}
            />
          </Field>
          <Field label="所在地">
            <input
              {...register("basicInfo.location")}
              placeholder="城市"
              className={inputClass}
            />
          </Field>
          <Field label="作品集 / 主页">
            <input
              {...register("basicInfo.portfolioUrl")}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
          <Field label="GitHub">
            <input
              {...register("basicInfo.github")}
              placeholder="https://github.com/你的用户名"
              className={inputClass}
            />
          </Field>
          <Field label="LinkedIn">
            <input
              {...register("basicInfo.linkedin")}
              placeholder="https://linkedin.com/in/你的用户名"
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="个人简介">
        <textarea
          {...register("summary")}
          rows={4}
          placeholder="两三句话写下你是谁、想找什么工作。"
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </Section>

      <Section
        title="经历"
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
                + {experienceKindLabels[kind]}
              </button>
            ))}
          </div>
        }
      >
        {experiencesField.fields.length === 0 ? (
          <EmptyRow text="还没有添加经历。从上面的按钮开始——教育、项目、实习都可以。" />
        ) : (
          <ul className="space-y-3">
            {experiencesField.fields.map((field, index) => {
              const isCollapsed = collapsed.has(field.id);
              const live = watch(`experiences.${index}`);
              const title = live?.title || "（未命名）";
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
                        {experienceKindLabels[field.kind as ExperienceKind]}
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
                        title="上移"
                        disabled={index === 0}
                        onClick={() => experiencesField.move(index, index - 1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        title="下移"
                        disabled={index === experiencesField.fields.length - 1}
                        onClick={() => experiencesField.move(index, index + 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        title={isCollapsed ? "展开" : "收起"}
                        onClick={() => toggleCollapse(field.id)}
                      >
                        {isCollapsed ? "＋" : "−"}
                      </IconButton>
                      <IconButton
                        title="删除"
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
                        <Field label="标题">
                          <input
                            {...register(`experiences.${index}.title`)}
                            placeholder="项目 / 学校 / 公司名称"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="组织 / 机构">
                          <input
                            {...register(`experiences.${index}.org`)}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="角色">
                          <input
                            {...register(`experiences.${index}.role`)}
                            placeholder="主导 / 负责 / 成员 ..."
                            className={inputClass}
                          />
                        </Field>
                        <Field label="地点">
                          <input
                            {...register(`experiences.${index}.location`)}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="开始">
                          <input
                            {...register(`experiences.${index}.startDate`)}
                            placeholder="2024.09"
                            className={inputClass}
                          />
                        </Field>
                        <Field label="结束">
                          <input
                            {...register(`experiences.${index}.endDate`)}
                            placeholder="至今 / 2025.06"
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
        title="技能"
        actions={
          <button
            type="button"
            onClick={() =>
              skillsField.append({ id: newId(), category: "", items: [] })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            + 新增类别
          </button>
        }
      >
        {skillsField.fields.length === 0 ? (
          <EmptyRow text="例如：编程语言、框架、工具。每类一行。" />
        ) : (
          <ul className="space-y-3">
            {skillsField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`skills.${index}.category`)}
                  placeholder="类别"
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
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="获奖荣誉"
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
            + 新增一条
          </button>
        }
      >
        {awardsField.fields.length === 0 ? (
          <EmptyRow text="奖学金、比赛名次、荣誉称号——写上时间、标题和颁发机构。" />
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
                  placeholder="标题（如 XCTF 全国第 5 名）"
                  className={`${inputClass} flex-1`}
                />
                <input
                  {...register(`awards.${index}.issuer`)}
                  placeholder="颁发机构"
                  className={`${inputClass} w-44`}
                />
                <button
                  type="button"
                  onClick={() => awardsField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="证书"
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
            + 新增一条
          </button>
        }
      >
        {certificationsField.fields.length === 0 ? (
          <EmptyRow text="CET-6、AWS、CKA 等——时间、名称、颁发机构（可选）。" />
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
                  placeholder="证书名称（如 OSCP）"
                  className={`${inputClass} flex-1`}
                />
                <input
                  {...register(`certifications.${index}.issuer`)}
                  placeholder="颁发机构（可留空）"
                  className={`${inputClass} w-44`}
                />
                <button
                  type="button"
                  onClick={() => certificationsField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="语言能力"
        actions={
          <button
            type="button"
            onClick={() =>
              languagesField.append({ id: newId(), name: "", level: "" })
            }
            className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12.5px] text-charcoal-warm hover:bg-border-cream transition"
          >
            + 新增一条
          </button>
        }
      >
        {languagesField.fields.length === 0 ? (
          <EmptyRow text="例如：英语 · CET-6 / 雅思 7.0；日语 · N2。语言 + 水平各一行。" />
        ) : (
          <ul className="space-y-2">
            {languagesField.fields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-xl bg-ivory ring-1 ring-border-warm px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <input
                  {...register(`languages.${index}.name`)}
                  placeholder="语言（如 英语）"
                  className={`${inputClass} w-40`}
                />
                <input
                  {...register(`languages.${index}.level`)}
                  placeholder="水平（如 CET-6 · 流利读写）"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => languagesField.remove(index)}
                  className="text-[12px] text-stone-gray hover:text-error transition shrink-0"
                >
                  删除
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

      <TemplatePanel
        resumeId={resumeId}
        initialTemplate={initialTemplate}
        initialSectionOrder={initialSectionOrder}
        control={control}
      />

      <SharePanel resumeId={resumeId} initial={initialShare} />

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
            {isDeleting ? "删除中…" : "删除这份简历"}
          </button>
          <button
            type="button"
            onClick={onClone}
            disabled={isCloning}
            className="text-[13px] text-stone-gray hover:text-near-black disabled:opacity-50 transition"
            title="基于这份内容复制一份，用来针对不同岗位改写"
          >
            {isCloning ? "克隆中…" : "克隆成新版本"}
          </button>
        </div>
        <p className="text-[12px] text-stone-gray">
          Cmd / Ctrl + S 立即保存
        </p>
      </footer>
    </form>
  );
}

function dateRange(start?: string, end?: string) {
  if (!start && !end) return "";
  return `${start ?? ""} – ${end ?? ""}`.trim();
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: `experiences.${nestIndex}.highlights` as never,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] text-olive-gray">亮点 / 产出</span>
        <button
          type="button"
          onClick={() => append("" as never)}
          className="text-[12px] text-terracotta hover:underline"
        >
          + 新增一条
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="text-[12.5px] text-stone-gray">
          每一条写一句话——用动词开头，尽量带上数字和具体结果。
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
  const [rewrite, setRewrite] = useState<RewriteState>({ kind: "idle" });

  const fieldPath =
    `experiences.${nestIndex}.highlights.${highlightIndex}` as const;

  const triggerRewrite = async () => {
    const current = getValues(fieldPath) ?? "";
    if (!current.trim()) {
      setRewrite({ kind: "error", message: "先写一句再改写" });
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
      setRewrite({ kind: "error", message: "本月 AI 改写已用完" });
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
          placeholder="主导了什么 / 做出了什么 / 带来了什么结果"
        />
        <div className="pt-1 flex flex-col gap-1 items-center">
          <button
            type="button"
            onClick={triggerRewrite}
            disabled={rewrite.kind === "loading" || !canRewrite}
            title={canRewrite ? "AI 改写这一条" : "本月 AI 改写已用完"}
            className={
              "text-[11px] disabled:opacity-50 disabled:cursor-not-allowed " +
              (canRewrite
                ? "text-terracotta hover:underline disabled:cursor-wait"
                : "text-stone-gray")
            }
          >
            {rewrite.kind === "loading"
              ? "改写中…"
              : !canRewrite
                ? "已满"
                : "✨ 改写"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="删除这一条"
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
  return (
    <div className="motion-slide-in-soft ml-4 rounded-2xl bg-parchment ring-1 ring-border-warm px-4 py-4 space-y-3">
      <div>
        <p className="text-[11px] text-stone-gray mb-1 tracking-wide">原文</p>
        <p className="text-[13px] text-olive-gray leading-relaxed line-through decoration-stone-gray/60">
          {block.original}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-terracotta mb-1 tracking-wide">
          AI 改写
        </p>
        <p className="text-[13.5px] text-near-black leading-relaxed">
          {block.rewritten}
        </p>
      </div>
      {block.reasons.length > 0 && (
        <div>
          <p className="text-[11px] text-stone-gray mb-1 tracking-wide">
            为什么这样改
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
            保留的事实
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
          采用
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
        >
          放弃
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
        + 添加
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
      <div className="flex items-center justify-between mb-4">
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
  if (state.kind === "idle") {
    return <span className="text-[12.5px] text-stone-gray">等待输入</span>;
  }
  if (state.kind === "dirty") {
    return (
      <span className="text-[12.5px] text-olive-gray flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-olive-gray animate-pulse" />
        编辑中
      </span>
    );
  }
  if (state.kind === "saving") {
    return (
      <span className="text-[12.5px] text-olive-gray flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
        保存中…
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="text-[12.5px] text-olive-gray">
        已保存 · {formatTime(state.at)}
      </span>
    );
  }
  return (
    <span className="text-[12.5px] text-error">保存失败：{state.message}</span>
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
  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">岗位匹配</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "input"
              ? "贴一段 JD，对比一下"
              : state.kind === "running"
                ? "正在比对 JD 和简历…"
                : state.kind === "result"
                  ? `匹配度 · ${state.data.overallScore} 分`
                  : "匹配失败"}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "result" && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
            >
              换一份 JD
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            收起
          </button>
        </div>
      </div>

      {state.kind === "input" && (
        <div className="space-y-3">
          <textarea
            value={jd}
            onChange={(e) => onJdChange(e.target.value)}
            rows={8}
            placeholder="把目标岗位的职位描述整段粘进来——职责、要求、加分项都带上。"
            className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
          />
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-stone-gray">
              {jd.trim().length < 40
                ? `还差 ${Math.max(0, 40 - jd.trim().length)} 个字开始分析`
                : `${jd.trim().length} 字，够了`}
            </p>
            <button
              type="button"
              onClick={onSubmit}
              disabled={jd.trim().length < 40}
              className="rounded-xl bg-terracotta text-ivory px-5 py-2 text-[13.5px] font-medium hover:bg-coral disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              开始分析
            </button>
          </div>
        </div>
      )}

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          AI 正在抽取 JD 关键词、逐项核对简历，一般 10-20 秒。
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
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 items-start">
        <div className="flex flex-col items-center">
          <span className="font-serif text-[44px] sm:text-[52px] leading-none text-near-black">
            {data.overallScore}
          </span>
          <span className="text-[11px] text-stone-gray mt-1 tracking-wide">
            匹配度 · 满分 100
          </span>
        </div>
        <p className="text-[13.5px] sm:text-[14px] text-charcoal-warm leading-relaxed pt-1">
          {data.summary}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {([
          ["skills", "技能"],
          ["experience", "经历"],
          ["tone", "语气"],
        ] as const).map(([key, label]) => {
          const score = data.dimensionScores[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] text-olive-gray">{label}</span>
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
            命中关键词（{data.matchedKeywords.length}）
          </p>
          {data.matchedKeywords.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray">（无）</p>
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
            缺失关键词（{data.missingKeywords.length}）
          </p>
          {data.missingKeywords.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray">（无）</p>
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
            针对性建议（{data.suggestions.length}）
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
                      可以加进经历的一条
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
        导出 PDF ▾
      </button>
      {open && (
        <div className="motion-slide-in-soft absolute right-0 top-full mt-1 min-w-[180px] rounded-xl bg-white ring-1 ring-border-warm shadow-[0_12px_32px_-16px_rgba(20,20,19,0.18)] py-1 z-30">
          <a
            href={`/api/resumes/${resumeId}/pdf`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-[13px] text-near-black hover:bg-parchment transition"
          >
            中文版
          </a>
          {canEnglish ? (
            <a
              href={`/api/resumes/${resumeId}/pdf?lang=en`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[13px] text-near-black hover:bg-parchment transition"
            >
              English version
            </a>
          ) : (
            <Link
              href="/billing/start"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[13px] text-stone-gray hover:bg-parchment transition"
            >
              English · Pro 专属
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
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">求职信</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "input"
              ? "写一封打动 HR 的求职信"
              : state.kind === "running"
                ? "AI 正在把你的经历变成一封信…"
                : state.kind === "result"
                  ? "这是 AI 写的版本"
                  : "求职信生成失败"}
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
                {copied ? "已复制" : "复制"}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
              >
                再生成
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            收起
          </button>
        </div>
      </div>

      {state.kind === "input" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              岗位描述（可选，贴了信会更贴岗位）
            </label>
            <textarea
              value={jd}
              onChange={(e) => onJdChange(e.target.value)}
              rows={5}
              placeholder="把目标岗位的 JD 粘进来；不贴也行，AI 会按你的「目标岗位」写通用信。"
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
            />
          </div>
          <div>
            <label className="block text-[12px] text-olive-gray mb-1.5 tracking-wide">
              补充说明（可选）
            </label>
            <textarea
              value={extra}
              onChange={(e) => onExtraChange(e.target.value)}
              rows={2}
              placeholder="例如「公司叫 Anthropic」「招聘经理叫 Karen」「我想强调我对 AI 安全的兴趣」"
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-3 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-xl bg-terracotta text-ivory px-5 py-2 text-[13.5px] font-medium hover:bg-coral transition"
            >
              生成求职信
            </button>
          </div>
        </div>
      )}

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          AI 正在综合简历里最打动人的经历，组织成 300-400 字的信。10-20 秒。
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
    if (!confirm("恢复后当前内容会被替换，当前版本会自动保存进历史。继续吗？")) {
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
          <p className="overline mb-1.5">版本历史</p>
          <h2 className="font-serif text-[17px] text-near-black">
            想改之前先存一版
          </h2>
          <p className="mt-1 text-[12.5px] text-stone-gray">
            {versions.length > 0
              ? `已有 ${versions.length} 个快照`
              : "还没有快照，随时点开保存一份"}
          </p>
        </div>
        <span className="text-[12px] text-stone-gray shrink-0 pt-2">
          {open ? "收起 −" : "展开 +"}
        </span>
      </button>

      {open && (
        <div className="motion-slide-in-soft mt-5 space-y-4">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="版本标签（可选，如「投前端版」）"
              maxLength={80}
              className={inputClass + " flex-1"}
            />
            <button
              type="button"
              onClick={onSaveSnapshot}
              disabled={busy === "saving"}
              className="rounded-lg bg-terracotta text-ivory px-4 py-2 text-[13px] hover:bg-coral disabled:opacity-60 transition"
            >
              {busy === "saving" ? "保存中…" : "保存为版本"}
            </button>
          </div>

          {versions.length === 0 ? (
            <p className="text-[12.5px] text-stone-gray leading-relaxed">
              保存后这里会列出所有快照。点「恢复」把内容回到那个时间点——
              恢复前当前内容会自动存一份，所以随时可以撤回来。
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
                      {v.label || "未命名快照"}
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
                    {busy === v.id ? "恢复中…" : "恢复"}
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
const LivePreview = dynamic(() => import("./LivePreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[72vh] items-center justify-center rounded-xl ring-1 ring-border-warm bg-white">
      <p className="text-[13px] text-stone-gray">正在加载预览引擎…</p>
    </div>
  ),
});

const PREVIEW_DEBOUNCE_MS = 500;

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
    const t = setTimeout(() => setDebounced(liveContent), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [liveContent, previewOpen]);

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
          <p className="overline mb-1.5">外观</p>
          <h2 className="font-serif text-[17px] text-near-black">
            选一个模板，实时看导出效果
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
          {previewOpen ? "收起预览" : "实时预览"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
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
                {tpl.name}
              </p>
              <p className="text-[11.5px] text-stone-gray leading-snug">
                {tpl.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-[12px] text-olive-gray mb-2 tracking-wide">
          模块顺序（标题区始终在最前；空模块不会出现在导出里）
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {order.map((key, i) => (
            <li
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white ring-1 ring-border-warm pl-3 pr-1.5 py-1"
            >
              <span className="text-[12.5px] text-charcoal-warm">
                {SECTION_LABELS[key]}
              </span>
              <span className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="上移"
                  className="w-5 h-5 rounded text-[12px] text-stone-gray hover:bg-warm-sand hover:text-near-black disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  title="下移"
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
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-stone-gray">
              边改边看 · 预览用轻量字体，极少数生僻字可能不显示，导出 PDF 不受影响。
            </p>
            <a
              href={`/api/resumes/${resumeId}/pdf?template=${template}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[12px] text-terracotta hover:underline"
            >
              用完整字体打开 ↗
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

const SHARE_EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: "永久", days: null },
  { label: "7 天", days: 7 },
  { label: "30 天", days: 30 },
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
        setState({
          enabled,
          token: res.token ?? state.token,
          expiresAt: res.expiresAt,
          hasPasscode: res.hasPasscode,
        });
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
      setError("复制失败，请手动选中链接");
    }
  };

  return (
    <section className="rounded-3xl bg-ivory ring-1 ring-border-warm px-6 md:px-8 py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="overline mb-1.5">分享这份简历</p>
          <h2 className="font-serif text-[17px] text-near-black">
            给 HR 一个链接，而不是一份附件
          </h2>
        </div>
        {state.enabled ? (
          <button
            type="button"
            onClick={() => run(false)}
            disabled={pending}
            className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition disabled:opacity-60"
          >
            {pending ? "处理中…" : "关闭分享"}
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
              {copied ? "已复制" : "复制"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-stone-gray">
              {state.expiresAt
                ? `${formatExpiry(state.expiresAt)} 过期`
                : "永久有效"}
            </span>
            <span className="text-border-cream">·</span>
            {state.hasPasscode ? (
              <span className="inline-flex items-center gap-1 text-terracotta">
                已设访问码
                <button
                  type="button"
                  onClick={removePasscode}
                  disabled={pending}
                  className="text-stone-gray hover:text-error underline disabled:opacity-60"
                >
                  移除
                </button>
              </span>
            ) : (
              <span className="text-stone-gray">无访问码</span>
            )}
          </div>

          <ShareSettings
            expiryDays={expiryDays}
            onExpiryChange={setExpiryDays}
            passcode={passcode}
            onPasscodeChange={setPasscode}
            hasPasscode={state.hasPasscode}
            pending={pending}
            onSave={saveSettings}
            saveLabel="更新设置"
          />

          <p className="text-[12px] text-stone-gray leading-relaxed">
            拿到链接的人能查看你最新版本的 PDF；设了访问码则需先输入。编辑会在约
            1 分钟内同步过去。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-olive-gray leading-relaxed">
            开启后生成一个只读链接，对方不需要登录。可以设过期时间和访问码，随时关闭。
          </p>
          <ShareSettings
            expiryDays={expiryDays}
            onExpiryChange={setExpiryDays}
            passcode={passcode}
            onPasscodeChange={setPasscode}
            hasPasscode={false}
            pending={pending}
            onSave={enableWithSettings}
            saveLabel={pending ? "生成中…" : "生成分享链接"}
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
  return (
    <div className="rounded-2xl bg-parchment ring-1 ring-border-warm px-4 py-4 space-y-3">
      <div>
        <p className="text-[12px] text-olive-gray mb-1.5 tracking-wide">
          有效期
        </p>
        <div className="flex gap-1.5">
          {SHARE_EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onExpiryChange(opt.days)}
              className={
                "rounded-lg px-3 py-1.5 text-[12.5px] ring-1 transition " +
                (expiryDays === opt.days
                  ? "bg-terracotta text-ivory ring-terracotta"
                  : "bg-white text-charcoal-warm ring-border-warm hover:ring-terracotta")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[12px] text-olive-gray mb-1.5 tracking-wide">
          访问码（可选）
        </p>
        <input
          value={passcode}
          onChange={(e) => onPasscodeChange(e.target.value)}
          placeholder={hasPasscode ? "留空保持不变，输入则更新" : "例如 4-6 位数字"}
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

function TargetRolePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
              {cat.name}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="或者写得更具体，例如「前端工程师 · React 方向」"
        className={inputClass}
      />
    </div>
  );
}

const dimensionLabels: Record<keyof CheckupResult["dimensionScores"], string> =
  {
    structure: "结构",
    jobMatch: "岗位匹配",
    professionalTone: "专业语气",
    outcome: "产出描述",
    conciseness: "简洁度",
  };

const severityOrder: Record<CheckupIssue["severity"], number> = {
  critical: 0,
  moderate: 1,
  suggestion: 2,
};

const severityStyle: Record<
  CheckupIssue["severity"],
  { label: string; className: string }
> = {
  critical: {
    label: "需要修改",
    className: "bg-error/10 text-error ring-error/20",
  },
  moderate: {
    label: "可以更好",
    className: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  },
  suggestion: {
    label: "建议",
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
  return (
    <section className="motion-slide-in-soft rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="overline mb-1.5">AI 体检报告</p>
          <h2 className="font-serif text-[20px] text-near-black">
            {state.kind === "running"
              ? "正在读你的简历，别走开…"
              : state.kind === "error"
                ? "体检失败"
                : "这份简历的五项打分"}
          </h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {state.kind === "result" && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded-lg bg-warm-sand text-charcoal-warm px-3 py-1.5 text-[12.5px] hover:bg-border-cream transition"
            >
              重新体检
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg text-stone-gray px-2.5 py-1.5 text-[12.5px] hover:text-near-black transition"
          >
            收起
          </button>
        </div>
      </div>

      {state.kind === "running" && (
        <p className="text-[13.5px] text-olive-gray leading-relaxed">
          DeepSeek 正在按 5 个维度通读你的简历，一般 10-20 秒。
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
            总分 · 满分 100
          </span>
        </div>
        <p className="text-[13.5px] sm:text-[14px] text-charcoal-warm leading-relaxed pt-1">
          {data.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {(Object.keys(dimensionLabels) as Array<
          keyof CheckupResult["dimensionScores"]
        >).map((key) => {
          const score = data.dimensionScores[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] text-olive-gray">
                  {dimensionLabels[key]}
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
            共 {sortedIssues.length} 条建议（按严重度排序）
          </p>
          <ul className="space-y-3">
            {sortedIssues.map((issue, i) => {
              const sev = severityStyle[issue.severity];
              const dim = dimensionLabels[
                issue.dimension as keyof typeof dimensionLabels
              ] ?? issue.dimension;
              return (
                <li
                  key={i}
                  className="rounded-2xl bg-white ring-1 ring-border-warm px-5 py-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`rounded-md ring-1 px-2 py-0.5 text-[11px] font-medium ${sev.className}`}
                    >
                      {sev.label}
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
                        可以这样写
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
