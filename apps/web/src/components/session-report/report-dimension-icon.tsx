import { Braces, CheckCircle2, Leaf, Lightbulb, MessageSquareQuote } from 'lucide-react';

export function getDimensionIcon(key: string) {
  const className = 'size-4 text-primary';

  switch (key) {
    case 'correctness':
      return <CheckCircle2 className={className} />;
    case 'efficiency':
      return <Leaf className={className} />;
    case 'codeQuality':
      return <Braces className={className} />;
    case 'communication':
      return <MessageSquareQuote className={className} />;
    case 'problemSolving':
      return <Lightbulb className={className} />;
    default:
      return null;
  }
}
