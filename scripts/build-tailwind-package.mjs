import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(workspaceRoot, 'libs/tailwind');
const outputRoot = resolve(workspaceRoot, 'dist/libs/tailwind');

const files = [
  'package.json',
  'theme.css',
  'README.md',
  'LICENSE',
  'schematics',
];

for (const file of files) {
  if (!existsSync(resolve(sourceRoot, file))) {
    throw new Error(`Cannot stage @malva-ui/tailwind: missing ${file}.`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const file of files) {
  cpSync(resolve(sourceRoot, file), resolve(outputRoot, file), {
    recursive: true,
  });
}

console.log(`Staged @malva-ui/tailwind at ${outputRoot}`);
