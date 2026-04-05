import { memo, useMemo } from 'react';

const CODE_SYMBOLS = ['</', '/>', '{;}', '( )', '[ ]', '&&', '=>', '::', '/**/', '!=', '++', '0x'];

export const FloatingSymbols = memo(function FloatingSymbols() {
  const symbols = useMemo(
    () =>
      CODE_SYMBOLS.map((symbol, i) => ({
        symbol,
        left: `${8 + ((i * 7.3) % 84)}%`,
        delay: i * 1.2,
        duration: 12 + (i % 5) * 3,
        size: 10 + (i % 3) * 2,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {symbols.map((s) => (
        <span
          key={s.symbol}
          className="absolute font-mono text-primary/[0.07] select-none"
          style={{
            left: s.left,
            fontSize: `${s.size}px`,
            animation: `float-drift ${s.duration}s ${s.delay}s linear infinite`,
          }}
        >
          {s.symbol}
        </span>
      ))}
    </div>
  );
});
