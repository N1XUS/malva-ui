import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { MlvPage } from '../page/page';
import { MlvPageEndPane } from '../page-end-pane/page-end-pane';
import { MlvPageEndPaneContent } from '../page-end-pane/page-end-pane-content';
import { MlvPageShell } from './page-shell';
import {
  MlvPageEndSidebar,
  MlvPageSidebar,
  MlvPageTopbar,
} from './page-shell.slots';

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

  it('resolves a literal background and selects its contrast foreground', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.color.set('#fafafa');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;

    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-background'),
    ).toBe('rgb(250, 250, 250)');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('rgb(0, 0, 0)');
    expect(shell.getAttribute('style')).toContain('background');
    expect(shell.style.backgroundColor).toBe('rgb(250, 250, 250)');
    expect(shell.style.color).toBe('rgb(0, 0, 0)');
  });

  it('resolves a background supplied through a CSS custom property', async () => {
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

    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-background'),
    ).toBe('rgb(23, 23, 23)');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('rgb(255, 255, 255)');
  });

  it('recomputes contrast when a referenced custom property changes', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.brandColor.set('#171717');
    fixture.componentInstance.color.set('var(--brand-shell)');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    fixture.componentInstance.brandColor.set('#fafafa');
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-background'),
    ).toBe('rgb(250, 250, 250)');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('rgb(0, 0, 0)');
  });

  it('uses an explicit foreground instead of the automatic endpoint', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.color.set('#171717');
    fixture.componentInstance.foreground.set('#00ff00');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('rgb(0, 255, 0)');
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

    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-background'),
    ).toBe('');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('');
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-chrome-background'),
    ).toBe('#123456');
  });

  it('resolves a custom-property fallback value', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    fixture.componentInstance.color.set('var(--missing-shell-color, #fafafa)');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-background'),
    ).toBe('rgb(250, 250, 250)');
  });

  it('measures translucent colors over the nearest ancestor background', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageShellColorTestHost],
    }).createComponent(PageShellColorTestHost);
    (fixture.nativeElement as HTMLElement).style.backgroundColor = '#ffffff';
    fixture.componentInstance.color.set('rgba(0, 0, 0, 0.1)');
    fixture.detectChanges();
    await waitForAnimationFrame();
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    expect(
      shell.style.getPropertyValue('--mlv-page-shell-resolved-foreground'),
    ).toBe('rgb(0, 0, 0)');
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
});
