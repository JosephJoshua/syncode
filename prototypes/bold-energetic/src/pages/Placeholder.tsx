export function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="font-mono text-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
        // {name.toLowerCase().replace(/\s+/g, '_')}
      </p>
      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">{name}</h1>
    </div>
  );
}
