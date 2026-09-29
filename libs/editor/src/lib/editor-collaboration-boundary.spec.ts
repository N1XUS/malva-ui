import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/*
 * The primary entry point `@malva-ui/editor` must not reach the collaboration
 * stack. The packages are peers every install carries, but only
 * `@malva-ui/editor/collaboration` imports them, so a bundle that does not
 * import that entry holds no Yjs code at all (F-D1).
 */

const ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), '../index.ts');

/** Bare specifiers, and their subpaths, the primary entry must never import. */
const FORBIDDEN = [
  'yjs',
  'y-protocols',
  'lib0',
  '@tiptap/y-tiptap',
  '@tiptap/extension-collaboration',
  '@malva-ui/editor/collaboration',
];

/** The file a relative specifier names, or `null`. */
function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts'), base]) {
    if (candidate.endsWith('.ts') && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every file the entry reaches by relative import, with the bare specifiers each imports. */
function walk(entry: string): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (graph.has(file)) continue;
    const { importedFiles } = ts.preProcessFile(
      readFileSync(file, 'utf8'),
      true,
      true,
    );
    const bare: string[] = [];
    for (const { fileName } of importedFiles) {
      if (fileName.startsWith('.')) {
        const target = resolveRelative(file, fileName);
        if (!target) throw new Error(`${file}: cannot resolve ${fileName}`);
        queue.push(target);
      } else {
        bare.push(fileName);
      }
    }
    graph.set(file, bare);
  }
  return graph;
}

describe('@malva-ui/editor — collaboration boundary', () => {
  it('reaches no collaboration package from the primary entry point', () => {
    const graph = walk(ENTRY);
    // A walk that saw almost nothing would pass vacuously.
    expect(graph.size).toBeGreaterThan(20);
    const offenders: string[] = [];
    graph.forEach((specifiers, file) => {
      for (const specifier of specifiers) {
        if (
          FORBIDDEN.some(
            (name) => specifier === name || specifier.startsWith(`${name}/`),
          )
        ) {
          offenders.push(`${file.slice(file.indexOf('libs/'))}: ${specifier}`);
        }
      }
    });
    expect(offenders).toEqual([]);
  });
});
