#!/usr/bin/env node
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['packages', 'apps'];
const DIR_TARGETS = new Set(['dist', '.turbo']);
const FILE_PREFIX = 'tsconfig';
const FILE_SUFFIX = '.tsbuildinfo';

async function removePath(path) {
  await rm(path, { recursive: true, force: true });
}

async function cleanWorkspace(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const workspaceDir = join(root, entry.name);

    for (const target of DIR_TARGETS) {
      await removePath(join(workspaceDir, target));
    }

    let inner;
    try {
      inner = await readdir(workspaceDir);
    } catch {
      continue;
    }
    for (const name of inner) {
      if (name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX)) {
        await removePath(join(workspaceDir, name));
      }
    }
  }
}

await Promise.all(ROOTS.map(cleanWorkspace));
await removePath('.turbo');
