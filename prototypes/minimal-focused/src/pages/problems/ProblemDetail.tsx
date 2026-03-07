import { Link, useNavigate, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { problems } from '../../data/problems';

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

function submissions(id: string) {
  const counts: Record<string, string> = {
    p1: '45,231',
    p2: '38,102',
    p3: '29,445',
    p4: '22,871',
    p5: '18,340',
    p6: '15,022',
    p7: '12,890',
    p8: '11,234',
    p9: '8,901',
    p10: '7,432',
    p11: '6,120',
    p12: '5,678',
  };
  return counts[id] ?? '1,234';
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function getRelated(currentId: string) {
  const current = problems.find((p) => p.id === currentId);
  if (!current) return [];
  return problems
    .filter((p) => p.id !== currentId && p.tags.some((t) => current.tags.includes(t)))
    .slice(0, 3);
}

export function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const problem = problems.find((p) => p.id === id);

  if (!problem) {
    return (
      <div className="flex flex-col items-center text-center py-24">
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
          Problem Not Found
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          The problem you're looking for doesn't exist.
        </p>
        <Link
          to="/problems"
          className="mt-4 font-mono text-sm text-[var(--accent)] hover:underline"
        >
          back_to_problems
        </Link>
      </div>
    );
  }

  const related = getRelated(problem.id);

  return (
    <div className="lg:grid lg:grid-cols-5 lg:gap-8">
      {/* Left column */}
      <div className="lg:col-span-3">
        {/* Breadcrumb */}
        <nav className="font-mono text-xs text-[var(--text-tertiary)]">
          <Link to="/problems" className="hover:text-[var(--accent)] transition-colors">
            problems
          </Link>
          <span className="mx-1.5">/</span>
          <span>{slugify(problem.title)}</span>
        </nav>

        {/* Title */}
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-2">
          {problem.title}
        </h1>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2">
          <Badge variant={problem.difficulty}>
            {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
          </Badge>
          <div className="flex items-center gap-2">
            {problem.tags.map((tag) => (
              <span key={tag} className="font-mono text-xs text-[var(--text-tertiary)]">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Gradient divider */}
        <div
          className="mt-4 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, var(--border-default), transparent)',
          }}
        />

        {/* Description */}
        <div className="mt-6">
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {problem.description}
          </p>
        </div>

        {/* Examples */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Examples
            </h2>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">// examples</span>
          </div>

          <div className="space-y-3">
            {problem.examples.map((example, idx) => (
              <Card key={idx} padding="p-4">
                <div className="space-y-3">
                  <div>
                    <span className="font-mono text-xs text-[var(--accent)]">Input:</span>
                    <div className="mt-1 bg-[var(--bg-subtle)] rounded-md p-3 font-mono text-sm text-[var(--text-primary)]">
                      {example.input}
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-xs text-[var(--accent)]">Output:</span>
                    <div className="mt-1 bg-[var(--bg-subtle)] rounded-md p-3 font-mono text-sm text-[var(--text-primary)]">
                      {example.output}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Constraints */}
        <div className="mt-6">
          <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
            Constraints
          </h2>
          <ul className="space-y-1.5">
            {problem.constraints.map((constraint, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span className="font-mono text-sm text-[var(--text-secondary)]">{constraint}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right column (sidebar) */}
      <div className="lg:col-span-2 mt-8 lg:mt-0">
        {/* Practice card */}
        <Card className="sticky top-6">
          <Button
            variant="primary"
            size="lg"
            className="w-full hover:shadow-[var(--shadow-accent-glow)]"
            onClick={() => navigate('/rooms')}
          >
            Practice this problem
          </Button>

          <div
            className="my-4 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, var(--border-default), transparent)',
            }}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Acceptance Rate</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {acceptanceRate(problem.id)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Submissions</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">
                {submissions(problem.id)}
              </span>
            </div>
          </div>
        </Card>

        {/* Related problems */}
        {related.length > 0 && (
          <Card className="mt-4">
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
              Related Problems
            </h3>
            <div className="space-y-2">
              {related.map((rp) => (
                <Link
                  key={rp.id}
                  to={`/problems/${rp.id}`}
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  {rp.title}
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
