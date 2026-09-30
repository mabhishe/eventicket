import type { ReactNode } from "react";

export function Container({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(120,53,15,0.07)] dark:border-stone-800 dark:bg-stone-900 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {title}
        </h1>
        {sub && (
          <p className="mt-1 max-w-xl text-sm text-stone-500 dark:text-stone-400">
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "stone",
}: {
  children: ReactNode;
  tone?: "stone" | "green" | "amber" | "red" | "blue" | "ember";
}) {
  const tones: Record<string, string> = {
    stone:
      "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    green:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    ember:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-orange-700 focus:ring-2 focus:ring-orange-700/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-orange-500 dark:focus:ring-orange-500/20";

export const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(154,52,18,0.4)] hover:bg-orange-800 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white/50 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:bg-transparent dark:text-stone-200 dark:hover:bg-stone-800";

export const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {message}
    </p>
  );
}
