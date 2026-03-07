export function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{name}</h1>
      <p className="mt-2 text-sm text-[var(--text-tertiary)]">This page is a placeholder.</p>
    </div>
  );
}
