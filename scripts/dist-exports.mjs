/**
 * Malva UI Library — dist manifest preflight.
 *
 * Everything here asks one question of a **built** package: would a consumer
 * who installs this directory get what its manifest and our docs promise?
 * Nothing in the source tree can answer it, because every in-repo consumer
 * resolves `@malva-ui/*` through `tsconfig.base.json` paths or a workspace
 * symlink to the sources — never through the `exports` map, the `files`
 * allowlist or the `sideEffects` flag a real install goes through.
 *
 * - {@link collectBrokenExports} proves every target an exports map declares
 *   exists in the dist tree.
 * - {@link collectAssetProblems} proves a list of asset subpaths (stylesheets,
 *   `tokens.md`) is shipped, reachable through `exports` by Node's own
 *   resolver, and — for a stylesheet — not tree-shaken away as side-effect
 *   free.
 *
 * A failure here is a consumer's first `import` failing and nowhere earlier, so
 * both run as a publish gate (`scripts/publish.mjs`) and, over every release
 * package, as the `check-dist-assets` CI gate (`scripts/check-dist-assets.mjs`).
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, posix, relative, resolve, sep } from 'node:path';

/** Stylesheet extensions a bundler must keep as a side-effect import. */
const STYLESHEET = /\.(css|scss|sass|less)$/;

/**
 * Every file under `dir`, as absolute paths.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

/**
 * Whether an exports **pattern** target (`./styles/*`) matches at least one
 * file in the dist tree.
 *
 * Node substitutes whatever the key's `*` matched — which may span `/` — into
 * the target's `*`. A pattern that matches no file is exactly as dead as a
 * literal target that does not exist, so it is reported the same way. Read
 * literally instead, `existsSync('./styles/*')` is false for every pattern, so
 * this preflight would have refused the first one a package shipped (#310).
 *
 * @param {string} distPath Absolute path of the package's dist directory.
 * @param {string} target Exports target containing a `*`.
 * @returns {boolean}
 */
function patternMatchesAFile(distPath, target) {
  const star = target.indexOf('*');
  const prefix = posix.normalize(target.slice(0, star)).replace(/^\.\//, '');
  const suffix = target.slice(star + 1);
  const dir = resolve(distPath, prefix.slice(0, prefix.lastIndexOf('/') + 1));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  return listFiles(dir).some((file) => {
    const rel = relative(distPath, file).split(sep).join('/');
    return (
      rel.length > prefix.length + suffix.length &&
      rel.startsWith(prefix) &&
      rel.endsWith(suffix)
    );
  });
}

/**
 * Resolves every exports target (plus the top-level `module`/`typings`
 * fields) against the dist tree.
 *
 * Condition objects are followed to any depth and fallback arrays entry by
 * entry. A `null` target is an explicit exclusion, not a file, and is skipped.
 * A target containing `*` is a subpath pattern and passes when it matches at
 * least one file.
 *
 * @param {Record<string, unknown>} pkg Parsed dist package.json.
 * @param {string} distPath Absolute path of the package's dist directory.
 * @returns {string[]} Human-readable descriptions of unresolvable targets;
 * empty when the package is publishable.
 */
export function collectBrokenExports(pkg, distPath) {
  const broken = [];
  const check = (label, target) => {
    if (typeof target !== 'string') return;
    const exists = target.includes('*')
      ? patternMatchesAFile(distPath, target)
      : existsSync(resolve(distPath, target));
    if (!exists) broken.push(`${label} → ${target}`);
  };
  const visit = (label, target) => {
    if (Array.isArray(target)) {
      target.forEach((entry, index) => visit(`${label} [${index}]`, entry));
    } else if (typeof target === 'object' && target !== null) {
      for (const [condition, nested] of Object.entries(target)) {
        visit(`${label} (${condition})`, nested);
      }
    } else {
      check(label, target);
    }
  };
  check('module', pkg.module);
  check('typings', pkg.typings);
  const exportsMap = pkg.exports;
  if (exportsMap && typeof exportsMap === 'object') {
    for (const [subpath, conditions] of Object.entries(exportsMap)) {
      visit(subpath, conditions);
    }
  }
  return broken;
}

/**
 * Whether a bundler keeps a bindings-less `import '<pkg>/<subpath>'`.
 *
 * Mirrors the `sideEffects` semantics webpack, esbuild and Vite share: absent
 * means "has side effects", a boolean applies to every file, and a glob list
 * is matched against the path relative to the package root — a leading `./`
 * is ignored, and a glob with no `/` matches at any depth (`*.css` matches
 * `styles/malva-ui.css`).
 *
 * ng-packagr writes `sideEffects: false` when the source manifest says nothing,
 * and webpack 5 in production mode then drops a stylesheet a consumer imports
 * from JavaScript, silently — measured for #310, along with esbuild 0.28 and
 * Vite 8, which keep a CSS import whatever the flag says. So the flag is what
 * decides it for a webpack (or Rspack) consumer, and a stylesheet the package
 * exports has to be listed.
 *
 * @param {Record<string, unknown>} pkg Parsed dist package.json.
 * @param {string} subpath Path relative to the package root, no leading `./`.
 * @returns {boolean}
 */
export function hasSideEffects(pkg, subpath) {
  const flag = pkg.sideEffects;
  if (flag === undefined) return true;
  if (typeof flag === 'boolean') return flag;
  const patterns =
    typeof flag === 'string' ? [flag] : Array.isArray(flag) ? flag : [];
  return patterns.some((pattern) => {
    if (typeof pattern !== 'string') return false;
    const glob = pattern.replace(/^\.\//, '');
    return posix.matchesGlob(subpath, glob.includes('/') ? glob : `**/${glob}`);
  });
}

/**
 * Whether npm packs `subpath` given the manifest's `files` allowlist.
 *
 * No `files` field packs the whole directory (every ng-packagr package here).
 * With one, an entry names a file, a directory (everything under it) or a glob;
 * `package.json`, `README*` and `LICENSE*`/`LICENCE*` are packed regardless.
 *
 * @param {Record<string, unknown>} pkg Parsed dist package.json.
 * @param {string} subpath Path relative to the package root, no leading `./`.
 * @returns {boolean}
 */
export function isPackedByFiles(pkg, subpath) {
  if (!Array.isArray(pkg.files)) return true;
  if (/^(package\.json|readme(\..*)?|licen[cs]e(\..*)?)$/i.test(subpath)) {
    return true;
  }
  return pkg.files.some((entry) => {
    if (typeof entry !== 'string') return false;
    const glob = entry.replace(/^\.\//, '').replace(/\/+$/, '');
    return (
      subpath === glob ||
      subpath.startsWith(`${glob}/`) ||
      posix.matchesGlob(subpath, glob) ||
      posix.matchesGlob(subpath, `${glob}/**`)
    );
  });
}

/**
 * Resolves `<packageName>/<subpath>` for each subpath with **Node's own**
 * resolver, from a throwaway consumer whose `node_modules/<packageName>` is a
 * symlink to the dist directory — so the generated `exports` map decides, as
 * it does for every exports-enforcing resolver a consumer uses (Node, esbuild
 * under `@angular/build`, Vite, webpack 5).
 *
 * Asset exports are plain string targets, so the `require` condition set this
 * resolves with gives the same answer as `import` or `style` would.
 *
 * @param {string} packageName Published name, e.g. `@malva-ui/core`.
 * @param {string} distPath Absolute path of the package's dist directory.
 * @param {readonly string[]} subpaths Paths relative to the package root.
 * @returns {Map<string, { resolved: string } | { error: string }>} Keyed by
 * subpath; `resolved` is a real path.
 */
export function resolveThroughExports(packageName, distPath, subpaths) {
  const results = new Map();
  if (!subpaths.length) return results;
  const consumer = mkdtempSync(join(tmpdir(), 'mlv-dist-consumer-'));
  try {
    const link = join(consumer, 'node_modules', ...packageName.split('/'));
    mkdirSync(resolve(link, '..'), { recursive: true });
    // `junction` is what Windows needs for a directory link without elevated
    // rights; every other platform ignores the type argument.
    symlinkSync(distPath, link, 'junction');
    const entry = join(consumer, 'consumer.cjs');
    writeFileSync(entry, '');
    const consumerRequire = createRequire(entry);
    for (const subpath of subpaths) {
      try {
        results.set(subpath, {
          resolved: realpathSync(
            consumerRequire.resolve(`${packageName}/${subpath}`),
          ),
        });
      } catch (error) {
        const message = String(error?.message ?? error).split('\n')[0];
        results.set(subpath, {
          error: error?.code ? `${error.code}: ${message}` : message,
        });
      }
    }
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
  return results;
}

/**
 * Proves each asset subpath is something a consumer can actually use:
 *
 * 1. the file is in the dist tree (`missing`);
 * 2. the `files` allowlist packs it (`not packed`);
 * 3. `<packageName>/<subpath>` resolves through `exports` to that same file
 *    (`not exported`) — the bare form a CSS `@import`, a Sass `@use` or a JS
 *    side-effect import is written in;
 * 4. a stylesheet is not covered by `sideEffects: false`
 *    (`side-effect free`), which lets webpack drop the JS import form.
 *
 * @param {string} packageName Published name, e.g. `@malva-ui/core`.
 * @param {Record<string, unknown>} pkg Parsed dist package.json.
 * @param {string} distPath Absolute path of the package's dist directory.
 * @param {readonly string[]} subpaths Paths relative to the package root.
 * @returns {{ subpath: string, message: string }[]} One entry per problem,
 * `message` naming the subpath; empty when clean.
 */
export function collectAssetProblems(packageName, pkg, distPath, subpaths) {
  const problems = [];
  const report = (subpath, reason) =>
    problems.push({ subpath, message: `${subpath}: ${reason}` });

  const present = subpaths.filter((subpath) => {
    if (existsSync(join(distPath, subpath))) return true;
    report(subpath, 'missing — not in the built package');
    return false;
  });
  const resolutions = resolveThroughExports(packageName, distPath, present);
  for (const subpath of present) {
    if (!isPackedByFiles(pkg, subpath)) {
      report(subpath, 'not packed — the `files` allowlist leaves it out');
    }
    const resolution = resolutions.get(subpath);
    const specifier = `${packageName}/${subpath}`;
    if ('error' in resolution) {
      report(
        subpath,
        `not exported — \`${specifier}\` does not resolve (${resolution.error})`,
      );
    } else if (resolution.resolved !== realpathSync(join(distPath, subpath))) {
      // Both sides are real paths: `distPath` itself may sit behind a symlink
      // (`/var` → `/private/var` on macOS), which the resolver has undone.
      const shown = relative(realpathSync(distPath), resolution.resolved)
        .split(sep)
        .join('/');
      report(
        subpath,
        `not exported — \`${specifier}\` resolves to ${shown} instead`,
      );
    }
    if (STYLESHEET.test(subpath) && !hasSideEffects(pkg, subpath)) {
      report(
        subpath,
        `side-effect free — \`sideEffects\` lets webpack drop \`import '${specifier}'\` in a production build`,
      );
    }
  }
  return problems;
}
