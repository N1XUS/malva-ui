import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvShrinkWrap, MlvShrinkWrapContent } from './shrink-wrap';

/**
 * The whole shrink-wrap mechanism is CSS scroll-driven animations
 * (`@property`, `timeline-scope`, `view-timeline`, `animation-timeline`) —
 * jsdom (this project's unit-test DOM) implements none of it: it neither
 * registers custom-property syntax nor runs animations, so no assertion here
 * can observe the actual width correction taking effect. These specs instead
 * assert (a) the compiled SCSS source contains the exact mechanism pieces —
 * the registrations, the timeline wiring, and the calc() formula — and (b)
 * the Angular-side contract each pair member is responsible for: the host
 * attribute/style binding on `MlvShrinkWrap`, and the DOM shape
 * `MlvShrinkWrapContent` renders. Real cross-engine behaviour is verified
 * visually (Chromium) rather than in this jsdom suite.
 *
 * `new URL(…, import.meta.url)` is rewritten by Vite into an asset URL, so
 * the sibling stylesheet is resolved from this file's own path instead.
 */
const shrinkWrapScss = readFileSync(
  fileURLToPath(import.meta.url).replace(/\.spec\.ts$/, '.scss'),
  'utf8',
);

describe('shrink-wrap.scss mechanism', () => {
  it('registers both custom properties as inherited numbers', () => {
    expect(shrinkWrapScss).toContain('@property --mlv-shrink-wrap-host');
    expect(shrinkWrapScss).toContain('@property --mlv-shrink-wrap-item');
    // Both @property blocks share the same syntax/inherits/initial-value —
    // assert the declarations exist without pinning to a single shared block.
    const propertyBlocks = shrinkWrapScss.match(
      /@property --mlv-shrink-wrap-(?:host|item)\s*{[^}]*}/g,
    );
    expect(propertyBlocks).toHaveLength(2);
    for (const block of propertyBlocks ?? []) {
      expect(block).toContain("syntax: '<number>'");
      expect(block).toContain('inherits: true');
      expect(block).toContain('initial-value: 0');
    }
  });

  it('declares the mlv-prefixed keyframes driving each property to 1', () => {
    expect(shrinkWrapScss).toContain('@keyframes mlv-shrink-wrap-host');
    expect(shrinkWrapScss).toContain('@keyframes mlv-shrink-wrap-item');
    expect(shrinkWrapScss).toContain('--mlv-shrink-wrap-host: 1');
    expect(shrinkWrapScss).toContain('--mlv-shrink-wrap-item: 1');
  });

  it('wires timeline-scope and animation-timeline on the [mlvShrinkWrap] selector', () => {
    expect(shrinkWrapScss).toContain('[mlvShrinkWrap] {');
    expect(shrinkWrapScss).toContain(
      'timeline-scope: --mlv-shrink-wrap-host, --mlv-shrink-wrap-item;',
    );
    expect(shrinkWrapScss).toContain(
      'animation-timeline: --mlv-shrink-wrap-host, --mlv-shrink-wrap-item;',
    );
    expect(shrinkWrapScss).toContain('animation-range: entry 100% exit 100%;');
  });

  it('computes the negative correction with the exact calc formula', () => {
    expect(shrinkWrapScss).toContain(
      '--mlv-shrink-wrap: calc(\n    -1px / (1 - var(--mlv-shrink-wrap-host)) * var(--mlv-shrink-wrap-item)\n  );',
    );
  });

  it('applies overflow: hidden, text-wrap: balance, and the item/host view-timelines on .mlv-shrink-wrap', () => {
    expect(shrinkWrapScss).toContain('.mlv-shrink-wrap {');
    expect(shrinkWrapScss).toContain('overflow: hidden;');
    expect(shrinkWrapScss).toContain('text-wrap: balance;');
    expect(shrinkWrapScss).toContain(
      'margin-inline-end: var(--mlv-shrink-wrap, 0px);',
    );
    expect(shrinkWrapScss).toContain(
      'view-timeline: --mlv-shrink-wrap-item inline;',
    );
    expect(shrinkWrapScss).toContain(
      'view-timeline: --mlv-shrink-wrap-host inline;',
    );
  });

  it('documents the measurement-not-motion reduced-motion exemption', () => {
    // No @media (prefers-reduced-motion) gate — see the JSDoc/comment above
    // [mlvShrinkWrap] for why disabling this animation would break the
    // feature rather than remove any perceived motion. The literal string
    // still needs to appear so the repo-wide grep-based reduced-motion
    // completeness check (every stylesheet with @keyframes/animation: is
    // expected to at least discuss reduced-motion) does not flag this file
    // as an unreviewed gap.
    expect(shrinkWrapScss).toContain('reduced-motion');
    expect(shrinkWrapScss).not.toContain('@media (prefers-reduced-motion');
  });
});

@Component({
  template: `
    <div [mlvShrinkWrap]="maxWidth">
      <mlv-shrink-wrap>
        <span>{{ text }}</span>
      </mlv-shrink-wrap>
    </div>
  `,
  imports: [MlvShrinkWrap, MlvShrinkWrapContent],
})
class ShrinkWrapTestHost {
  maxWidth = '';
  text = 'Hello world';
}

describe('MlvShrinkWrap', () => {
  it('writes the static mlvShrinkWrap attribute unconditionally', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ShrinkWrapTestHost],
    }).createComponent(ShrinkWrapTestHost);
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(host.hasAttribute('mlvShrinkWrap')).toBe(true);
    expect(host.getAttribute('mlvShrinkWrap')).toBe('');
  });

  it('defaults max-inline-size to calc(100% + the correction variable)', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ShrinkWrapTestHost],
    }).createComponent(ShrinkWrapTestHost);
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(host.style.getPropertyValue('max-inline-size')).toBe(
      'calc(100% + var(--mlv-shrink-wrap, 0px))',
    );
  });

  it('substitutes an explicit mlvShrinkWrap input into the calc base', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ShrinkWrapTestHost],
    }).createComponent(ShrinkWrapTestHost);
    fixture.componentInstance.maxWidth = '20rem';
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(host.style.getPropertyValue('max-inline-size')).toBe(
      'calc(20rem + var(--mlv-shrink-wrap, 0px))',
    );
  });
});

describe('MlvShrinkWrapContent', () => {
  it('wraps projected content in a <span> under the mlv-shrink-wrap host class', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ShrinkWrapTestHost],
    }).createComponent(ShrinkWrapTestHost);
    await fixture.whenStable();

    const content = fixture.nativeElement.querySelector(
      'mlv-shrink-wrap',
    ) as HTMLElement;
    expect(content.classList).toContain('mlv-shrink-wrap');

    const span = content.querySelector('span');
    expect(span?.textContent?.trim()).toBe('Hello world');
  });
});
