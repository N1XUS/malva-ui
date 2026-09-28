import { fileURLToPath } from 'node:url';
// `ɵNG_*_DEF`: Angular has no public directive reflection; `reflectComponentType` covers components only.
import { Component, signal, ɵNG_COMP_DEF, ɵNG_DIR_DEF } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { compile } from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvCardBodyLayout } from './card';
import { MlvCard } from './card';
import { MlvCardHeader, MlvCardHeaderDef } from '../card-header-def';
import { MlvCardSubheader, MlvCardSubheaderDef } from '../card-subheader-def';
import { MlvCardActions, MlvCardActionsDef } from '../card-actions-def';
import { MlvCardFooter, MlvCardFooterDef } from '../card-footer-def';
import * as cardApi from '../../index';

// Joined rather than a literal so Vite's static `new URL('literal',
// import.meta.url)` asset analysis does not rewrite this into a dev-server URL.
const CARD_SCSS = fileURLToPath(
  new URL(['.', 'card.scss'].join('/'), import.meta.url),
);

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
    style.textContent = compile(CARD_SCSS).css;
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

/**
 * The card's BEM surface is written twice — once in the host bindings of the
 * component and its slot directives, once in `card.scss` — and nothing ties the
 * two together. `[mlvCardFooter] withBorder` emitted `mlv-card__footer--border`
 * while the stylesheet styled `mlv-card__footer--with-border`, so no footer ever
 * drew its divider (#369). Both directions are asserted: an emitted class with no
 * rule is a dead input, a styled class nothing emits is a dead rule.
 */
describe('MlvCard emitted classes vs stylesheet', () => {
  /**
   * Everything `EveryClassHost` renders. Pinned against the card barrel below,
   * so a new component or directive cannot stay outside the audit.
   */
  const EVERY_CLASS_HOST_IMPORTS: readonly unknown[] = [
    MlvCard,
    MlvCardHeaderDef,
    MlvCardHeader,
    MlvCardSubheaderDef,
    MlvCardSubheader,
    MlvCardActionsDef,
    MlvCardActions,
    MlvCardFooterDef,
    MlvCardFooter,
  ];

  @Component({
    imports: [...EVERY_CLASS_HOST_IMPORTS],
    template: `
      @for (size of sizes; track size) {
        <mlv-card
          [size]="size"
          elevated
          bodyLayout="stack"
          backgroundImage="https://example.com/cover.jpg"
        >
          <h3 *mlvCardHeaderDef mlvCardHeader>Title</h3>
          <div *mlvCardActionsDef mlvCardActions>
            <button type="button">Edit</button>
          </div>
          <p *mlvCardSubheaderDef mlvCardSubheader>Subtitle</p>
          <p>Body content</p>
          <div *mlvCardFooterDef mlvCardFooter withBorder fullWidth>
            <button type="button">Continue</button>
          </div>
        </mlv-card>
      }
    `,
  })
  class EveryClassHost {
    readonly sizes = ['s', 'm', 'l'] as const;
  }

  /** Every `mlv-card…` class a compiled selector names. */
  const styledClasses = (): string[] => {
    const css = stripCssLayersFromText(compile(CARD_SCSS).css);
    return [
      ...new Set(
        [...css.matchAll(/\.(mlv-card[\w-]*)/g)].map(([, name]) => name),
      ),
    ].sort();
  };

  /** Renders `EveryClassHost` and waits for it to settle. */
  const renderHost = async (): Promise<ComponentFixture<EveryClassHost>> => {
    await TestBed.configureTestingModule({
      imports: [EveryClassHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(EveryClassHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  /** Every `mlv-card…` class on the rendered DOM, with every input switched on. */
  const emittedClasses = async (): Promise<string[]> => {
    const fixture = await renderHost();
    const host = fixture.nativeElement as HTMLElement;
    return [
      ...new Set(
        [...host.querySelectorAll('[class]')].flatMap((element) =>
          [...element.classList].filter((name) => name.startsWith('mlv-card')),
        ),
      ),
    ].sort();
  };

  it('styles every class the card and its slot directives emit', async () => {
    const styled = new Set(styledClasses());
    const unstyled = (await emittedClasses()).filter(
      (name) => !styled.has(name),
    );
    expect(unstyled).toEqual([]);
  });

  it('emits every class the stylesheet styles', async () => {
    const emitted = new Set(await emittedClasses());
    const unemitted = styledClasses().filter((name) => !emitted.has(name));
    expect(unemitted).toEqual([]);
  });

  /**
   * The inputs `EveryClassHost` switches on, per class the card barrel exports.
   * The two assertions above only see a class some input actually emits in that
   * host, so an input added to a directive but not to the host would pass them
   * with no rule behind its class. Adding an input fails here until the host
   * switches it on and this list names it. Union members are still listed by
   * hand (`sizes`, `bodyLayout="stack"`); a styled value nothing emits fails
   * the reverse assertion above.
   */
  const COVERED_INPUTS: Record<string, readonly string[]> = {
    MlvCard: ['backgroundImage', 'bodyLayout', 'elevated', 'size'],
    MlvCardFooter: ['fullWidth', 'withBorder'],
  };

  type Definition = { inputs?: Record<string, unknown> } | undefined;

  /** Every card barrel export carrying a component or directive definition. */
  const barrelDeclarables = (): {
    name: string;
    type: unknown;
    definition: NonNullable<Definition>;
  }[] =>
    Object.entries(cardApi).flatMap(([name, value]) => {
      if (typeof value !== 'function') return [];
      const type = value as unknown as Record<string, Definition>;
      const definition = type[ɵNG_COMP_DEF] ?? type[ɵNG_DIR_DEF];
      return definition ? [{ name, type: value, definition }] : [];
    });

  it('renders every component and directive the card barrel declares', async () => {
    const declarables = barrelDeclarables();

    // An input-less host-class directive (a future `mlvCardMedia` emitting
    // `mlv-card__media`) is invisible to the input pin below, and to the two
    // class audits above unless the host renders it.
    const notImported = declarables
      .filter(({ type }) => !EVERY_CLASS_HOST_IMPORTS.includes(type))
      .map(({ name }) => name);
    expect(notImported).toEqual([]);
    // With the check above, the host imports exactly the barrel's declarables —
    // and a broken definition lookup (nothing found) cannot pass vacuously.
    expect(declarables).toHaveLength(EVERY_CLASS_HOST_IMPORTS.length);

    const fixture = await renderHost();
    const notRendered = declarables
      .filter(
        ({ type }) =>
          fixture.debugElement.queryAllNodes(
            By.directive(type as Parameters<typeof By.directive>[0]),
          ).length === 0,
      )
      .map(({ name }) => name);
    expect(notRendered).toEqual([]);
  });

  it('switches on every input the card barrel declares', () => {
    const declared = Object.fromEntries(
      barrelDeclarables().flatMap(({ name, definition }) => {
        const inputs = Object.keys(definition.inputs ?? {}).sort();
        return inputs.length > 0 ? [[name, inputs]] : [];
      }),
    );
    expect(declared).toEqual(COVERED_INPUTS);
  });
});

describe('MlvCardFooter modifiers', () => {
  @Component({
    imports: [MlvCard, MlvCardFooterDef, MlvCardFooter],
    template: `
      <mlv-card>
        <p>Body content</p>
        <div
          *mlvCardFooterDef
          mlvCardFooter
          [withBorder]="withBorder()"
          [fullWidth]="fullWidth()"
        >
          <button type="button">Continue</button>
        </div>
      </mlv-card>
    `,
  })
  class FooterHost {
    readonly withBorder = signal(false);
    readonly fullWidth = signal(false);
  }

  let style: HTMLStyleElement;
  let fixture: ComponentFixture<FooterHost>;
  let footer: HTMLElement;

  beforeEach(async () => {
    // The setup file flattens `@layer`, so jsdom keeps the whole sheet.
    style = document.createElement('style');
    style.textContent = compile(CARD_SCSS).css;
    document.head.appendChild(style);

    await TestBed.configureTestingModule({
      imports: [FooterHost],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterHost);
    fixture.detectChanges();
    await fixture.whenStable();
    footer = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-card__footer',
    ) as HTMLElement;
  });

  afterEach(() => style.remove());

  /** Rerenders after a signal write. */
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('draws a logical block-start divider only while withBorder is set', async () => {
    expect(footer.classList.contains('mlv-card__footer--border')).toBe(false);
    expect(
      getComputedStyle(footer).getPropertyValue('border-block-start'),
    ).toBe('');

    fixture.componentInstance.withBorder.set(true);
    await settle();

    // `mlv-card__footer--border` is the class the directive has always emitted,
    // so it is the public BEM name the stylesheet has to follow.
    expect(footer.classList.contains('mlv-card__footer--border')).toBe(true);
    // jsdom resolves no `var()`, so the declared value is what it reports.
    expect(
      getComputedStyle(footer).getPropertyValue('border-block-start'),
    ).toBe('var(--mlv-stroke-width) solid var(--mlv-border-normal)');

    fixture.componentInstance.withBorder.set(false);
    await settle();

    expect(footer.classList.contains('mlv-card__footer--border')).toBe(false);
    expect(
      getComputedStyle(footer).getPropertyValue('border-block-start'),
    ).toBe('');
  });

  it('shares the footer width between its children only while fullWidth is set', async () => {
    const child = footer.querySelector('button') as HTMLElement;
    expect(footer.classList.contains('mlv-card__footer--full-width')).toBe(
      false,
    );
    expect(getComputedStyle(child).getPropertyValue('flex')).toBe('');

    fixture.componentInstance.fullWidth.set(true);
    await settle();

    expect(footer.classList.contains('mlv-card__footer--full-width')).toBe(
      true,
    );
    expect(getComputedStyle(child).getPropertyValue('flex')).toBe('1');
  });
});

/**
 * Accessibility sweep.
 *
 * `mlv-card` adds no role and no ARIA — it is four template outlets and a body
 * slot. What the sweep is actually checking is that the chrome the docs page
 * puts in those slots survives being stamped into the header row: a heading in
 * `mlvCardHeaderDef` next to icon-only action buttons in `mlvCardActionsDef`
 * (`apps/docs/src/app/pages/card/examples/3`, where every action is a glyph
 * with an `aria-label`), a subheader, a footer, and the `backgroundImage`
 * variant (`…/4`) whose image is a decorative CSS custom property with no
 * element of its own to name.
 */
describe('MlvCard accessibility', () => {
  @Component({
    imports: [
      MlvCard,
      MlvCardHeaderDef,
      MlvCardSubheaderDef,
      MlvCardActionsDef,
      MlvCardFooterDef,
    ],
    template: `
      @for (size of sizes; track size) {
        <mlv-card [size]="size" [elevated]="size === 'l'">
          <ng-template mlvCardHeaderDef>
            <h3>{{ size }} card</h3>
          </ng-template>
          <ng-template mlvCardSubheaderDef>
            <p>Subtitle</p>
          </ng-template>
          <ng-template mlvCardActionsDef>
            <button type="button" aria-label="Edit">
              <svg aria-hidden="true"></svg>
            </button>
            <button type="button" aria-label="Delete">
              <svg aria-hidden="true"></svg>
            </button>
          </ng-template>
          <p>Body content</p>
          <ng-template mlvCardFooterDef>
            <a href="/details">Details</a>
          </ng-template>
        </mlv-card>
      }

      <mlv-card
        elevated
        bodyLayout="stack"
        backgroundImage="https://example.com/cover.jpg"
      >
        <ng-template mlvCardHeaderDef>
          <h3>Cover</h3>
        </ng-template>
        <p>Stacked body over a decorative background.</p>
      </mlv-card>
    `,
  })
  class CardA11yHost {
    readonly sizes = ['s', 'm', 'l'] as const;
  }

  it('has no axe violations across sizes, slots and the image variant', async () => {
    await TestBed.configureTestingModule({
      imports: [CardA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(CardA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: four cards, three with the full slot set. The header row really
    // did render (it is `@if`-gated on the two content children), and every
    // icon-only action carries a name.
    expect(host.querySelectorAll('mlv-card')).toHaveLength(4);
    expect(host.querySelectorAll('.mlv-card__header-row')).toHaveLength(4);
    expect(host.querySelectorAll('button')).toHaveLength(6);
    expect(host.querySelectorAll('.mlv-card__body--stack')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });
});
