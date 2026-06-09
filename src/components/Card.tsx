// Card — shared surface for the panels. Generous rounding + soft shadow.
export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-surface/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur sm:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
