/**
 * Materialises one docs example's playground project on disk.
 *
 * Runs via the Nx `docs:write-playground-project` target, and exists so
 * `.github/workflows/playground.yml` can run a real `npm install` + `ng build`
 * against the published packages. The project it writes comes from the very
 * same `createPlaygroundProject` the browser button posts to StackBlitz, so a
 * green build there is evidence about the payload users actually receive — not
 * about a second, CI-only scaffold that could drift from it.
 *
 * Usage:
 *   node node_modules/jiti/lib/jiti-cli.mjs apps/docs/tools/write-playground-project.ts \
 *     [--example <page>/examples/<n>] [--out <dir>] [--allow-unpublished]
 *
 * Defaults: `--example button/examples/1`, `--out dist/playground`.
 *
 * `--allow-unpublished` writes the project even when it names a package npm has
 * never seen, which the browser button refuses to build (`UNPUBLISHED_PACKAGES`).
 * The workflow passes it because materialising the project and deciding whether
 * npm can install it are two different jobs: the preflight step answers the
 * second, over the network, and skips loudly. Without it the scheduler and
 * taskboard legs could not run at all, and would start proving nothing on the
 * day those packages ship instead of starting to prove something.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createPlaygroundProject,
  UNPUBLISHED_PACKAGES,
  type PlaygroundProject,
} from '../src/app/shared/playground/playground-project';
import { pagesDirOf, readExample } from './playground-corpus';
import { buildPlaygroundManifest, findRepoRoot } from './playground-manifest';

/** Reads a `--flag value` pair from the argument list. */
function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

/**
 * Published project names, read from `nx.json` rather than hardcoded.
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

/** Writes every file of `project` under `outDir`, creating directories. */
function writeProject(project: PlaygroundProject, outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });

  for (const [file, contents] of Object.entries(project.files)) {
    const target = path.join(outDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
}

function main(): void {
  const repoRoot = findRepoRoot(process.cwd());
  const toolsDir = path.join(repoRoot, 'apps', 'docs', 'tools');
  const id = flag('example', 'button/examples/1');
  const outDir = path.resolve(repoRoot, flag('out', 'dist/playground'));

  const allowUnpublished = process.argv.includes('--allow-unpublished');

  const example = readExample(pagesDirOf(toolsDir), id);
  if (!example) {
    throw new Error(`No docs example at apps/docs/src/app/pages/${id}.`);
  }

  const manifest = buildPlaygroundManifest(
    repoRoot,
    readReleaseProjects(repoRoot),
  );
  const { project, blockedBy } = createPlaygroundProject({
    files: example.files,
    versions: manifest.versions,
    peers: manifest.peers,
    title: `Malva UI — ${id}`,
    description: 'A runnable copy of an example from the Malva UI docs.',
    unpublished: allowUnpublished ? [] : undefined,
  });

  if (!project) {
    throw new Error(`"${id}" cannot be opened in the playground: ${blockedBy}`);
  }

  writeProject(project, outDir);

  const relative = path.relative(repoRoot, outDir);
  console.log(
    `wrote ${Object.keys(project.files).length} files for "${id}" to ${relative}`,
  );

  // Read by the workflow's preflight step, which skips the install when any of
  // these is not on the registry yet. Two ways that happens, both legitimate
  // and neither a template defect: the window between the release commit
  // bumping the root manifest and `scripts/publish.mjs` pushing the tarballs,
  // and a package that is in `nx.json` -> `release.projects` but has not had a
  // release since it landed (`@malva-ui/scheduler` and `@malva-ui/taskboard`
  // are both in that state as of 0.1.15).
  const dependencies = (
    JSON.parse(project.files['package.json']) as {
      dependencies: Record<string, string>;
    }
  ).dependencies;
  const malva = Object.entries(dependencies)
    .filter(([name]) => name.startsWith('@malva-ui/'))
    .map(([name, version]) => `${name}@${version}`);

  console.log(`malva-ui-version=${manifest.versions['@malva-ui/core']}`);
  console.log(`malva-ui-packages=${malva.join(' ')}`);
  // The claim the browser button is withholding itself on. The workflow checks
  // it the only way it can be checked — with `npm view` — and fails if any of
  // these has since been published, because then the exclusion is a bug.
  console.log(`malva-ui-unpublished=${UNPUBLISHED_PACKAGES.join(' ')}`);
}

main();
