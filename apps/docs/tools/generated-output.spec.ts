import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { syncGeneratedDir } from './generated-output';

/** Far enough in the past that any rewrite is visible as a newer mtime. */
const PAST = new Date('2020-01-01T00:00:00Z');

function seed(dir: string, name: string, contents: string): string {
  const file = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
  fs.utimesSync(file, PAST, PAST);
  return file;
}

function read(dir: string, name: string): string {
  return fs.readFileSync(path.join(dir, name), 'utf8');
}

describe('syncGeneratedDir', () => {
  let root: string;
  let outDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mlv-generated-output-'));
    outDir = path.join(root, 'generated', 'api');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('creates the directory and writes every entry on a first run', () => {
    const result = syncGeneratedDir(
      outDir,
      new Map([
        ['button.json', '{"name":"button"}\n'],
        ['index.ts', 'export const apiEntryLoaders = {};\n'],
      ]),
    );

    expect(fs.readdirSync(outDir).sort()).toEqual(['button.json', 'index.ts']);
    expect(read(outDir, 'button.json')).toBe('{"name":"button"}\n');
    expect(read(outDir, 'index.ts')).toBe(
      'export const apiEntryLoaders = {};\n',
    );
    expect(result).toEqual({
      written: ['button.json', 'index.ts'],
      removed: [],
    });
  });

  it('leaves a file whose content is unchanged untouched', () => {
    // The dev server watches this directory. A file that is byte-identical must
    // not be rewritten: no mtime bump means no rebuild, and the module map in
    // particular never disappears from under the running bundle.
    const file = seed(
      outDir,
      'index.ts',
      'export const apiEntryLoaders = {};\n',
    );
    const before = fs.statSync(file);

    const result = syncGeneratedDir(
      outDir,
      new Map([['index.ts', 'export const apiEntryLoaders = {};\n']]),
    );

    const after = fs.statSync(file);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(after.ino).toBe(before.ino);
    expect(result).toEqual({ written: [], removed: [] });
  });

  it('replaces a file whose content changed and reports it', () => {
    seed(outDir, 'button.json', '{"symbols":1}\n');
    seed(outDir, 'index.ts', 'export const apiEntryLoaders = {};\n');

    const result = syncGeneratedDir(
      outDir,
      new Map([
        ['button.json', '{"symbols":2}\n'],
        ['index.ts', 'export const apiEntryLoaders = {};\n'],
      ]),
    );

    expect(read(outDir, 'button.json')).toBe('{"symbols":2}\n');
    // Exactly the expected set: no temporary sibling left behind.
    expect(fs.readdirSync(outDir).sort()).toEqual(['button.json', 'index.ts']);
    expect(result).toEqual({ written: ['button.json'], removed: [] });
  });

  it('prunes entries that are no longer generated', () => {
    seed(outDir, 'removed-page.json', '{}\n');
    seed(outDir, 'button.json', '{"symbols":1}\n');
    seed(outDir, 'index.ts', 'old\n');

    const result = syncGeneratedDir(
      outDir,
      new Map([
        ['button.json', '{"symbols":1}\n'],
        ['index.ts', 'new\n'],
      ]),
    );

    expect(fs.readdirSync(outDir).sort()).toEqual(['button.json', 'index.ts']);
    expect(read(outDir, 'index.ts')).toBe('new\n');
    expect(result).toEqual({
      written: ['index.ts'],
      removed: ['removed-page.json'],
    });
  });
});
