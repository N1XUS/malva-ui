/**
 * Reads docs examples off disk in the shape the runtime hands the playground
 * builder.
 *
 * Shared by `./playground-corpus.spec.ts`, which sweeps every example, and
 * `./write-playground-project.ts`, which materialises one to disk for the
 * networked CI job — so the project CI builds is produced by the same code path
 * the browser button uses, not a second approximation of it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlaygroundSourceFile } from '../src/app/shared/playground/playground-project';

/** A docs example read off disk. */
export interface CorpusExample {
  /** `<page>/examples/<index>` — the id used to name one. */
  readonly id: string;
  /** Resolved source files, in the `docsExample` pipe's tab order. */
  readonly files: readonly PlaygroundSourceFile[];
  /** The example's TypeScript source. */
  readonly source: string;
}

/** Tab name → the file extension it is read from. */
const OPTIONAL_SOURCES = [
  ['HTML', 'html'],
  ['SCSS', 'scss'],
] as const;

/**
 * Absolute path of the docs `pages` directory.
 *
 * @param toolsDir Absolute path of `apps/docs/tools`.
 */
export function pagesDirOf(toolsDir: string): string {
  return path.join(toolsDir, '..', 'src', 'app', 'pages');
}

/**
 * Reads one example, or `null` when the directory holds no `index.ts`.
 *
 * Empty files are dropped, exactly as the `docsExample` pipe and
 * `ExampleContainerComponent` drop them, so what comes back is what the builder
 * is really handed at runtime. `card/examples/7` ships a 0-byte `index.scss`
 * and is the reason that matters.
 *
 * @param pagesDir Absolute path of the docs `pages` directory.
 * @param id `<page>/examples/<index>`.
 */
export function readExample(
  pagesDir: string,
  id: string,
): CorpusExample | null {
  const dir = path.join(pagesDir, ...id.split('/'));
  const typescript = path.join(dir, 'index.ts');
  if (!fs.existsSync(typescript)) return null;

  const source = fs.readFileSync(typescript, 'utf8');
  const files: PlaygroundSourceFile[] = [
    { type: 'TypeScript', content: source },
  ];

  for (const [type, extension] of OPTIONAL_SOURCES) {
    const file = path.join(dir, `index.${extension}`);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (content.length > 0) files.push({ type, content });
  }

  return { id, files, source };
}

/**
 * Reads every `pages/<page>/examples/<n>` directory that has an `index.ts`,
 * ordered by id.
 *
 * @param pagesDir Absolute path of the docs `pages` directory.
 */
export function readCorpus(pagesDir: string): CorpusExample[] {
  const examples: CorpusExample[] = [];

  for (const page of fs.readdirSync(pagesDir).sort()) {
    const examplesDir = path.join(pagesDir, page, 'examples');
    if (!fs.existsSync(examplesDir)) continue;

    for (const index of fs.readdirSync(examplesDir).sort()) {
      const example = readExample(pagesDir, `${page}/examples/${index}`);
      if (example) examples.push(example);
    }
  }

  return examples;
}
