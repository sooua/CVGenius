"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cloneResume, removeResume } from "@/app/actions/resumes";

export type ResumeListItem = {
  id: string;
  title: string;
  subtitle: string;
  targetRole: string;
  score: number | null;
  updatedAt: string;
  createdAt: string;
};

type SortKey = "updated" | "created" | "name";

const SORT_KEYS: SortKey[] = ["updated", "created", "name"];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ResumeList({ items }: { items: ResumeListItem[] }) {
  const t = useTranslations("dashboard");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((it) =>
          [it.title, it.subtitle, it.targetRole]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : items;

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "zh");
      const key = sort === "created" ? "createdAt" : "updatedAt";
      return new Date(b[key]).getTime() - new Date(a[key]).getTime();
    });
    return sorted;
  }, [items, query, sort]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-0">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-gray text-[13px]">
            {t("search.icon")}
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full rounded-xl bg-ivory ring-1 ring-border-warm pl-9 pr-3 py-2 text-[13.5px] text-near-black placeholder:text-warm-silver focus:outline-none focus:ring-2 focus:ring-terracotta transition"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={
                "rounded-lg px-3 py-1.5 text-[12.5px] transition " +
                (sort === key
                  ? "bg-warm-sand text-charcoal-warm"
                  : "text-stone-gray hover:text-charcoal-warm")
              }
            >
              {t(`sort.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-ivory/60 ring-1 ring-dashed ring-border-warm px-6 py-10 text-center">
          <p className="text-[13.5px] text-stone-gray">
            {t("search.noMatch", { query: query.trim() })}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <ResumeRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResumeRow({ item }: { item: ResumeListItem }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const cloneThis = cloneResume.bind(null, item.id);

  const onDelete = () => {
    startDelete(async () => {
      const res = await removeResume(item.id);
      if (res.ok) {
        router.refresh();
      } else {
        setConfirming(false);
      }
    });
  };

  return (
    <li
      className={
        "group rounded-2xl bg-ivory ring-1 ring-border-warm transition-all duration-300 flex items-center " +
        (isDeleting
          ? "opacity-50 pointer-events-none"
          : "hover:ring-terracotta hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-20px_rgba(20,20,19,0.2)]")
      }
    >
      <Link href={`/resume/${item.id}`} className="flex-1 min-w-0 px-6 py-5">
        <div className="flex items-baseline justify-between gap-4 mb-1.5">
          <p className="font-serif text-[17px] text-near-black truncate">
            {item.title}
          </p>
          <span className="text-[12px] text-stone-gray shrink-0">
            {formatDate(item.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[13.5px] text-olive-gray truncate min-w-0">
            {item.subtitle}
          </p>
          {item.targetRole ? (
            <span
              className="shrink-0 inline-flex items-center rounded-full ring-1 ring-border-warm bg-parchment px-2 py-0.5 text-[11px] text-charcoal-warm"
              title={t("row.targetRoleTitle")}
            >
              → {item.targetRole}
            </span>
          ) : null}
          {item.score !== null ? <CheckupBadge score={item.score} /> : null}
        </div>
      </Link>
      <div className="shrink-0 mr-3 md:mr-4 flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-lg bg-error text-ivory px-3 py-1.5 text-[12px] hover:opacity-90 transition"
            >
              {isDeleting ? t("row.deleting") : t("row.confirmDelete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isDeleting}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-stone-gray hover:text-charcoal-warm transition"
            >
              {t("row.cancel")}
            </button>
          </>
        ) : (
          <>
            <form action={cloneThis}>
              <button
                type="submit"
                className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12px] text-charcoal-warm hover:bg-border-cream transition"
                title={t("row.cloneTitle")}
              >
                {t("row.clone")}
              </button>
            </form>
            <a
              href={`/api/resumes/${item.id}/pdf`}
              className="rounded-lg bg-warm-sand px-3 py-1.5 text-[12px] text-charcoal-warm hover:bg-border-cream transition"
              title={t("row.pdfTitle")}
            >
              PDF
            </a>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-stone-gray hover:bg-error/10 hover:text-error transition"
              title={t("row.deleteTitle")}
            >
              {t("row.delete")}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function CheckupBadge({ score }: { score: number }) {
  const t = useTranslations("dashboard");
  const tone =
    score >= 80
      ? "text-terracotta bg-terracotta/10 ring-terracotta/20"
      : score >= 60
        ? "text-charcoal-warm bg-warm-sand ring-border-warm"
        : "text-olive-gray bg-border-cream ring-border-warm";
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-[11px] ${tone}`}
      title={t("badge.checkupTitle")}
    >
      <span className="opacity-70">{t("badge.checkup")}</span>
      <span className="font-medium tabular-nums">{score}</span>
    </span>
  );
}
