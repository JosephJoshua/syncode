import { ChevronRight, Play } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { problems } from '../../data/problems.ts';

export function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const problem = problems.find((p) => p.id === id);

  const relatedProblems = useMemo(() => {
    if (!problem) return [];
    return problems.filter((p) => p.id !== problem.id).slice(0, 3);
  }, [problem]);

  if (!problem) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-[var(--text-secondary)]">Problem not found.</p>
        <Link to="/problems" className="text-[var(--primary)] hover:underline mt-2 inline-block">
          Back to Problems
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-3 space-y-5">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <Link to="/problems" className="hover:text-[var(--primary)] transition-colors">
              Problems
            </Link>
            <ChevronRight size={14} />
            <span className="text-[var(--text-primary)]">{problem.title}</span>
          </nav>

          {/* Title */}
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            {problem.title}
          </h1>

          {/* Difficulty Badge (large) */}
          <Badge variant={problem.difficulty} className="text-sm px-4 py-1.5">
            {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
          </Badge>

          {/* Description */}
          <p className="text-[var(--text-secondary)] mt-4 whitespace-pre-line leading-relaxed">
            {problem.description}
          </p>

          {/* Examples */}
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-lg text-[var(--text-primary)]">
              Examples
            </h2>
            {problem.examples.map((example, i) => (
              <div
                key={i}
                className="bg-[var(--bg-subtle)] rounded-lg p-4 font-mono text-sm space-y-1"
              >
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Input: </span>
                  <span className="text-[var(--text-secondary)]">{example.input}</span>
                </div>
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Output: </span>
                  <span className="text-[var(--text-secondary)]">{example.output}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Constraints */}
          <section className="space-y-2">
            <h2 className="font-display font-semibold text-lg text-[var(--text-primary)]">
              Constraints
            </h2>
            <ul className="list-disc list-inside space-y-1">
              {problem.constraints.map((c, i) => (
                <li key={i} className="text-sm text-[var(--text-secondary)]">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Practice Now */}
          <Card>
            <Link to="/rooms/create">
              <Button
                variant="primary"
                size="lg"
                className="w-full text-base hover:shadow-[var(--shadow-glow-primary)]"
              >
                <Play size={18} className="mr-2" />
                Practice Now
              </Button>
            </Link>
          </Card>

          {/* Tags */}
          <Card>
            <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-[var(--bg-subtle)] text-[var(--text-tertiary)] rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>

          {/* Related Problems */}
          <Card>
            <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3">
              Related Problems
            </h3>
            <div className="space-y-3">
              {relatedProblems.map((rp) => (
                <Link
                  key={rp.id}
                  to={`/problems/${rp.id}`}
                  className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <span className="text-sm text-[var(--text-primary)] font-medium truncate mr-2">
                    {rp.title}
                  </span>
                  <Badge variant={rp.difficulty}>
                    {rp.difficulty.charAt(0).toUpperCase() + rp.difficulty.slice(1)}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
