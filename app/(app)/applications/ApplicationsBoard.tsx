"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createJobTarget,
  deleteJobTarget,
  updateJobTarget,
} from "@/app/actions/applications";
import { APPLICATION_STATUSES } from "@/lib/applications";

export type ResumeOption = { id: string; label: string };

type Item = {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: string;
  notes: string;
  resumeId: string | null;
  updatedAt: string;
};

type Draft = Omit<Item, "id" | "updatedAt">;

const STATUS_STYLE: Record<string, string> = {
  saved: "bg-warm-sand text-charcoal-warm ring-border-warm",
  applied: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  interviewing: "bg-terracotta/10 text-terracotta ring-terracotta/20",
  offer: "bg-terracotta text-ivory ring-terracotta",
  rejected: "bg-border-cream text-stone-gray ring-border-warm",
};

const emptyDraft = (): Draft => ({
  company: "",
  role: "",
  jobUrl: "",
  status: "saved",
  notes: "",
  resumeId: null,
});

export function ApplicationsBoard({
  initialItems,
  resumes,
}: {
  initialItems: Item[];
  resumes: ResumeOption[];
}) {
  const t = useTranslations("applications");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-stone-gray">
          {t("count", { count: items.length })}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-xl bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral transition"
          >
            {t("add")}
          </button>
        )}
      </div>

      {adding && (
        <ApplicationForm
          resumes={resumes}
          initial={emptyDraft()}
          onCancel={() => setAdding(false)}
          onSave={async (draft) => {
            const res = await createJobTarget(draft);
            if (res.ok) {
              setItems((prev) => [
                {
                  id: res.id,
                  ...draft,
                  updatedAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setAdding(false);
            }
          }}
        />
      )}

      {items.length === 0 && !adding ? (
        <div className="rounded-2xl bg-ivory/60 ring-1 ring-dashed ring-border-warm px-6 py-10 text-center">
          <p className="text-[13.5px] text-stone-gray leading-relaxed">
            {t("empty")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) =>
            editingId === it.id ? (
              <li key={it.id}>
                <ApplicationForm
                  resumes={resumes}
                  initial={it}
                  onCancel={() => setEditingId(null)}
                  onSave={async (draft) => {
                    const res = await updateJobTarget(it.id, draft);
                    if (res.ok) {
                      setItems((prev) =>
                        prev.map((p) =>
                          p.id === it.id ? { ...p, ...draft } : p,
                        ),
                      );
                      setEditingId(null);
                    }
                  }}
                />
              </li>
            ) : (
              <ApplicationRow
                key={it.id}
                item={it}
                resumes={resumes}
                onEdit={() => setEditingId(it.id)}
                onStatus={(status) =>
                  setItems((prev) =>
                    prev.map((p) => (p.id === it.id ? { ...p, status } : p)),
                  )
                }
                onDelete={() =>
                  setItems((prev) => prev.filter((p) => p.id !== it.id))
                }
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function ApplicationRow({
  item,
  resumes,
  onEdit,
  onStatus,
  onDelete,
}: {
  item: Item;
  resumes: ResumeOption[];
  onEdit: () => void;
  onStatus: (status: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("applications");
  const [, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const resume = resumes.find((r) => r.id === item.resumeId);
  const title = [item.company, item.role].filter(Boolean).join(" · ");

  return (
    <li className="rounded-2xl bg-ivory ring-1 ring-border-warm px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-[15.5px] text-near-black truncate">
            {title || "—"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-stone-gray">
            <span>
              {t("field.resume")}: {resume ? resume.label : t("resumeNone")}
            </span>
            {item.jobUrl && (
              <a
                href={item.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-terracotta hover:underline"
              >
                {t("openLink")}
              </a>
            )}
          </div>
          {item.notes && (
            <p className="mt-1.5 text-[12.5px] text-olive-gray leading-relaxed">
              {item.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={item.status}
            onChange={(e) => {
              const status = e.target.value;
              onStatus(status);
              start(() => {
                updateJobTarget(item.id, { status });
              });
            }}
            className={
              "rounded-md ring-1 px-2 py-1 text-[11.5px] focus:outline-none " +
              (STATUS_STYLE[item.status] ?? STATUS_STYLE.saved)
            }
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2.5 text-[12px]">
        <button
          type="button"
          onClick={onEdit}
          className="text-stone-gray hover:text-near-black transition"
        >
          {t("edit")}
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await deleteJobTarget(item.id);
                onDelete();
              })
            }
            className="text-error hover:underline"
          >
            {t("confirmDelete")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-stone-gray hover:text-error transition"
          >
            {t("delete")}
          </button>
        )}
      </div>
    </li>
  );
}

function ApplicationForm({
  resumes,
  initial,
  onCancel,
  onSave,
}: {
  resumes: ResumeOption[];
  initial: Draft;
  onCancel: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const t = useTranslations("applications");
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const input =
    "w-full rounded-lg bg-white ring-1 ring-border-warm px-3 py-2 text-[13.5px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition";

  return (
    <div className="rounded-2xl bg-ivory ring-1 ring-terracotta px-5 py-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={draft.company}
          onChange={(e) => set({ company: e.target.value })}
          placeholder={t("field.company")}
          className={input}
        />
        <input
          value={draft.role}
          onChange={(e) => set({ role: e.target.value })}
          placeholder={t("field.role")}
          className={input}
        />
        <input
          value={draft.jobUrl}
          onChange={(e) => set({ jobUrl: e.target.value })}
          placeholder={t("field.url")}
          className={input}
        />
        <select
          value={draft.resumeId ?? ""}
          onChange={(e) => set({ resumeId: e.target.value || null })}
          className={input}
        >
          <option value="">{t("resumeNone")}</option>
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={draft.status}
          onChange={(e) => set({ status: e.target.value })}
          className={input}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={draft.notes}
        onChange={(e) => set({ notes: e.target.value })}
        rows={2}
        placeholder={t("field.notes")}
        className={input + " resize-y"}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(draft);
            setBusy(false);
          }}
          className="rounded-lg bg-terracotta text-ivory px-4 py-2 text-[13px] font-medium hover:bg-coral disabled:opacity-60 transition"
        >
          {busy ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg bg-warm-sand text-charcoal-warm px-4 py-2 text-[13px] hover:bg-border-cream disabled:opacity-60 transition"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
