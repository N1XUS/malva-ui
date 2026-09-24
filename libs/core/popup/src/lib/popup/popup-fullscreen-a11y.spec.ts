import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  signal,
  viewChild,
  ViewContainerRef,
  type WritableSignal,
} from '@angular/core';
import { MlvBreakpointService, mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MLV_POPUP_I18N } from '@malva-ui/i18n';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvPopup } from './popup';
import type { MlvPopupMobileMode } from './popup';
import { MlvPopupContent } from '../popup-content';

/**
 * Reports a viewport tier the spec controls, so `mobileMode="auto"` is
 * deterministic. Most specs below force the sheet with
 * `mobileMode="fullscreen"`, which ignores the breakpoint; the per-open latch
 * spec flips {@link down} to cross `md` while the sheet is open.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

/**
 * The accessible name as a screen reader resolves it for this markup:
 * `aria-labelledby` first (each IDREF's text content, space-joined), then
 * `aria-label`. `null` when neither is present. Hand-rolled because no
 * accessible-name library is a workspace dependency (mirrors
 * `progress.spec.ts`); the axe sweeps add `aria-dialog-name`, which fails on
 * an unnamed dialog.
 */
function accessibleName(element: Element): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return element.getAttribute('aria-label');
}

/**
 * A full-screen sheet is a modal dialog (#322).
 *
 * In full-screen mode the panel traps focus behind a solid, always-on scrim
 * and carries a close button — a modal dialog in every respect but the one AT
 * reads. Its role, modality and name used to come only from `panelRole`,
 * `modal` and `ariaLabel`, which `mlv-select`, `mlv-combobox` and
 * `mlv-date-range-picker` never set, and the visible `mobileTitle` was
 * referenced by nothing. So a phone user landed in a trapped, role-less,
 * unnamed region.
 *
 * While `isFullscreen()` the panel now resolves `role="dialog"` (an explicit
 * `panelRole` still wins), `aria-modal="true"` (only on a dialog role, where
 * the attribute is allowed) and is named by its visible title through
 * `aria-labelledby`, with `ariaLabel` as the fallback when there is no title.
 * Exactly one naming attribute is emitted. The anchored panel is unchanged.
 */
describe('MlvPopup — full-screen sheet dialog semantics', () => {
  @Component({
    imports: [MlvPopup, MlvPopupContent],
    template: `
      <mlv-popup
        [mobileMode]="mode()"
        [mobileTitle]="title()"
        [ariaLabel]="ariaLabel()"
        [panelRole]="role()"
        [modal]="modal()"
      >
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class HostComponent {
    readonly mode = signal<MlvPopupMobileMode>('fullscreen');
    readonly title = signal<string | undefined>(undefined);
    readonly ariaLabel = signal<string | undefined>(undefined);
    readonly role = signal<string | null>(null);
    readonly modal = signal(false);
    readonly popup = viewChild.required(MlvPopup);
    readonly host = viewChild.required('host', { read: ViewContainerRef });

    stamp(): void {
      this.host().createEmbeddedView(this.popup().popupTemplate());
    }
  }

  function render(): {
    fixture: ComponentFixture<HostComponent>;
    host: HostComponent;
    panel: () => HTMLElement;
    title: () => HTMLElement | null;
  } {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    host.stamp();
    fixture.detectChanges();
    return {
      fixture,
      host,
      panel: () =>
        fixture.nativeElement.querySelector('.mlv-popup') as HTMLElement,
      title: () =>
        fixture.nativeElement.querySelector(
          '.mlv-popup__title',
        ) as HTMLElement | null,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
        { provide: MLV_POPUP_I18N, useValue: signal({ close: 'Close' }) },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('is a modal dialog named by its visible title', () => {
    const { fixture, host, panel, title } = render();
    host.title.set('Pick a fruit');
    fixture.detectChanges();

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    const titleId = title()?.id ?? '';
    expect(titleId).not.toBe('');
    expect(panel().getAttribute('aria-labelledby')).toBe(titleId);
    expect(accessibleName(panel())).toBe('Pick a fruit');
  });

  it('prefers the visible title over ariaLabel and emits one naming attribute', () => {
    // `ariaLabel` is mode-agnostic — the pickers write it for the anchored
    // popover, which has no visible heading — while `mobileTitle` is written
    // for the sheet and is on screen there. Naming the sheet by anything but
    // its visible heading would announce a name the user cannot see.
    const { fixture, host, panel } = render();
    host.title.set('Stay');
    host.ariaLabel.set('Select date range');
    fixture.detectChanges();

    expect(accessibleName(panel())).toBe('Stay');
    expect(panel().hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to ariaLabel when the sheet has no title', () => {
    const { fixture, host, panel } = render();
    host.ariaLabel.set('Filters');
    fixture.detectChanges();

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(panel())).toBe('Filters');
  });

  it('treats a whitespace-only title as no title', () => {
    const { fixture, host, panel } = render();
    host.title.set('   ');
    host.ariaLabel.set('Filters');
    fixture.detectChanges();

    expect(panel().hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(panel())).toBe('Filters');
  });

  it('keeps an explicit panelRole, adding aria-modal only to a dialog role', () => {
    const { fixture, host, panel } = render();
    host.title.set('Delete item?');
    host.role.set('alertdialog');
    fixture.detectChanges();
    expect(panel().getAttribute('role')).toBe('alertdialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');

    // `aria-modal` is supported on `dialog` / `alertdialog` only; on any other
    // role it is an `aria-allowed-attr` violation, so a consumer's explicit
    // non-dialog role gets none.
    host.role.set('region');
    fixture.detectChanges();
    expect(panel().getAttribute('role')).toBe('region');
    expect(panel().hasAttribute('aria-modal')).toBe(false);
    expect(accessibleName(panel())).toBe('Delete item?');
  });

  it('leaves the anchored panel exactly as it was', () => {
    const { fixture, host, panel, title } = render();
    host.mode.set('off');
    host.title.set('Pick a fruit');
    host.ariaLabel.set('Fruit');
    fixture.detectChanges();

    expect(title()).toBeNull();
    expect(panel().hasAttribute('role')).toBe(false);
    expect(panel().hasAttribute('aria-modal')).toBe(false);
    expect(panel().hasAttribute('aria-labelledby')).toBe(false);
    expect(panel().getAttribute('aria-label')).toBe('Fruit');
  });

  it('still emits aria-modal for an explicit anchored modal', () => {
    const { fixture, host, panel } = render();
    host.mode.set('off');
    host.role.set('dialog');
    host.modal.set(true);
    host.ariaLabel.set('Choose date');
    fixture.detectChanges();

    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().getAttribute('aria-label')).toBe('Choose date');
  });

  it('warns in dev when a sheet opens with neither a title nor ariaLabel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture, host } = render();

    host.popup().lockFullscreenForOpen();
    host.popup().releaseFullscreenLock();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('mobileTitle');

    warn.mockClear();
    host.title.set('Pick a fruit');
    fixture.detectChanges();
    host.popup().lockFullscreenForOpen();
    host.popup().releaseFullscreenLock();
    expect(warn).not.toHaveBeenCalled();

    host.title.set(undefined);
    host.ariaLabel.set('Filters');
    fixture.detectChanges();
    host.popup().lockFullscreenForOpen();
    host.popup().releaseFullscreenLock();
    expect(warn).not.toHaveBeenCalled();

    host.ariaLabel.set(undefined);
    host.mode.set('off');
    fixture.detectChanges();
    host.popup().lockFullscreenForOpen();
    expect(warn).not.toHaveBeenCalled();
  });

  // The semantics read `isFullscreen()`, which `lockFullscreenForOpen()`
  // latches for the whole open (#126 / #144): a phone rotated past `md` with
  // the sheet up keeps a modal, titled dialog rather than turning into an
  // anchored-looking, role-less panel still inside the full-screen pane.
  it('holds the dialog semantics for the whole open when the viewport crosses md', () => {
    const { fixture, host, panel, title } = render();
    const breakpoints = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    host.mode.set('auto');
    host.title.set('Pick a fruit');
    breakpoints.down.set(true);
    fixture.detectChanges();

    expect(host.popup().lockFullscreenForOpen()).toBe(true);
    fixture.detectChanges();
    const titleId = title()?.id ?? '';
    expect(titleId).not.toBe('');
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().getAttribute('aria-labelledby')).toBe(titleId);

    breakpoints.down.set(false);
    fixture.detectChanges();
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().getAttribute('aria-labelledby')).toBe(titleId);
    expect(title()?.id).toBe(titleId);

    host.popup().releaseFullscreenLock();
    fixture.detectChanges();
    expect(title()).toBeNull();
    expect(panel().hasAttribute('role')).toBe(false);
    expect(panel().hasAttribute('aria-modal')).toBe(false);
    expect(panel().hasAttribute('aria-labelledby')).toBe(false);
  });

  // `mlvNextId` is one counter across every prefix, so a title id allocated
  // per instance would shift every later id on the page for each popup —
  // most of them anchored-only menus and flyouts that never show a title.
  it('takes no number from the shared id counter until a titled sheet renders', () => {
    const counter = (): number => Number(mlvNextId('probe').split('-').pop());
    const { fixture, host, title } = render();
    host.mode.set('off');
    host.title.set('Pick a fruit');
    fixture.detectChanges();

    const before = counter();
    fixture.detectChanges();
    expect(counter() - before).toBe(1);

    host.mode.set('fullscreen');
    fixture.detectChanges();
    const allocated = counter();
    expect(allocated - before).toBe(3);
    const titleId = title()?.id ?? '';
    expect(titleId).toBe(`mlv-popup-title-${allocated - 1}`);

    // Allocated once: later renders and a second open reuse it.
    host.mode.set('off');
    fixture.detectChanges();
    host.mode.set('fullscreen');
    fixture.detectChanges();
    expect(title()?.id).toBe(titleId);
    expect(counter() - allocated).toBe(1);
  });

  it('has no axe violations as a sheet named by its title', async () => {
    const { fixture, host } = render();
    host.title.set('Pick a fruit');
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations as a sheet named by ariaLabel alone', async () => {
    const { fixture, host } = render();
    host.ariaLabel.set('Filters');
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations as an anchored, role-less panel', async () => {
    const { fixture, host } = render();
    host.mode.set('off');
    host.title.set('Pick a fruit');
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations as an anchored modal dialog', async () => {
    const { fixture, host } = render();
    host.mode.set('off');
    host.role.set('dialog');
    host.modal.set(true);
    host.ariaLabel.set('Choose date');
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
