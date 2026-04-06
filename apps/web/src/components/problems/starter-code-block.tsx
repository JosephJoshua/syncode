import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-typescript';
import { type ReactNode, useMemo } from 'react';
import { resolvePrismLanguage } from './starter-code-language';

export function StarterCodeBlock({ code, language }: { code: string; language: string }) {
  const prismLanguage = resolvePrismLanguage(language);
  const grammar = prismLanguage ? Prism.languages[prismLanguage] : null;
  const tokens = useMemo(() => (grammar ? Prism.tokenize(code, grammar) : [code]), [code, grammar]);
  const languageKey = prismLanguage ?? 'plain-text';
  const codeClassName = prismLanguage
    ? `language-${prismLanguage} block min-w-full font-mono`
    : 'block min-w-full font-mono';

  return (
    <div className="starter-code-block overflow-x-auto rounded-xl border border-border/60 bg-muted/60 px-4 py-2.5">
      <pre
        className="text-sm leading-[1.625rem] text-foreground"
        data-language={prismLanguage ?? 'plain-text'}
        data-testid="starter-code-block"
      >
        <code className={codeClassName}>{renderTokenStream(tokens, languageKey)}</code>
      </pre>
    </div>
  );
}

function renderTokenStream(tokens: Prism.TokenStream, keyPrefix: string): ReactNode[] {
  if (typeof tokens === 'string') {
    return [tokens];
  }

  if (!Array.isArray(tokens)) {
    return [renderToken(tokens, `${keyPrefix}-0`)];
  }

  return tokens.map((token: string | Prism.Token, index: number) =>
    renderToken(token, `${keyPrefix}-${index}`),
  );
}

function renderToken(token: string | Prism.Token, key: string): ReactNode {
  if (typeof token === 'string') {
    return token;
  }

  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
  const className = ['token', token.type, ...aliases].join(' ');

  return (
    <span className={className} key={key}>
      {renderTokenContent(token.content, key)}
    </span>
  );
}

function renderTokenContent(
  content: string | Prism.Token | Prism.TokenStream,
  key: string,
): ReactNode {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return renderTokenStream(content, key);
  }

  return renderToken(content, `${key}-nested`);
}
