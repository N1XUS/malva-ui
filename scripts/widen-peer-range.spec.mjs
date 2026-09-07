/**
 * Tests for `scripts/widen-peer-range.mjs`.
 *
 * This is release machinery with no other coverage: it runs once, inside
 * `scripts/publish.mjs`, against a `dist/` manifest, and what it writes is the
 * `peerDependencies` every consumer installs against. A wrong width here is a
 * published fact — either an install that fails for consumers Angular itself
 * considers compatible, or a range that promises a version the build does not
 * support. Neither is visible until someone installs the package.
 *
 * Run by the root `test` target — see `project.json`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { widenPeerRange } from './widen-peer-range.mjs';

test('Angular-family exact pins widen to the major only', () => {
  // The workspace's minor must not reach the published range: a routine pin
  // bump would otherwise raise every consumer's floor silently.
  assert.equal(widenPeerRange('@angular/core', '22.0.7'), '^22.0.0');
  assert.equal(widenPeerRange('@angular/core', '22.3.1'), '^22.0.0');
  assert.equal(widenPeerRange('@angular/common', '22.1.5'), '^22.0.0');
  assert.equal(widenPeerRange('@angular/forms', '22.1.5'), '^22.0.0');
  // cdk and aria version-lock to Angular's major, so they take the same width.
  assert.equal(widenPeerRange('@angular/cdk', '22.1.5'), '^22.0.0');
  assert.equal(widenPeerRange('@angular/aria', '22.0.7'), '^22.0.0');
});

test('a moved Angular minor does not move the published floor', () => {
  const before = widenPeerRange('@angular/core', '22.0.7');
  const after = widenPeerRange('@angular/core', '22.4.0');
  assert.equal(
    before,
    after,
    'raising the workspace pin within a major must not change what is published',
  );
});

test('non-Angular exact pins keep the minor floor', () => {
  // A @tiptap peer resolved at 3.0.0 predates APIs the build uses, and tiptap
  // makes no additive-minor promise — so the minor stays in the range.
  assert.equal(widenPeerRange('@tiptap/core', '3.29.2'), '^3.29.0');
  assert.equal(widenPeerRange('@tiptap/starter-kit', '3.29.2'), '^3.29.0');
  assert.equal(widenPeerRange('sortablejs', '1.15.6'), '^1.15.0');
});

test('a name merely containing "@angular/" is not Angular-family', () => {
  // The pattern is anchored, so a third-party package that mentions the scope
  // inside its own name keeps the minor floor. Asserted at a version where the
  // two widths differ — at `22.0.x` they coincide and the test would pass
  // whether or not the anchor is there.
  assert.equal(widenPeerRange('not-@angular/core', '22.3.1'), '^22.3.0');
  assert.equal(widenPeerRange('@angular/core', '22.3.1'), '^22.0.0');
});

test('@malva-ui siblings pass through exact', () => {
  // release.projectsRelationship is "fixed": they publish together at one
  // version, so a range would let a consumer mix two of them.
  assert.equal(widenPeerRange('@malva-ui/cdk', '0.1.12'), '0.1.12');
  assert.equal(widenPeerRange('@malva-ui/core', '1.0.0'), '1.0.0');
});

test('ranges the root already expresses pass through untouched', () => {
  assert.equal(widenPeerRange('@lucide/angular', '^1.25.0'), '^1.25.0');
  assert.equal(widenPeerRange('rxjs', '~7.8.0'), '~7.8.0');
  assert.equal(widenPeerRange('intl-messageformat', '>=10.0.0'), '>=10.0.0');
  assert.equal(widenPeerRange('tailwindcss', '^4.0.0'), '^4.0.0');
  assert.equal(
    widenPeerRange('@angular/core', '^22.0.0 || ^23.0.0'),
    '^22.0.0 || ^23.0.0',
    'an explicit range is a deliberate declaration, not something to rewrite',
  );
});

test('prerelease and non-numeric pins are not treated as exact', () => {
  // `22.0.0-next.3` is not `\\d+.\\d+.\\d+`, so it passes through rather than
  // widening to a range that would also admit the stable line.
  assert.equal(widenPeerRange('@angular/core', '22.0.0-next.3'), '22.0.0-next.3');
  assert.equal(widenPeerRange('@tiptap/core', 'next'), 'next');
});
