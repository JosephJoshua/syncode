import { Heart } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '../../components/ui/Badge.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { problems } from '../../data/problems.ts';

const difficultyColor: Record<string, string> = {
  easy: 'var(--success)',
  medium: 'var(--accent)',
  hard: 'var(--primary)',
};

function getAcceptanceRate(id: string): number {
  return Math.round(40 + ((parseInt(id.slice(1), 10) * 7) % 30));
}

export function Bookmarks() {
  const navigate = useNavigate();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(problems.filter((p) => p.bookmarked).map((p) => p.id)),
  );
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const bookmarkedProblems = useMemo(
    () => problems.filter((p) => bookmarkedIds.has(p.id)),
    [bookmarkedIds],
  );

  const removeBookmark = useCallback((id: string) => {
    setFadingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Bookmarks</h1>

      {bookmarkedProblems.length === 0 ? (
        <EmptyState
          icon={Heart}
          heading="No bookmarks yet"
          description="Save problems you want to revisit later."
          ctaLabel="Browse Problems"
          onCtaClick={() => navigate('/problems')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookmarkedProblems.map((problem) => {
            const acceptance = getAcceptanceRate(problem.id);
            const color = difficultyColor[problem.difficulty];
            const isFading = fadingIds.has(problem.id);

            return (
              <Link
                key={problem.id}
                to={`/problems/${problem.id}`}
                className="block group"
                style={{
                  opacity: isFading ? 0 : 1,
                  transition: 'opacity 300ms ease',
                }}
              >
                <div
                  className="h-full bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-sm)] p-5 transition-all duration-200 border-l-4 border-l-transparent group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-md)]"
                  style={{ borderLeftColor: 'transparent' }}
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
                        removeBookmark(problem.id);
                      }}
                      className="flex-shrink-0 p-1 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                    >
                      <Heart size={18} className="fill-[var(--primary)] text-[var(--primary)]" />
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
      )}
    </div>
  );
}
