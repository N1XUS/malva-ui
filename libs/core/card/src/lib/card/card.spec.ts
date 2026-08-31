import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { compile } from 'sass';
import type { MlvCardBodyLayout } from './card';
import { MlvCard } from './card';
import { MlvCardHeaderDef } from '../card-header-def';
import { MlvCardSubheaderDef } from '../card-subheader-def';
import { MlvCardActionsDef } from '../card-actions-def';
import { MlvCardFooterDef } from '../card-footer-def';

describe('MlvCard', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  @Component({
    imports: [
      MlvCard,
      MlvCardHeaderDef,
      MlvCardSubheaderDef,
      MlvCardActionsDef,
      MlvCardFooterDef,
    ],
    template: `
      <mlv-card
        [size]="size()"
        [elevated]="elevated()"
        [backgroundImage]="bgImage()"
        [bodyLayout]="bodyLayout()"
      >
        <ng-template mlvCardHeaderDef>
          <h3 class="mlv-card__heading">Title</h3>
        </ng-template>
        <ng-template mlvCardActionsDef>
          <button>Action</button>
        </ng-template>
        <ng-template mlvCardSubheaderDef>
          <p class="mlv-card__subheading">Subtitle</p>
        </ng-template>
        <p>Body content</p>
        <ng-template mlvCardFooterDef>
          <span class="mlv-card__footer-content">Footer action</span>
        </ng-template>
      </mlv-card>
    `,
  })
  class TestHostComponent {
    readonly size = signal<'s' | 'm' | 'l'>('m');
    readonly elevated = signal(false);
    readonly bgImage = signal<string | null>(null);
    readonly bodyLayout = signal<MlvCardBodyLayout>('none');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    const card = fixture.nativeElement.querySelector('.mlv-card');
    expect(card).toBeTruthy();
  });

  it('should have mlv-card base class', () => {
    const card = fixture.nativeElement.querySelector('.mlv-card');
    expect(card.classList).toContain('mlv-card');
  });

  it('should apply and update the size modifier', () => {
    const card = fixture.nativeElement.querySelector('.mlv-card');
    expect(card.classList).toContain('mlv-card--size-m');

    fixture.componentInstance.size.set('l');
    fixture.detectChanges();

    expect(card.classList).toContain('mlv-card--size-l');
    expect(card.classList).not.toContain('mlv-card--size-m');
  });

  it('should render header row when header is present', () => {
    const headerRow = fixture.nativeElement.querySelector(
      '.mlv-card__header-row',
    );
    expect(headerRow).toBeTruthy();
    expect(headerRow.querySelector('.mlv-card__heading')).toBeTruthy();
  });

  it('should render actions inside header row', () => {
    const headerRow = fixture.nativeElement.querySelector(
      '.mlv-card__header-row',
    );
    expect(headerRow).toBeTruthy();
    // actions template is rendered directly in the header row
    expect(headerRow.querySelector('button')).toBeTruthy();
  });

  it('should render subheading', () => {
    fixture.detectChanges();
    const sub = fixture.nativeElement.querySelector('.mlv-card__subheading');
    expect(sub).toBeTruthy();
  });

  it('should render body content', () => {
    const body = fixture.nativeElement.querySelector('.mlv-card__body');
    expect(body?.textContent).toContain('Body content');
  });

  it('should render footer content', () => {
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector(
      '.mlv-card__footer-content',
    );
    expect(footer).toBeTruthy();
  });

  it('should apply elevated class and shadow', async () => {
    fixture.componentInstance.elevated.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.nativeElement.querySelector('.mlv-card');
    expect(card.classList).toContain('mlv-card--elevated');
  });

  it('should apply background image class', async () => {
    fixture.componentInstance.bgImage.set('https://example.com/img.jpg');
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.nativeElement.querySelector('.mlv-card');
    expect(card.classList).toContain('mlv-card--has-bg-image');
  });

  it('should leave the body unstacked by default', () => {
    const body = fixture.nativeElement.querySelector('.mlv-card__body');
    expect(body.classList).not.toContain('mlv-card__body--stack');
  });

  it('should toggle the body stack modifier with bodyLayout', async () => {
    fixture.componentInstance.bodyLayout.set('stack');
    fixture.detectChanges();
    await fixture.whenStable();

    const body = fixture.nativeElement.querySelector('.mlv-card__body');
    expect(body.classList).toContain('mlv-card__body--stack');

    fixture.componentInstance.bodyLayout.set('none');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(body.classList).not.toContain('mlv-card__body--stack');
  });
});

describe('MlvCard body layout styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      // Joined rather than a literal so Vite's static `new URL('literal',
      // import.meta.url)` asset analysis does not rewrite this into a
      // dev-server URL.
      fileURLToPath(new URL(['.', 'card.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  /**
   * The declared value of `property` for `selector`. Sass emits `.mlv-card`
   * more than once (`mixins.base()` opens its own rule), so every matching
   * rule is scanned and the last declaration — the one that would win — is
   * returned. Absent everywhere yields `''`.
   */
  const declaredValue = (selector: string, property: string): string =>
    [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .filter(({ selectorText }) => selectorText === selector)
      .reduce(
        (winner, cssRule) => cssRule.style.getPropertyValue(property) || winner,
        '',
      );

  it('stacks the body only under the stack modifier', () => {
    expect(declaredValue('.mlv-card__body--stack', 'display')).toBe('flex');
    expect(declaredValue('.mlv-card__body--stack', 'flex-direction')).toBe(
      'column',
    );
    expect(declaredValue('.mlv-card__body--stack', 'gap')).toBe(
      'var(--mlv-card-body-gap)',
    );
    // The unmodified body keeps the exact declarations it had before the input
    // existed, so a plain card is unaffected.
    expect(declaredValue('.mlv-card__body', 'gap')).toBe('');
    expect(declaredValue('.mlv-card__body', 'display')).toBe('');
  });

  it('scales the body gap with the size preset', () => {
    expect(declaredValue('.mlv-card', '--mlv-card-body-gap')).toBe(
      'var(--mlv-spacing-3)',
    );
    expect(declaredValue('.mlv-card--size-s', '--mlv-card-body-gap')).toBe(
      'var(--mlv-spacing-2)',
    );
    expect(declaredValue('.mlv-card--size-m', '--mlv-card-body-gap')).toBe(
      'var(--mlv-spacing-3)',
    );
    expect(declaredValue('.mlv-card--size-l', '--mlv-card-body-gap')).toBe(
      'var(--mlv-spacing-4)',
    );
  });
});
