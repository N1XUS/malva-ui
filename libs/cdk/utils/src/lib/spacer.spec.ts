import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

import { MlvSpacer } from './spacer';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the paths
// are resolved from this file rather than from `process.cwd()`.
const HERE = dirname(fileURLToPath(import.meta.url));
const SPACER_TS = resolve(HERE, './spacer.ts');
const SPACER_SCSS = resolve(HERE, './spacer.scss');

/**
 * `<mlv-spacer>` is the library's one spacer — `MlvActionBarSpacer` was deleted
 * in favour of it (`docs/migrations/2026-09-page-rebuild.md`), so the two
 * guarantees that spacer's own style spec carried live here now.
 */
describe('MlvSpacer styles', () => {
  it('lives in a stylesheet rather than an inline `styles:` array', () => {
    // An inline `styles: []` array is invisible to `libs/styles`' layer guard,
    // which walks `.css` / `.scss` files only — and an unlayered library rule
    // outranks every layered one, so a consumer's own
    // `@layer mlv.components { .mlv-spacer { flex: 0 0 auto } }` could never
    // win.
    const source = readFileSync(SPACER_TS, 'utf8');
    // Anchored to a metadata property, so the prose above that names the
    // rejected form does not satisfy its own assertion.
    expect(source).not.toMatch(/^\s*styles:\s*\[/m);
    expect(source).toMatch(/^\s*styleUrl: '\.\/spacer\.scss',$/m);
  });

  it('emits its rule inside @layer mlv.components', () => {
    const css = sass.compile(SPACER_SCSS).css;
    expect(css).toMatch(/@layer\s+mlv\.components\s*\{/);
    expect(stripCssLayersFromText(css)).toContain('.mlv-spacer');
  });

  it('keeps the spacer flexing', () => {
    // The whole point of the element: it takes the free space in a flex row so
    // whatever follows it is pushed to the trailing edge.
    const css = stripCssLayersFromText(sass.compile(SPACER_SCSS).css);
    expect(css).toContain('flex: 1 1 auto');
  });
});

@Component({
  selector: 'mlv-spacer-test-host',
  imports: [MlvSpacer],
  template: `
    <div class="plain">
      <button type="button">Save</button>
      <mlv-spacer />
      <button type="button">Cancel</button>
    </div>

    <div role="toolbar" aria-label="Formatting">
      <button type="button">Bold</button>
      <mlv-spacer />
      <button type="button">Italic</button>
    </div>

    <ul role="menu" aria-label="Commands">
      <li role="menuitem" tabindex="0">
        Open
        <mlv-spacer />
        <span aria-hidden="true">&rsaquo;</span>
      </li>
    </ul>

    <ul role="list" class="owning-list">
      <li role="listitem">Item</li>
      <mlv-spacer />
    </ul>
  `,
})
class SpacerTestHost {}

/**
 * Accessibility sweep — `<mlv-spacer>`.
 *
 * The component renders an empty element with one class and nothing else, so
 * on its own there is nothing for axe to judge. What is worth judging is where
 * it lands: a roleless element inside a container role is *owned* by that role,
 * and a role with a required-children contract (`list`, `menu`, `listbox`)
 * counts it. So the states here are the parents the library actually puts a
 * spacer into — a plain flex row (`mlv-toolbar`, `[mlvActionBar]`), an explicit
 * `role="toolbar"`, and a `role="menuitem"` row (the `mlv-menubar` shape) —
 * plus a `role="list"`, the strictest parent, so the owned-children answer is
 * pinned rather than assumed.
 */
describe('MlvSpacer accessibility', () => {
  it('has no axe violations in the parents the library places it in', async () => {
    await TestBed.configureTestingModule({
      imports: [SpacerTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpacerTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // Four spacers, one per parent shape, each an empty element with no role.
    const spacers = [...host.querySelectorAll('mlv-spacer')] as HTMLElement[];
    expect(spacers).toHaveLength(4);
    expect(spacers.every((el) => el.getAttribute('role') === null)).toBe(true);
    expect(spacers.every((el) => el.textContent === '')).toBe(true);
    expect(spacers.every((el) => el.classList.contains('mlv-spacer'))).toBe(
      true,
    );

    // Rooted at the host, so every container role above a spacer — the toolbar,
    // the menu and the list — is itself in scope. A sweep rooted at a spacer
    // would never evaluate the rule those parents own.
    await expectNoAxeViolations(host);
  });
});
