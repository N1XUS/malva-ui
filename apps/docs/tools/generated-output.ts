/**
 * Writes a generated, flat output directory in place.
 *
 * The docs dev server watches `apps/docs/src/generated/api`: its `index.ts`
 * is a static import of the API viewer, so if the file is missing for even one
 * watcher tick the incremental rebuild fails with "Could not resolve
 * ../../../generated/api" — and the server stays in that failed state until an
 * unrelated source file changes. Deleting the directory and rewriting it
 * therefore stalls every running `docs:serve` whenever `docs:extract-api` runs.
 *
 * This writer never removes the directory. Files whose content is unchanged are
 * left untouched (no mtime bump, no rebuild), changed files are written to a
 * temporary sibling and renamed into place so a reader sees either the old or
 * the new content but never a partial one, and stale entries are pruned only
 * after every current file exists.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GeneratedDirSyncResult {
  /** Entries whose content was created or replaced, in insertion order. */
  written: string[];
  /** Entries found in the directory that the current generation no longer produces. */
  removed: string[];
}

/**
 * Brings `outDir` to exactly `files` (entry name → content), creating the
 * directory if needed.
 *
 * @param outDir Absolute path of the flat output directory.
 * @param files Complete set of entries the directory must contain afterwards.
 */
export function syncGeneratedDir(
  outDir: string,
  files: ReadonlyMap<string, string>,
): GeneratedDirSyncResult {
  fs.mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  for (const [name, contents] of files) {
    const target = path.join(outDir, name);
    if (readIfPresent(target) === contents) continue;
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, contents, 'utf8');
    fs.renameSync(temp, target);
    written.push(name);
  }

  const removed: string[] = [];
  for (const entry of fs.readdirSync(outDir)) {
    if (files.has(entry)) continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
    removed.push(entry);
  }

  return { written, removed };
}

/** Current content of `file`, or `null` when it does not exist. */
function readIfPresent(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
