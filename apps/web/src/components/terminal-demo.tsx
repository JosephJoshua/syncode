import type { MotionValue } from 'motion/react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect } from 'react';

// Token: [text, tailwind-classes]
type Token = [string, string];

const KW = 'text-purple-400';
const FN = 'text-yellow-300';
const CMT = 'text-muted-foreground/60';
const OP = 'text-foreground/50';
const ID = 'text-foreground/90';
const PASS = 'text-green-400 font-medium';
const PRI = 'text-primary';
const MUT = 'text-muted-foreground';
const DIM = 'text-muted-foreground/30';

interface Cursor {
  name: string;
  color: string;
}

interface Item {
  id: string;
  kind: 'code' | 'output' | 'ai' | 'divider' | 'blank';
  lineNum?: number;
  tokens: Token[];
  label?: string;
  accent?: boolean;
  cursor?: Cursor;
}

const ITEMS: Item[] = [
  // Editor
  { id: 'c1', kind: 'code', lineNum: 1, tokens: [['# Two Sum', CMT]] },
  { id: 'c2', kind: 'code', lineNum: 2, tokens: [['# Return indices summing to target', CMT]] },
  { id: 'c3', kind: 'code', lineNum: 3, tokens: [] },
  {
    id: 'c4',
    kind: 'code',
    lineNum: 4,
    tokens: [
      ['def ', KW],
      ['two_sum', FN],
      ['(nums, target):', OP],
    ],
  },
  {
    id: 'c5',
    kind: 'code',
    lineNum: 5,
    tokens: [
      ['    seen ', ID],
      ['= {}', OP],
    ],
  },
  {
    id: 'c6',
    kind: 'code',
    lineNum: 6,
    tokens: [
      ['    ', ''],
      ['for ', KW],
      ['i, n ', ID],
      ['in ', KW],
      ['enumerate', FN],
      ['(nums):', OP],
    ],
  },
  {
    id: 'c7',
    kind: 'code',
    lineNum: 7,
    tokens: [
      ['        ', ''],
      ['if ', KW],
      ['(target ', ID],
      ['- ', OP],
      ['n) ', ID],
      ['in ', KW],
      ['seen:', ID],
    ],
    cursor: { name: 'alice', color: 'bg-amber-400' },
  },
  {
    id: 'c8',
    kind: 'code',
    lineNum: 8,
    tokens: [
      ['            ', ''],
      ['return ', KW],
      ['[seen[target ', ID],
      ['- ', OP],
      ['n], i]', ID],
    ],
  },
  {
    id: 'c9',
    kind: 'code',
    lineNum: 9,
    tokens: [
      ['        seen[n] ', ID],
      ['= ', OP],
      ['i', ID],
    ],
    cursor: { name: 'bob', color: 'bg-violet-400' },
  },

  // Output
  { id: 'd-out', kind: 'divider', tokens: [], label: 'Output' },
  {
    id: 'o-cmd',
    kind: 'output',
    tokens: [
      ['$ ', DIM],
      ['python two_sum.py', PRI],
    ],
  },
  { id: 'o-run', kind: 'output', tokens: [['Running 3 test cases...', MUT]] },
  {
    id: 'o-t1',
    kind: 'output',
    tokens: [
      ['  ', ''],
      ['PASS', PASS],
      ['  nums=[2,7,11,15] target=9  ', ID],
      ['=> [0,1]', MUT],
    ],
  },
  {
    id: 'o-t2',
    kind: 'output',
    tokens: [
      ['  ', ''],
      ['PASS', PASS],
      ['  nums=[3,2,4] target=6      ', ID],
      ['=> [1,2]', MUT],
    ],
  },
  {
    id: 'o-t3',
    kind: 'output',
    tokens: [
      ['  ', ''],
      ['PASS', PASS],
      ['  nums=[3,3] target=6        ', ID],
      ['=> [0,1]', MUT],
    ],
  },
  { id: 'o-gap', kind: 'blank', tokens: [] },
  {
    id: 'o-all',
    kind: 'output',
    tokens: [
      ['All tests passed ', PASS],
      ['(3/3)', MUT],
    ],
  },

  // AI Review
  { id: 'd-ai', kind: 'divider', tokens: [], label: 'AI Review', accent: true },
  {
    id: 'a-time',
    kind: 'ai',
    tokens: [
      ['Time:  ', MUT],
      ['O(n)', PRI],
      ['  optimal', 'text-green-400'],
    ],
  },
  {
    id: 'a-space',
    kind: 'ai',
    tokens: [
      ['Space: ', MUT],
      ['O(n)', PRI],
      ['  expected', MUT],
    ],
  },
  { id: 'a-gap', kind: 'blank', tokens: [] },
  {
    id: 'a-verdict',
    kind: 'ai',
    tokens: [
      ['Clean hash-map approach. ', PRI],
      ['Ship it.', 'text-green-400'],
    ],
  },
];

// Phase boundaries
const CODE_END = 9; // items 0-8 = code
const OUTPUT_END = 17; // items 9-16 = output
const TOTAL = ITEMS.length; // items 17-21 = AI

export function TerminalDemo() {
  const visibleCount = useMotionValue(0);

  useEffect(() => {
    const controls = animate(
      visibleCount,
      [0, CODE_END, CODE_END, OUTPUT_END, OUTPUT_END, TOTAL, TOTAL, 0],
      {
        duration: 11,
        times: [0, 0.23, 0.27, 0.45, 0.5, 0.59, 0.86, 1],
        ease: ['easeOut', 'linear', 'easeOut', 'linear', 'easeOut', 'linear', 'easeIn'],
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 0.8,
      },
    );
    return () => controls.stop();
  }, [visibleCount]);

  return (
    <div className="aurora-border terminal-glow overflow-hidden rounded-xl border border-primary/15 bg-[#0a0e14]">
      {/* Title bar */}
      <div className="flex items-center border-b border-white/6 bg-white/2 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="mx-auto font-mono text-xs text-muted-foreground/50">
          two_sum.py — syncode
        </span>
        <div className="w-13" />
      </div>

      {/* Content */}
      <div className="px-2 py-4 font-mono text-[13px] leading-7 sm:px-4">
        {ITEMS.map((item, i) => (
          <AnimatedItem key={item.id} item={item} index={i} visibleCount={visibleCount} />
        ))}

        {/* Blinking cursor */}
        <span className="ml-10">
          <motion.span className="inline-block h-4.5 w-0.5 translate-y-0.75 bg-primary animate-blink" />
        </span>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 border-t border-white/6 bg-white/2 px-4 py-2 font-mono text-[11px] text-muted-foreground/40">
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          ready
        </span>
        <span className="text-muted-foreground/20">|</span>
        <span>main</span>
        <span className="text-muted-foreground/20">|</span>
        <span>Python 3.12</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-violet-400" />2 connected
        </span>
      </div>
    </div>
  );
}

function AnimatedItem({
  item,
  index,
  visibleCount,
}: {
  item: Item;
  index: number;
  visibleCount: MotionValue<number>;
}) {
  const opacity = useTransform(visibleCount, [index, index + 0.6], [0, 1]);
  const y = useTransform(visibleCount, [index, index + 0.6], [8, 0]);

  if (item.kind === 'blank') {
    return <motion.div style={{ opacity }} className="h-7" />;
  }

  if (item.kind === 'divider') {
    return (
      <motion.div style={{ opacity, y }} className="my-2 flex items-center gap-3">
        <span
          className={`text-[10px] uppercase tracking-[0.2em] ${
            item.accent ? 'text-primary/40' : 'text-muted-foreground/25'
          }`}
        >
          {item.label}
        </span>
        <span
          className={`flex-1 border-t ${item.accent ? 'border-primary/10' : 'border-white/4'}`}
        />
      </motion.div>
    );
  }

  const hasLineNum = item.lineNum != null;

  return (
    <motion.div style={{ opacity, y }} className="flex items-center">
      {/* Line number gutter */}
      <span
        className={`w-8 shrink-0 select-none text-right ${hasLineNum ? 'text-muted-foreground/20' : ''}`}
      >
        {item.lineNum ?? ''}
      </span>
      <span className={`mx-2 self-stretch ${hasLineNum ? 'border-r border-white/6' : ''}`} />

      {/* Tokens */}
      <span className="whitespace-pre">
        {item.tokens.map(([text, cls], j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static token array, never reordered
          <span key={j} className={cls}>
            {text}
          </span>
        ))}
      </span>

      {/* Collaborative cursor */}
      {item.cursor ? (
        <motion.span
          className="ml-1 inline-flex shrink-0 items-center gap-px"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          <span className={`inline-block h-4 w-0.5 rounded-full ${item.cursor.color}`} />
          <span
            className={`${item.cursor.color} rounded-sm px-1 py-px text-[9px] font-medium leading-none text-background`}
          >
            {item.cursor.name}
          </span>
        </motion.span>
      ) : null}
    </motion.div>
  );
}
