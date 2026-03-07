import { Heart, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge.tsx';
import { problems } from '../../data/problems.ts';

function getAcceptanceRate(id: string): number {
  return Math.round(40 + ((parseInt(id.slice(1), 10) * 7) % 30));
}

const difficultyColor: Record<string, string> = {
  easy: 'var(--success)',
  medium: 'var(--accent)',
  hard: 'var(--primary)',
};

export function ProblemBrowser() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(problems.filter((p) => p.bookmarked).map((p) => p.id)),
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of problems) {
      for (const t of p.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }, []);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedDifficulty !== 'All' && p.difficulty !== selectedDifficulty.toLowerCase())
        return false;
      if (selectedTags.size > 0 && !p.tags.some((t) => selectedTags.has(t))) return false;
      return true;
    });
  }, [searchQuery, selectedDifficulty, selectedTags]);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Problems</h1>

      {/* Search Bar */}
      <div className="relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <input
          type="text"
          placeholder="Search problems..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] pl-12 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-muted)] transition-all"
        />
      </div>

      {/* Filter Pills */}
      <div className="space-y-3">
        {/* Difficulty */}
        <div className="flex flex-wrap gap-2">
          {difficulties.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDifficulty(d)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                selectedDifficulty === d
                  ? 'gradient-brand text-white'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selectedTags.has(tag)
                  ? 'bg-[var(--primary-muted)] text-[var(--primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((problem) => {
          const acceptance = getAcceptanceRate(problem.id);
          const color = difficultyColor[problem.difficulty];
          const isBookmarked = bookmarkedIds.has(problem.id);

          return (
            <Link key={problem.id} to={`/problems/${problem.id}`} className="block group">
              <div
                className="h-full bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-sm)] p-5 transition-all duration-200 border-l-4 border-l-transparent group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-md)]"
                style={{
                  borderLeftColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderLeftColor = color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }}
              >
                {/* Title + Bookmark */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display font-semibold text-[var(--text-primary)] leading-tight">
                    {problem.title}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleBookmark(problem.id);
                    }}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  >
                    <Heart
                      size={18}
                      className={
                        isBookmarked
                          ? 'fill-[var(--primary)] text-[var(--primary)]'
                          : 'text-[var(--text-tertiary)]'
                      }
                    />
                  </button>
                </div>

                {/* Difficulty Badge */}
                <div className="mb-3">
                  <Badge variant={problem.difficulty}>
                    {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                  </Badge>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {problem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-[var(--bg-subtle)] text-[var(--text-tertiary)] rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Acceptance Rate */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                    <span>Acceptance</span>
                    <span>{acceptance}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${acceptance}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          No problems match your filters.
        </div>
      )}
    </div>
  );
}
