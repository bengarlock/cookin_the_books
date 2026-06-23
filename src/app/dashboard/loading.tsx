function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] ${className}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="border-b border-white/10 pb-8">
        <SkeletonBlock className="h-3 w-32 rounded-full" />
        <SkeletonBlock className="mt-4 h-10 w-full max-w-xl" />
        <SkeletonBlock className="mt-4 h-5 w-full max-w-2xl" />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>

      <SkeletonBlock className="h-80" />
    </div>
  );
}
