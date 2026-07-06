export default function BudgetLoading() {
  return (
    <div className="mt-10 animate-pulse space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-36 rounded-2xl border border-white/10 bg-white/[0.04]"
            key={index}
          />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-xl bg-white/[0.06]" />
        <div className="h-64 rounded-2xl border border-white/10 bg-white/[0.03]" />
        <div className="h-64 rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  );
}
