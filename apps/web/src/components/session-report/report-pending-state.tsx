import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function ReportPendingState({
  title,
  subtitle,
  body,
  pollingLabel,
}: {
  title: string;
  subtitle: string;
  body: string;
  pollingLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-500/20 bg-black/85 px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative flex size-16 items-center justify-center rounded-full bg-emerald-400/10">
          <motion.div
            className="absolute inset-0 rounded-full border border-emerald-400/25"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.1, 0.45] }}
            transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <Loader2 className="size-7 animate-spin text-emerald-300" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
            {subtitle}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">{body}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {pollingLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
