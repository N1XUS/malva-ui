/**
 * Build-time generator for the zero-install playground's dependency table.
 *
 * Runs via the Nx `docs:generate-playground-versions` target (a `dependsOn` of
 * `docs:build`, `docs:test`, `docs:typecheck` and `docs:serve`) and writes
 * `apps/docs/src/generated/playground-versions.ts`.
 *
 * `apps/docs/src/generated/` is git-ignored, so the table is never a checked-in
 * copy that can fall behind a release — it is re-derived from the workspace root
 * `package.json` on every build. The resolution rules live in
 * `./playground-manifest` so they can be unit tested without file writes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildPlaygroundManifest,
  findRepoRoot,
  renderPlaygroundVersionsModule,
} from './playground-manifest';

/** Path of the generated module, relative to the workspace root. */
const OUTPUT_FILE = path.join(
  'apps',
  'docs',
  'src',
  'generated',
  'playground-versions.ts',
);

/**
 * Published project names, read from `nx.json` rather than hardcoded so adding a
 * package to `release.projects` puts it in the playground table too.
 *
 * @param repoRoot Absolute path to the workspace root.
 */
function readReleaseProjects(repoRoot: string): string[] {
  const nxJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'nx.json'), 'utf8'),
  ) as { release?: { projects?: string[] } };
  const projects = nxJson.release?.projects;

  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('nx.json declares no release.projects to publish.');
  }

  return projects;
}

function main(): void {
  const repoRoot = findRepoRoot(process.cwd());
  const target = path.join(repoRoot, OUTPUT_FILE);
  const manifest = buildPlaygroundManifest(
    repoRoot,
    readReleaseProjects(repoRoot),
  );
  const contents = renderPlaygroundVersionsModule(manifest);

  fs.mkdirSync(path.dirname(target), { recursive: true });

  // Never bump the mtime for identical content: `docs:serve` watches this
  // directory and a rewrite on every invocation would restart the dev server's
  // incremental build for nothing. Same reasoning as `./generated-output.ts`.
  let current: string | null = null;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  if (current === contents) {
    console.log(`playground versions unchanged (${OUTPUT_FILE})`);
    return;
  }

  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, contents, 'utf8');
  fs.renameSync(temp, target);

  console.log(
    `wrote ${OUTPUT_FILE} — ${Object.keys(manifest.versions).length} packages, ` +
      `${Object.keys(manifest.peers).length} published Malva packages`,
  );
}

main();
