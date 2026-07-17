import { lazy } from 'react';

export const LazyMonacoEditor = lazy(async () => {
  await import('@/lib/monaco-loader.js');
  const module = await import('@monaco-editor/react');
  return { default: module.default };
});
