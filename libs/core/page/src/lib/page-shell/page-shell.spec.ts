import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { MlvPage } from '../page/page';
import { MlvPageEndPane } from '../page-end-pane/page-end-pane';
import { MlvPageEndPaneContent } from '../page-end-pane/page-end-pane-content';
import type { MlvPageShellSizing } from './page-shell';
import { MlvPageShell } from './page-shell';
import {
  MlvPageEndSidebar,
  MlvPageSidebar,
  MlvPageTopbar,
} from './page-shell.slots';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

@Component({
  template: `
    <mlv-page-shell>
      <header mlvPageTopbar>Global navigation</header>
      <nav mlvPageSidebar>Primary navigation</nav>
      <main mlvPage>Page content</main>
      <aside mlvPageEndSidebar>Tools</aside>
    </mlv-page-shell>
  `,
  imports: [
    MlvPageShell,
    MlvPage,
    MlvPageTopbar,
    MlvPageSidebar,
    MlvPageEndSidebar,
  ],
})
class PageShellTestHost {}

@Component({
  template: `
    <mlv-page-shell>
      <nav mlvPageSidebar data-slot="rail"></nav>
      <nav mlvPageSidebar data-slot="navigation"></nav>
      <main data-slot="content"></main>
      <aside mlvPageEndSidebar data-slot="inspector"></aside>
    </mlv-page-shell>
  `,
  imports: [MlvPageShell, MlvPageSidebar, MlvPageEndSidebar],
})
class MultiSidebarTestHost {}

@Component({
  template: `
    <mlv-page-shell>
      <main data-slot="content"></main>
      <mlv-page-end-pane ariaLabel="Details">
        <ng-template mlvPageEndPaneContent>Details</ng-template>
      </mlv-page-end-pane>
    </mlv-page-shell>
  `,
  imports: [MlvPageShell, MlvPageEndPane, MlvPageEndPaneContent],
})
class EndPaneShellTestHost {}

@Component({
  template: `
    <mlv-page-shell
      [color]="color()"
      [foreground]="foreground()"
      [style.--brand-shell]="brandColor()"
    >
      Shell content
    </mlv-page-shell>
  `,
  imports: [MlvPageShell],
})
class PageShellColorTestHost {
  readonly color = signal<string | null>(null);
  readonly foreground = signal<string | null>(null);
  readonly brandColor = signal<string | null>(null);
}

@Component({
  template: `
    <mlv-page-shell [sizing]="sizing()">
      <main mlvPage>Page content</main>
    </mlv-page-shell>
  `,
  imports: [MlvPageShell, MlvPage],
})
class PageShellSizingTestHost {
  readonly sizing = signal<MlvPageShellSizing>('parent');
}

/** Waits for the component's frame-coalesced color resolution. */
function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const SHELL_DIR = dirname(fileURLToPath(import.meta.url));

/** Reads one compiled CSS rule, preserving the stylesheet as the public contract. */
function declarationsFor(selector: string): string {
  const css = sass
    .compile(join(SHELL_DIR, 'page-shell.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');
  const index = css.indexOf(selector);

  return index === -1
    ? ''
    : css.slice(index + selector.length, css.indexOf('}', index));
}

describe('MlvPageShell', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  it('projects the responsive end pane after the page canvas', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [EndPaneShellTestHost],
    }).createComponent(EndPaneShellTestHost);
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector(
      '.mlv-page-shell__body',
    ) as HTMLElement;

    expect(body.lastElementChild?.tagName).toBe('MLV-PAGE-END-PANE');
  });

  it('projects two start sidebars before content and one inspector after it', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [MultiSidebarTestHost],
    }).createComponent(MultiSidebarTestHost);
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector(
      '.mlv-page-shell__body',
    ) as HTMLElement;

    expect(
      Array.from(body.children).map((node) => node.getAttribute('data-slot')),
    ).toEqual(['rail', 'navigation', null, 'inspector']);
    expect(body.children[2].classList).toContain('mlv-page-shell__content');
  });

  it('keeps adjacent start sidebars as compact tracks separated by a chrome-derived hairline', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [MultiSidebarTestHost],
    }).createComponent(MultiSidebarTestHost);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[mlvPageSidebar]'),
    ).toHaveLength(2);
    const track = declarationsFor('.mlv-page-shell__body>[mlvPageSidebar]{');
    const separator = declarationsFor(
      '.mlv-page-shell__body>[mlvPageSidebar]+[mlvPageSidebar]{',
    );

    expect(track).toContain('flex:00auto;');
    expect(track).toContain('min-width:0;');
    expect(separator).toContain(
      'border-inline-start:var(--mlv-stroke-width)solid' +
        'color-mix(insrgb,var(--mlv-page-shell-effective-foreground)16%,' +
        'var(--mlv-page-shell-effective-background));',
    );
  });

  it('orders shell chrome around the page canvas', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellTestHost],
    }).createComponent(PageShellTestHost);
    await fixture.whenStable();

    const shell = fixture.nativeElement.querySelector('mlv-page-shell');
    const body = shell.querySelector('.mlv-page-shell__body');
    const content = body.querySelector('.mlv-page-shell__content');

    expect(shell.firstElementChild?.tagName).toBe('HEADER');
    expect(body.firstElementChild?.textContent).toContain('Primary navigation');
    expect(content.querySelector('main')?.textContent).toContain(
      'Page content',
    );
    expect(body.lastElementChild?.textContent).toContain('Tools');
  });

  it('applies stable integration classes through slot directives', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellTestHost],
    }).createComponent(PageShellTestHost);
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('.mlv-page-shell__topbar'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-page-shell__sidebar'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-page-shell__sidebar--end'),
    ).toBeTruthy();
  });

  it('paints its chrome through MlvChromeColor and falls back without it', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.brandColor.set('#171717');
    fixture.componentInstance.color.set('var(--brand-shell)');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;

    // The shell contributes the token remap, not the colour maths: `color` and
    // `foreground` are the host directive's inputs under the names they always
    // had, and what lands on the element is the directive's own contract.
    // Resolution itself is covered in `cdk/utils` — see `chrome-color.spec.ts`.
    expect(shell.style.getPropertyValue('--mlv-chrome-background')).toBe(
      'rgb(23, 23, 23)',
    );
    expect(shell.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(255, 255, 255)',
    );
    expect(shell.style.backgroundColor).toBe('rgb(23, 23, 23)');
  });

  it('falls back without removing public custom-property overrides', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.detectChanges();
    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    shell.style.setProperty('--mlv-page-shell-chrome-background', '#123456');
    fixture.componentInstance.color.set('var(--missing-shell-color)');
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAnimationFrame();
    fixture.detectChanges();

    // Unresolvable means *absent*, so the stylesheet's own fallback chain —
    // and the consumer's override inside it — is what applies.
    expect(shell.style.getPropertyValue('--mlv-chrome-background')).toBe('');
    expect(shell.style.getPropertyValue('--mlv-chrome-foreground')).toBe('');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-chrome-background'),
    ).toBe('#123456');
  });

  it('reads the effective chrome tokens off the resolved pair', () => {
    // The remap is the shell's actual contribution once the colour maths has
    // moved out, so it is asserted on the compiled stylesheet rather than
    // inferred from a computed style. `mixins.base()` emits its own
    // `.mlv-page-shell` rule ahead of this one, so the whole sheet is read.
    const css = sass
      .compile(join(SHELL_DIR, 'page-shell.scss'), { style: 'expanded' })
      .css.replace(/\s+/g, '');

    expect(css).toContain(
      '--mlv-page-shell-effective-background:var(--mlv-chrome-background,var(--mlv-page-shell-chrome-background))',
    );
    expect(css).toContain(
      '--mlv-page-shell-effective-foreground:var(--mlv-chrome-foreground,var(--mlv-page-shell-chrome-foreground))',
    );
  });

  describe('sizing', () => {
    it('fills a definite parent by default', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [PageShellSizingTestHost],
      }).createComponent(PageShellSizingTestHost);
      await fixture.whenStable();

      const shell = fixture.nativeElement.querySelector(
        'mlv-page-shell',
      ) as HTMLElement;
      expect(shell.classList).toContain('mlv-page-shell--sizing-parent');
      // `100%` against an indefinite parent computes to `auto`, so the default
      // fixes the bounded case without changing the unbounded one.
      expect(declarationsFor('.mlv-page-shell--sizing-parent{')).toContain(
        'block-size:100%',
      );
    });

    it('subtracts its own distance from the top of the layout in viewport mode', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [PageShellSizingTestHost],
      }).createComponent(PageShellSizingTestHost);
      fixture.componentInstance.sizing.set('viewport');
      const shell = fixture.nativeElement.querySelector(
        'mlv-page-shell',
      ) as HTMLElement;
      // A fixed application bar above the shell, or the padding reserved for
      // one: 108px down the page, and scrolled by 40 to prove the measurement
      // is scroll-invariant.
      vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
        top: 68,
      } as DOMRect);
      vi.spyOn(window, 'scrollY', 'get').mockReturnValue(40);
      await fixture.whenStable();

      expect(shell.classList).toContain('mlv-page-shell--sizing-viewport');
      expect(
        shell.style.getPropertyValue(
          '--mlv-page-shell-viewport-inset-block-start',
        ),
      ).toBe('108px');
    });

    it('writes no inset outside viewport mode', async () => {
      const fixture = TestBed.configureTestingModule({
        imports: [PageShellSizingTestHost],
      }).createComponent(PageShellSizingTestHost);
      fixture.componentInstance.sizing.set('content');
      await fixture.whenStable();

      const shell = fixture.nativeElement.querySelector(
        'mlv-page-shell',
      ) as HTMLElement;
      expect(shell.classList).toContain('mlv-page-shell--sizing-content');
      expect(
        shell.style.getPropertyValue(
          '--mlv-page-shell-viewport-inset-block-start',
        ),
      ).toBe('');
    });

    it('hands its definite size to a route host, not only to a direct page', () => {
      // Angular inserts an activated route's component *beside* the outlet, on
      // its own host element, so matching only `> .mlv-page` breaks under a
      // router — the normal case for an application shell.
      expect(declarationsFor('.mlv-page-shell__content>*{')).toContain(
        'flex:1 1 auto'.replace(/\s+/g, ''),
      );
      expect(declarationsFor('.mlv-page-shell__content>*{')).toContain(
        'min-height:0',
      );
      expect(
        declarationsFor('.mlv-page-shell__content>router-outlet{'),
      ).toContain('display:none');
      expect(
        declarationsFor('.mlv-page-shell__content>.mlv-page-host{'),
      ).toContain('display:flex');
    });
  });

  describe('a rail scoped to its own theme', () => {
    /**
     * The chrome derivation reads `--mlv-page-shell-effective-*`, which is
     * declared on the shell host and so substituted in the *document's* theme
     * scope. A `[mlvTheme]` island on the rail is resolved long after and
     * cannot reach it, so a dark-scoped rail inside a light-chrome shell was
     * painted light-grey row fills on its own dark surface.
     */
    it('keeps the chrome colour derivation off it', () => {
      const derived = declarationsFor(
        '.mlv-page-shell__sidebar.mlv-sidebar:not([mlvTheme]){',
      );

      expect(derived).toContain('--mlv-sidebar-active-bg:color-mix(');
      expect(derived).toContain('--mlv-sidebar-hover-bg:color-mix(');
      expect(derived).toContain('--mlv-text-primary:var(');
      expect(
        declarationsFor('.mlv-page-shell__sidebar.mlv-sidebar{'),
      ).not.toContain('--mlv-sidebar-active-bg');
    });

    it('still gets the structural reset, which is not a colour', () => {
      const structural = declarationsFor(
        '.mlv-page-shell__sidebar.mlv-sidebar{',
      );

      expect(structural).toContain('--mlv-sidebar-border-width:0rem');
      expect(structural).toContain('height:100%');
      expect(structural).toContain('background:transparent');
    });
  });

  it('cleans up observation and scheduled work on destroy', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame');
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.color.set('#fafafa');
    fixture.detectChanges();

    fixture.destroy();

    expect(disconnect).toHaveBeenCalled();
    expect(cancelFrame).toHaveBeenCalled();
  });

  it('has no axe violations across the whole composed shell', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellTestHost],
    }).createComponent(PageShellTestHost);
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
