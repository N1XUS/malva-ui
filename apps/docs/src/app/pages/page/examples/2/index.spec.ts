import { By } from '@angular/platform-browser';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MlvColorPickerPopup } from '@malva-ui/core/color-picker';
import { MlvPageShell } from '@malva-ui/core/page';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvSidebar } from '@malva-ui/core/sidebar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import PageAppShellExampleComponent from './index';

/**
 * Stands in for the shared resize observer so container width is an input to the
 * test rather than something jsdom has to lay out.
 *
 * This substitutes the measurement source only — the width-to-presentation
 * mapping and the resulting DOM swap are the real component's.
 */
class FakeResizeObserverService {
  private readonly _entries = new Subject<ResizeObserverEntry[]>();

  observe(): Subject<ResizeObserverEntry[]> {
    return this._entries;
  }

  emitWidth(width: number): void {
    this._entries.next([
      { contentRect: { width } } as unknown as ResizeObserverEntry,
    ]);
  }
}

describe('PageAppShellExampleComponent', () => {
  const setup = () => {
    const resize = new FakeResizeObserverService();
    const errors: string[] = [];
    const fixture = TestBed.configureTestingModule({
      imports: [PageAppShellExampleComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvResizeObserverService, useValue: resize },
        {
          provide: ErrorHandler,
          useValue: {
            handleError(error: unknown): void {
              const errorLike = error as {
                message?: unknown;
                name?: unknown;
                stack?: unknown;
              };
              errors.push(
                `${String(errorLike.name ?? 'Error')}: ${String(
                  errorLike.message ?? error,
                )}\n${String(errorLike.stack ?? '')}`,
              );
            },
          },
        },
      ],
    }).createComponent(PageAppShellExampleComponent);
    fixture.detectChanges();

    // Node's inspector cannot format one cross-realm jsdom URL produced by the
    // existing full app-shell preview. Keep that runner quirk silent while
    // still surfacing every unrelated Angular runtime error.
    expect(
      errors.filter(
        (error) =>
          !error.startsWith(
            'TypeError: Receiver must be an instance of class URL',
          ),
      ),
    ).toEqual([]);

    const shell = fixture.debugElement.query(By.directive(MlvPageShell))
      .componentInstance as MlvPageShell;
    const pickerDebugElement = fixture.debugElement.query(
      By.directive(MlvColorPickerPopup),
    );
    if (!pickerDebugElement) {
      throw new Error('Expected color picker popup');
    }
    const picker = pickerDebugElement.componentInstance as MlvColorPickerPopup;
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const findButton = (label: string): HTMLButtonElement => {
      const button = buttons.find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      if (!button) {
        throw new Error(`Expected "${label}" button`);
      }
      return button;
    };

    return {
      fixture,
      component: fixture.componentInstance,
      shell,
      picker,
      resize,
      customButton: findButton('Custom CSS variable'),
      autoButton: findButton('Auto'),
    };
  };

  it('starts in custom CSS variable mode', () => {
    const { fixture, shell, customButton, autoButton } = setup();
    const shellElement = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;

    expect(shell.chrome.mlvChromeColor()).toBe('var(--mlv-demo-shell-color)');
    expect(shellElement.style.getPropertyValue('--mlv-demo-shell-color')).toBe(
      '#a83011',
    );
    expect(customButton.getAttribute('aria-pressed')).toBe('true');
    expect(autoButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('orders the rail, navigation, canvas, and inspector in the composed shell', () => {
    const { fixture } = setup();
    const body = fixture.nativeElement.querySelector(
      '.mlv-page-shell__body',
    ) as HTMLElement;

    expect(
      Array.from(body.children).map((node) => node.getAttribute('data-slot')),
    ).toEqual(['rail', 'navigation', null, 'inspector']);
    expect(body.children[2].classList).toContain('mlv-page-shell__content');
  });

  it('collapses and reopens navigation without affecting the inspector', () => {
    const { fixture } = setup();
    const navigation = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-slot="navigation"]');
    const inspector = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-slot="inspector"]');
    const navigationControl = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector(
        'button[aria-label="Collapse navigation"], button[aria-label="Open navigation"]',
      );

    navigationControl().click();
    fixture.detectChanges();

    expect(navigationControl().getAttribute('aria-label')).toBe(
      'Open navigation',
    );
    expect(navigationControl().getAttribute('aria-expanded')).toBe('false');
    expect(navigation().hasAttribute('inert')).toBe(true);
    expect(navigation().getAttribute('aria-hidden')).toBe('true');
    expect(inspector().hasAttribute('inert')).toBe(false);

    navigationControl().click();
    fixture.detectChanges();

    expect(navigationControl().getAttribute('aria-label')).toBe(
      'Collapse navigation',
    );
    expect(navigationControl().getAttribute('aria-expanded')).toBe('true');
    expect(navigation().hasAttribute('inert')).toBe(false);
    expect(navigation().getAttribute('aria-hidden')).toBeNull();
    expect(inspector().hasAttribute('inert')).toBe(false);
  });

  it('collapses and reopens the inspector without affecting navigation', () => {
    const { fixture } = setup();
    const navigation = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-slot="navigation"]');
    const inspector = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-slot="inspector"]');
    const inspectorControl = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector(
        'button[aria-label="Collapse inspector"], button[aria-label="Open inspector"]',
      );

    inspectorControl().click();
    fixture.detectChanges();

    expect(inspectorControl().getAttribute('aria-label')).toBe(
      'Open inspector',
    );
    expect(inspectorControl().getAttribute('aria-expanded')).toBe('false');
    expect(inspector().hasAttribute('inert')).toBe(true);
    expect(inspector().getAttribute('aria-hidden')).toBe('true');
    expect(navigation().hasAttribute('inert')).toBe(false);

    inspectorControl().click();
    fixture.detectChanges();

    expect(inspectorControl().getAttribute('aria-label')).toBe(
      'Collapse inspector',
    );
    expect(inspectorControl().getAttribute('aria-expanded')).toBe('true');
    expect(inspector().hasAttribute('inert')).toBe(false);
    expect(inspector().getAttribute('aria-hidden')).toBeNull();
    expect(navigation().hasAttribute('inert')).toBe(false);
  });

  it('restores theme color in Auto mode', () => {
    const { fixture, shell, autoButton } = setup();

    autoButton.click();
    fixture.detectChanges();

    const shellElement = fixture.nativeElement.querySelector(
      'mlv-page-shell',
    ) as HTMLElement;
    expect(shell.chrome.mlvChromeColor()).toBeNull();
    expect(shellElement.style.getPropertyValue('--mlv-demo-shell-color')).toBe(
      '',
    );
    expect(autoButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('restores the last selected custom color', () => {
    const { fixture, component, shell, picker, customButton, autoButton } =
      setup();

    picker.colorChange.emit('#2468ac');
    fixture.detectChanges();
    autoButton.click();
    fixture.detectChanges();
    customButton.click();
    fixture.detectChanges();

    expect(shell.chrome.mlvChromeColor()).toBe('var(--mlv-demo-shell-color)');
    expect(component.shellColor()).toBe('#2468ac');
  });

  it('collapses the topbar search to an icon on a narrow container, not a narrow viewport', () => {
    const { fixture, component, resize } = setup();
    const search = (): HTMLElement =>
      fixture.nativeElement.querySelector(
        '.app-shell-preview__search',
      ) as HTMLElement;

    resize.emitWidth(1200);
    fixture.detectChanges();
    expect(component.searchPresentation()).toBe('field');
    expect(search().querySelector('input')).not.toBeNull();
    expect(search().classList.contains('app-shell-preview__search--icon')).toBe(
      false,
    );

    // Same viewport, narrower preview — the shell is a box inside the docs page,
    // so only its own width may drive this.
    resize.emitWidth(600);
    fixture.detectChanges();
    expect(component.searchPresentation()).toBe('icon');
    expect(search().querySelector('input')).toBeNull();
    expect(
      search().querySelector('.mlv-search-field__trigger-icon'),
    ).not.toBeNull();
    expect(search().classList.contains('app-shell-preview__search--icon')).toBe(
      true,
    );

    resize.emitWidth(1200);
    fixture.detectChanges();
    expect(component.searchPresentation()).toBe('field');
    expect(search().querySelector('input')).not.toBeNull();
  });

  it('turns the sidebar into a drawer on a narrow container and exposes a topbar trigger', () => {
    const { fixture, component, resize } = setup();
    const menuButton = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector(
        'button[aria-label="Open navigation"]',
      );

    resize.emitWidth(1200);
    fixture.detectChanges();
    expect(component.sidebarMode()).toBe('icon');
    // The sidebar's own footer trigger is reachable inline, so the topbar does
    // not duplicate it.
    expect(menuButton()).toBeNull();

    resize.emitWidth(480);
    fixture.detectChanges();
    expect(component.sidebarMode()).toBe('offcanvas');

    // In drawer mode the sidebar's own trigger is inside the closed drawer, so
    // the topbar has to own the control or the navigation is unreachable.
    const button = menuButton();
    expect(button).not.toBeNull();
    expect(component.collapsed()).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog');

    button?.click();
    fixture.detectChanges();

    expect(component.collapsed()).toBe(false);
    expect(menuButton()?.getAttribute('aria-expanded')).toBe('true');
  });

  it("takes the drawer's own close back into the topbar toggle", () => {
    // `mlv-sidebar` writes `collapsed` itself whenever the offcanvas drawer
    // closes — Escape, a backdrop click, `closeOnActivation` — through
    // `_onDrawerOpenedChange`. A one-way `[collapsed]` binding drops that
    // write, and then the sidebar is shut while the example still believes it
    // is open: the topbar toggle reports `aria-expanded="true"`, is labelled
    // "Collapse inspector", and its next click writes the value the sidebar
    // already holds, so the drawer only reopens on the *second* press.
    const { fixture, component, resize } = setup();
    const inspector = (): MlvSidebar =>
      fixture.debugElement
        .queryAll(By.directive(MlvSidebar))
        .map((d) => d.componentInstance as MlvSidebar)
        .find((s) => s.ariaLabel() === 'Project inspector') as MlvSidebar;
    const toggle = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector(
        'button[aria-label="Open inspector"], button[aria-label="Collapse inspector"]',
      );

    // Narrow enough that the inspector is a drawer, then opened from the topbar.
    resize.emitWidth(480);
    fixture.detectChanges();
    expect(component.inspectorMode()).toBe('offcanvas');
    expect(component.inspectorCollapsed()).toBe(true);

    toggle().click();
    fixture.detectChanges();
    expect(component.inspectorCollapsed()).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');

    // The drawer closes itself. This is the write `_onDrawerOpenedChange` makes;
    // driving the real overlay would assert the same signal one layer down.
    inspector().collapsed.set(true);
    fixture.detectChanges();

    expect(component.inspectorCollapsed()).toBe(true);
    expect(toggle().getAttribute('aria-label')).toBe('Open inspector');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    // And one press reopens it, rather than spending the first press
    // re-writing a value the sidebar already holds.
    toggle().click();
    fixture.detectChanges();
    expect(component.inspectorCollapsed()).toBe(false);
  });

  it('activates custom mode when the popup emits a color', () => {
    const { fixture, component, picker, autoButton } = setup();

    autoButton.click();
    fixture.detectChanges();
    picker.colorChange.emit('#abcdef');
    fixture.detectChanges();

    expect(component.shellColorMode()).toBe('custom');
    expect(component.shellColor()).toBe('#abcdef');
  });
});
