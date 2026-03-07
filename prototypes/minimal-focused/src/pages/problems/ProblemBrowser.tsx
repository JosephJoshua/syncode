import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import type { Problem } from '../../data/problems';
import { problems } from '../../data/problems';
import { fadeIn, fadeInUp, staggeredEntrance } from '../../lib/animations';

const ALL_TAGS = ['array', 'tree', 'dynamic-programming', 'string', 'graph', 'hash-table'] as const;

const DIFFICULTY_COLORS: Record<Problem['difficulty'], { active: string }> = {
  easy: {
    active: 'border-green-500/30 text-green-500 bg-green-500/5',
  },
  medium: {
    active: 'border-amber-500/30 text-amber-500 bg-amber-500/5',
  },
  hard: {
    active: 'border-red-500/30 text-red-500 bg-red-500/5',
  },
};

const TAG_LABELS: Record<string, string> = {
  array: 'Arrays',
  tree: 'Trees',
  'dynamic-programming': 'DP',
  string: 'Strings',
  graph: 'Graphs',
  'hash-table': 'Hash Table',
};

function acceptanceRate(id: string) {
  const rates: Record<string, string> = {
    p1: '67%',
    p2: '72%',
    p3: '74%',
    p4: '45%',
    p5: '52%',
    p6: '41%',
    p7: '63%',
    p8: '48%',
    p9: '34%',
    p10: '28%',
    p11: '31%',
    p12: '36%',
  };
  return rates[id] ?? '50%';
}

export function ProblemBrowser() {
  const [searchText, setSearchText] = useState('');
  const [activeDifficulty, setActiveDifficulty] = useState<Problem['difficulty'] | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const toggleDifficulty = (d: Problem['difficulty']) => {
    setActiveDifficulty((prev) => (prev === d ? null : d));
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return problems.filter((p) => {
      if (activeDifficulty && p.difficulty !== activeDifficulty) return false;
      if (activeTags.size > 0 && !p.tags.some((t) => activeTags.has(t))) return false;
      if (query) {
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesTag = p.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesTag) return false;
      }
      return true;
    });
  }, [searchText, activeDifficulty, activeTags]);

  return (
    <div>
      {/* Header */}
      <div style={fadeInUp(100)}>
        <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
          // problem_library
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Problem Library
        </h1>
        <p className="font-mono text-sm text-[var(--text-tertiary)] mt-1">
          {filtered.length} problem{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="mt-5 relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none z-10"
        />
        <Input
          placeholder="Search by title or tag..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="!h-10 !pl-9"
        />
      </div>

      {/* Filter pills */}
      <div className="mt-3 flex flex-wrap gap-2" style={fadeIn(200)}>
        {(['easy', 'medium', 'hard'] as const).map((d) => {
          const isActive = activeDifficulty === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDifficulty(d)}
              className={`rounded-full px-3 py-1 text-xs font-mono cursor-pointer transition-all duration-150 border ${
                isActive
                  ? DIFFICULTY_COLORS[d].active
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] bg-transparent'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          );
        })}

        <span className="w-px h-5 bg-[var(--border-default)] self-center mx-1" />

        {ALL_TAGS.map((tag) => {
          const isActive = activeTags.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-mono cursor-pointer transition-all duration-150 border ${
                isActive
                  ? 'border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-default)] text-[var(--text-tertiary)] bg-transparent'
              }`}
            >
              {TAG_LABELS[tag] ?? tag}
            </button>
          );
        })}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Search}
            heading="No problems found"
            description="Try different filters"
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((problem, i) => (
            <Link
              key={problem.id}
              to={`/problems/${problem.id}`}
              className="group"
              style={staggeredEntrance(i, 300)}
            >
              <Card
                padding="p-4"
                className="relative transition-all duration-150 border-b-2 border-b-transparent group-hover:border-b-[var(--accent)] group-hover:border-[var(--border-strong)] group-hover:-translate-y-px group-hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={problem.difficulty}>
                    {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: acceptanceRate(problem.id) }}
                      />
                    </div>
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {acceptanceRate(problem.id)}
                    </span>
                  </div>
                </div>

                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mt-2">
                  {problem.title}
                </h3>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {problem.tags.map((tag) => (
                    <span key={tag} className="text-xs font-mono text-[var(--text-tertiary)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
