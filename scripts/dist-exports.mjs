/**
 * Malva UI Library — dist exports map preflight.
 *
 * `collectBrokenExports` proves every target an entry point's exports map
 * declares actually exists in the dist tree. A subpath that resolves to a
 * missing file fails at the consumer's first import and nowhere earlier, so
 * this runs as a publish gate rather than a build one.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolves every exports target (plus the top-level `module`/`typings`
 * fields) against the dist tree.
 *
 * @param {Record<string, unknown>} pkg Parsed dist package.json.
 * @param {string} distPath Absolute path of the package's dist directory.
 * @returns {string[]} Human-readable descriptions of unresolvable targets;
 * empty when the package is publishable.
 */
export function collectBrokenExports(pkg, distPath) {
  const broken = [];
  const check = (label, target) => {
    if (typeof target === 'string' && !existsSync(resolve(distPath, target))) {
      broken.push(`${label} → ${target}`);
    }
  };
  check('module', pkg.module);
  check('typings', pkg.typings);
  const exportsMap = pkg.exports;
  if (exportsMap && typeof exportsMap === 'object') {
    for (const [subpath, conditions] of Object.entries(exportsMap)) {
      if (typeof conditions === 'string') {
        check(subpath, conditions);
      } else if (typeof conditions === 'object' && conditions !== null) {
        for (const [condition, target] of Object.entries(conditions)) {
          check(`${subpath} (${condition})`, target);
        }
      }
    }
  }
  return broken;
}
