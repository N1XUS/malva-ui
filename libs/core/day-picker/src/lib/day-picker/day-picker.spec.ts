import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MlvPopup } from '@malva-ui/core/popup';
import { MlvDayPicker } from './day-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

@Component({
  template: `<mlv-day-picker />`,
  imports: [MlvDayPicker],
})
class TestHostComponent {}

describe('MlvDayPicker', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-day-picker');
    expect(el).toBeTruthy();
  });

  it('opts the calendar popup into auto mobile fullscreen mode', () => {
    fixture.detectChanges();
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
  });
});

// ---------------------------------------------------------------------------
// Stylesheet — compiled once; assertions read declarations by selector.
// ---------------------------------------------------------------------------

// `sass` is a Node-only dependency; loading it through `createRequire` keeps
// it out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

/**
 * Declarations of every emitted rule whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule and emits
 * shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function cssRule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head
      .trim()
      .split(/,\s*/)
      .map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

describe('MlvDayPicker stylesheet', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(dirname(fileURLToPath(import.meta.url)), 'day-picker.scss'),
    ).css,
  );

  // A control with no value shows its `placeholder` as a rendered span where
  // an input shows it through `::placeholder`. Both are placeholder text and
  // read the same token — `--mlv-text-tertiary`, the placeholder/disabled step
  // of the text ramp that mlv-input, mlv-textarea and mlv-number-input use —
  // so a form that mixes the controls shows one placeholder grey, not two.
  it('paints the placeholder with the shared placeholder token', () => {
    expect(cssRule(css, '.mlv-day-picker__placeholder')).toContain(
      'color: var(--mlv-text-tertiary)',
    );
  });
});
