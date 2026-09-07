/**
 * Widens an exact third-party peer pin into a published `peerDependencies`
 * range. Used by `scripts/publish.mjs`; kept in its own module so
 * `scripts/widen-peer-range.spec.mjs` can exercise it without running a
 * publish.
 *
 * The root manifest pins Angular exactly (`@angular/core: 22.0.7`) so the
 * workspace builds deterministically. Copying that pin straight into a
 * published `peerDependencies` would make every consumer on any *other* patch
 * of the same major fail to install — npm reports the mismatch as `ERESOLVE`,
 * an install that stops, not a warning.
 *
 * Two widths, because the two families make different promises. See
 * VERSIONING.md § 9.
 */

/**
 * Peers whose published floor is the **major only** — `22.0.7` → `^22.0.0`,
 * whatever minor the workspace happens to build against.
 *
 * Angular's own minors are additive by policy, and every library in the
 * ecosystem publishes `^<major>.0.0` against them, so narrowing to the
 * workspace's minor would refuse installs Angular itself considers compatible.
 * It would also make a routine workspace bump — a pin moved for a patch, a
 * `ng update` run for an unrelated reason — silently raise a floor for every
 * consumer, which is a public API change nobody wrote down.
 *
 * `@angular/cdk` and `@angular/aria` version-lock to Angular's major, so they
 * belong here with `core`, `common` and `forms`.
 *
 * The cost is real and is accepted: if the library starts using an API that
 * landed in `22.3`, a consumer on `22.0` gets a compile or runtime failure
 * where a narrowed floor would have refused the install cleanly. VERSIONING.md
 * § 9 states the mitigation — the release notes name the Angular minor the
 * release was built against.
 */
const MAJOR_ONLY_PEER = /^@angular\//;

/**
 * Widens `version` for the peer named `name`.
 *
 * - `@malva-ui/*` siblings pass through **exact**: `release.projectsRelationship`
 *   is `"fixed"`, so they are always published together at one version.
 * - Angular-family exact pins widen to `^<major>.0.0` — see
 *   {@link MAJOR_ONLY_PEER}.
 * - Every other exact pin widens to `^<major>.<minor>.0`. Dropping those to
 *   `^<major>.0.0` would be wrong: a `@tiptap/*` peer resolved at `3.0.0`
 *   predates APIs the build actually uses, and tiptap makes no additive-minor
 *   promise.
 * - Anything the root already expresses as a range (`^1.25.0`, `~7.8.0`,
 *   `>=10.0.0`) passes through untouched.
 *
 * @param {string} name Peer package name.
 * @param {string} version The version or range the root manifest declares.
 * @returns {string} The range to publish.
 */
export const widenPeerRange = (name, version) => {
  if (name.startsWith('@malva-ui/')) return version;
  const exact = /^(\d+)\.(\d+)\.\d+$/.exec(version);
  if (!exact) return version;
  return MAJOR_ONLY_PEER.test(name)
    ? `^${exact[1]}.0.0`
    : `^${exact[1]}.${exact[2]}.0`;
};
