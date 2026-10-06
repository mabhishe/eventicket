/** Placeholder for the checkout island while a client boundary resolves. */
export function EventPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse" aria-hidden>
      <div className="mb-6 aspect-[5/2] rounded-2xl bg-stone-200 dark:bg-stone-800" />
      <div className="mb-3 h-8 w-2/3 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="mb-6 h-4 w-1/2 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="space-y-3 rounded-2xl border border-stone-200 p-5 dark:border-stone-800">
        <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-16 rounded-lg bg-stone-100 dark:bg-stone-800/80" />
        <div className="h-16 rounded-lg bg-stone-100 dark:bg-stone-800/80" />
      </div>
    </div>
  );
}
