import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  signal,
  viewChild,
  ViewContainerRef,
  type WritableSignal,
} from '@angular/core';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MLV_DENSITY_CONTEXT, MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { MLV_POPUP_I18N } from '@malva-ui/i18n';
import { MlvPopup } from './popup';
import type { MlvPopupMobileMode } from './popup';
import { MlvPopupContent } from '../popup-content';
import { MlvPopupHeaderActions } from '../popup-header-actions';
import { MlvPopupHeaderContent } from '../popup-header-content';
import { MlvPopupPinnedContent } from '../popup-pinned-content';

/**
 * A bubbling `animationend`, the way a finished CSS animation dispatches one.
 *
 * A plain `Event`, not an `AnimationEvent`: jsdom implements neither the
 * interface nor CSS animations, so nothing here would ever synthesise one. The
 * handler under test reads only `target` / `currentTarget`, and those are
 * dispatch mechanics `Event` models exactly.
 */
function animationEnd(): Event {
  return new Event('animationend', { bubbles: true });
}

describe('MlvPopup', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({
      imports: [MlvPopup],
    }).compileComponents();

    const fixture: ComponentFixture<MlvPopup> =
      TestBed.createComponent(MlvPopup);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('defaults to a non-modal, roleless panel', () => {
    const fixture = TestBed.createComponent(MlvPopup);
    fixture.detectChanges();
    const popup = fixture.componentInstance;
    expect(popup.panelRole()).toBeNull();
    expect(popup.modal()).toBe(false);
  });

  describe('rendered panel semantics', () => {
    @Component({
      imports: [MlvPopup, MlvPopupContent],
      template: `
        <mlv-popup
          [panelRole]="role()"
          [modal]="modal()"
          [ariaLabel]="ariaLabel()"
        >
          <ng-template mlvPopupContent><button>content</button></ng-template>
        </mlv-popup>
        <ng-container #host />
      `,
    })
    class HostComponent {
      readonly role = signal<string | null>(null);
      readonly modal = signal(false);
      readonly ariaLabel = signal<string | undefined>(undefined);
      readonly popup = viewChild.required(MlvPopup);
      readonly host = viewChild.required('host', { read: ViewContainerRef });

      stamp(): void {
        this.host().createEmbeddedView(this.popup().popupTemplate());
      }
    }

    function render(): {
      fixture: ComponentFixture<HostComponent>;
      panel: () => HTMLElement;
    } {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      fixture.componentInstance.stamp();
      fixture.detectChanges();
      return {
        fixture,
        panel: () =>
          fixture.nativeElement.querySelector('.mlv-popup') as HTMLElement,
      };
    }

    it('emits no role and no aria-modal by default (listbox/menu/tooltip case)', () => {
      const { panel } = render();
      expect(panel().getAttribute('role')).toBeNull();
      expect(panel().getAttribute('aria-modal')).toBeNull();
    });

    it('emits role="dialog" and aria-modal="true" when configured as a modal', () => {
      const { fixture, panel } = render();
      fixture.componentInstance.role.set('dialog');
      fixture.componentInstance.modal.set(true);
      fixture.componentInstance.ariaLabel.set('Choose date');
      fixture.detectChanges();

      expect(panel().getAttribute('role')).toBe('dialog');
      expect(panel().getAttribute('aria-modal')).toBe('true');
      expect(panel().getAttribute('aria-label')).toBe('Choose date');
    });

    it('uses the Malva scrollbar for popup content', () => {
      const { panel } = render();
      expect(
        panel().querySelector('.mlv-popup__scrollbar.mlv-scrollbar'),
      ).toBeTruthy();
    });
  });

  describe('density cascade class', () => {
    @Component({
      imports: [MlvPopup, MlvPopupContent],
      template: `
        <mlv-popup [mlvDensity]="density()" [class]="extraClass()">
          <ng-template mlvPopupContent><span>content</span></ng-template>
        </mlv-popup>
        <ng-container #host />
      `,
    })
    class DensityHostComponent {
      readonly density = signal<MlvDensity | undefined>(undefined);
      readonly extraClass = signal<string | undefined>(undefined);
      readonly popup = viewChild.required(MlvPopup);
      readonly host = viewChild.required('host', { read: ViewContainerRef });

      stamp(): void {
        this.host().createEmbeddedView(this.popup().popupTemplate());
      }
    }

    @Component({
      imports: [MlvPopup, MlvPopupContent],
      providers: [
        {
          provide: MLV_DENSITY_CONTEXT,
          useValue: signal<MlvDensity>('compact'),
        },
      ],
      template: `
        <mlv-popup [mlvDensity]="density()">
          <ng-template mlvPopupContent><span>content</span></ng-template>
        </mlv-popup>
        <ng-container #host />
      `,
    })
    class DensityContextHostComponent {
      readonly density = signal<MlvDensity | undefined>(undefined);
      readonly popup = viewChild.required(MlvPopup);
      readonly host = viewChild.required('host', { read: ViewContainerRef });

      stamp(): void {
        this.host().createEmbeddedView(this.popup().popupTemplate());
      }
    }

    function render(): {
      fixture: ComponentFixture<DensityHostComponent>;
      panel: () => HTMLElement;
    } {
      const fixture = TestBed.createComponent(DensityHostComponent);
      fixture.detectChanges();
      fixture.componentInstance.stamp();
      fixture.detectChanges();
      return {
        fixture,
        panel: () =>
          fixture.nativeElement.querySelector('.mlv-popup') as HTMLElement,
      };
    }

    it('stamps the global service density on the panel by default', () => {
      const { panel } = render();
      expect(panel().classList.contains('mlv--comfortable')).toBe(true);
    });

    it('prefers an explicit mlvDensity input over the service density', () => {
      const { fixture, panel } = render();
      fixture.componentInstance.density.set('compact');
      fixture.detectChanges();
      expect(panel().classList.contains('mlv--compact')).toBe(true);
      expect(panel().classList.contains('mlv--comfortable')).toBe(false);
    });

    it('tracks service density changes while no explicit input is set', () => {
      const { fixture, panel } = render();
      TestBed.inject(MlvDensityService).setDensity('tight');
      fixture.detectChanges();
      expect(panel().classList.contains('mlv--tight')).toBe(true);
      expect(panel().classList.contains('mlv--comfortable')).toBe(false);
    });

    it('keeps consumer classes from the class input alongside the density class', () => {
      const { fixture, panel } = render();
      fixture.componentInstance.extraClass.set('my-popup');
      fixture.componentInstance.density.set('spacious');
      fixture.detectChanges();
      expect(panel().classList.contains('my-popup')).toBe(true);
      expect(panel().classList.contains('mlv--spacious')).toBe(true);
    });

    it('prefers an ancestor MLV_DENSITY_CONTEXT over the service density', () => {
      const fixture = TestBed.createComponent(DensityContextHostComponent);
      fixture.detectChanges();
      fixture.componentInstance.stamp();
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector(
        '.mlv-popup',
      ) as HTMLElement;
      expect(panel.classList.contains('mlv--compact')).toBe(true);
      expect(panel.classList.contains('mlv--comfortable')).toBe(false);
    });

    it('an explicit mlvDensity input still beats the ancestor context', () => {
      const fixture = TestBed.createComponent(DensityContextHostComponent);
      fixture.componentInstance.density.set('tight');
      fixture.detectChanges();
      fixture.componentInstance.stamp();
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector(
        '.mlv-popup',
      ) as HTMLElement;
      expect(panel.classList.contains('mlv--tight')).toBe(true);
    });
  });

  describe('leave-animation fallback', () => {
    it('emits leaveAnimationDone$ via the fallback timer when animationend never fires', async () => {
      const fixture = TestBed.createComponent(MlvPopup);
      fixture.detectChanges();
      const popup = fixture.componentInstance;

      let done = false;
      popup.leaveAnimationDone$.subscribe(() => (done = true));

      popup.animationState.set('leave');
      fixture.detectChanges(); // flush the effect that arms the timer

      // No animationend dispatched (reduced motion / throttled hidden tab).
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(done).toBe(true);
    });

    it('disarms the fallback timer when the leave completes normally', async () => {
      const fixture = TestBed.createComponent(MlvPopup);
      fixture.detectChanges();
      const popup = fixture.componentInstance;

      let emissions = 0;
      popup.leaveAnimationDone$.subscribe(() => emissions++);

      popup.animationState.set('leave');
      fixture.detectChanges();

      // Real animationend path: handler emits, dispose resets the state.
      popup.onAnimationEnd();
      popup.animationState.set('idle');
      fixture.detectChanges();

      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(emissions).toBe(1);
    });
  });

  describe('animationend target', () => {
    @Component({
      imports: [MlvPopup, MlvPopupContent],
      template: `
        <mlv-popup>
          <ng-template mlvPopupContent><button>content</button></ng-template>
        </mlv-popup>
        <ng-container #host />
      `,
    })
    class PanelHostComponent {
      readonly popup = viewChild.required(MlvPopup);
      readonly host = viewChild.required('host', { read: ViewContainerRef });

      stamp(): void {
        this.host().createEmbeddedView(this.popup().popupTemplate());
      }
    }

    function renderPanel(): {
      fixture: ComponentFixture<PanelHostComponent>;
      popup: MlvPopup;
      panel: HTMLElement;
    } {
      const fixture = TestBed.createComponent(PanelHostComponent);
      fixture.detectChanges();
      fixture.componentInstance.stamp();
      fixture.detectChanges();
      return {
        fixture,
        popup: fixture.componentInstance.popup(),
        panel: fixture.nativeElement.querySelector('.mlv-popup') as HTMLElement,
      };
    }

    it('does not complete the leave for an animationend raised by a descendant', () => {
      const { fixture, popup, panel } = renderPanel();

      let emissions = 0;
      popup.leaveAnimationDone$.subscribe(() => emissions++);

      popup.animationState.set('leave');
      fixture.detectChanges();

      const child = panel.querySelector(
        '.mlv-popup__inner button',
      ) as HTMLElement | null;
      expect(child).not.toBeNull();
      child?.dispatchEvent(animationEnd());

      expect(emissions).toBe(0);
    });

    it('completes the leave for an animationend raised by the panel itself', () => {
      const { fixture, popup, panel } = renderPanel();

      let emissions = 0;
      popup.leaveAnimationDone$.subscribe(() => emissions++);

      popup.animationState.set('leave');
      fixture.detectChanges();

      panel.dispatchEvent(animationEnd());

      expect(emissions).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Mobile fullscreen mode
// ---------------------------------------------------------------------------

/** Stubs MlvBreakpointService so specs can flip the "below breakpoint" state. */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint) {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint) {
    return signal(false);
  }
}

describe('MlvPopup — mobile fullscreen mode', () => {
  @Component({
    imports: [MlvPopup, MlvPopupContent],
    template: `
      <mlv-popup
        [mobileMode]="mode()"
        [mobileBreakpoint]="breakpoint()"
        [mobileTitle]="title()"
        [mobileCloseLabel]="closeLabel()"
      >
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class HostComponent {
    readonly mode = signal<MlvPopupMobileMode>('off');
    readonly breakpoint = signal<MlvBreakpoint>('md');
    readonly title = signal<string | undefined>(undefined);
    readonly closeLabel = signal<string | undefined>(undefined);
    readonly popup = viewChild.required(MlvPopup);
    readonly host = viewChild.required('host', { read: ViewContainerRef });

    stamp(): void {
      this.host().createEmbeddedView(this.popup().popupTemplate());
    }
  }

  let fakeBreakpoint: FakeBreakpointService;

  function render(): {
    fixture: ComponentFixture<HostComponent>;
    host: HostComponent;
    panel: () => HTMLElement;
    closeBtn: () => HTMLButtonElement | null;
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
      // The accessible name lives on the native button inside
      // <mlv-button-close>, not on that component's host element.
      closeBtn: () =>
        fixture.nativeElement.querySelector(
          '.mlv-popup__close button',
        ) as HTMLButtonElement | null,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
        { provide: MLV_POPUP_I18N, useValue: signal({ close: 'Close' }) },
      ],
    });
    fakeBreakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
  });

  it('is not fullscreen when mobileMode is "off" regardless of viewport', () => {
    const { host } = render();
    fakeBreakpoint.down.set(true);
    expect(host.popup().isFullscreen()).toBe(false);
  });

  it('is always fullscreen when mobileMode is "fullscreen"', () => {
    const { fixture, host } = render();
    host.mode.set('fullscreen');
    fixture.detectChanges();
    fakeBreakpoint.down.set(false);
    expect(host.popup().isFullscreen()).toBe(true);
  });

  it('switches fullscreen with the breakpoint when mobileMode is "auto"', () => {
    const { fixture, host } = render();
    host.mode.set('auto');
    fixture.detectChanges();
    fakeBreakpoint.down.set(false);
    expect(host.popup().isFullscreen()).toBe(false);
    fakeBreakpoint.down.set(true);
    expect(host.popup().isFullscreen()).toBe(true);
  });

  it('renders the fullscreen header with a close button when fullscreen', () => {
    const { fixture, host, panel, closeBtn } = render();
    expect(closeBtn()).toBeNull();
    expect(panel().classList.contains('mlv-popup--fullscreen')).toBe(false);

    host.mode.set('fullscreen');
    fixture.detectChanges();

    expect(panel().classList.contains('mlv-popup--fullscreen')).toBe(true);
    expect(panel().querySelector('.mlv-popup__header')).not.toBeNull();
    expect(closeBtn()).not.toBeNull();
    expect(closeBtn()?.getAttribute('aria-label')).toBe('Close');
  });

  it('withholds the floating shadow while the sheet fills the viewport', () => {
    // `--shadow` is the anchored popover's chrome; a surface that fills the
    // viewport has nothing to float above. The template already gates the class
    // on `!isFullscreen()` — this pins that gate, because the modifier sets both
    // a `filter: drop-shadow()` and a `box-shadow` and the `--fullscreen` block
    // resets neither, so the gate is the only thing standing between the sheet
    // and a floating-panel shadow.
    const { fixture, host, panel } = render();
    expect(panel().classList.contains('mlv-popup--shadow')).toBe(true);

    host.mode.set('fullscreen');
    fixture.detectChanges();

    expect(panel().classList.contains('mlv-popup--fullscreen')).toBe(true);
    expect(panel().classList.contains('mlv-popup--shadow')).toBe(false);
  });

  it('renders the mobileTitle in the fullscreen header', () => {
    const { fixture, host, panel } = render();
    host.mode.set('fullscreen');
    host.title.set('Pick a date');
    fixture.detectChanges();
    expect(panel().querySelector('.mlv-popup__title')?.textContent).toContain(
      'Pick a date',
    );
  });

  it('uses mobileCloseLabel override over the i18n default', () => {
    const { fixture, host, closeBtn } = render();
    host.mode.set('fullscreen');
    host.closeLabel.set('Dismiss');
    fixture.detectChanges();
    expect(closeBtn()?.getAttribute('aria-label')).toBe('Dismiss');
  });

  it('closes the popup (opened → false) when the close button is clicked', () => {
    const { fixture, host, closeBtn } = render();
    host.mode.set('fullscreen');
    host.popup().opened.set(true);
    fixture.detectChanges();

    closeBtn()?.click();
    fixture.detectChanges();

    expect(host.popup().opened()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Header-content slot ([mlvPopupHeaderContent])
// ---------------------------------------------------------------------------

describe('MlvPopup — header content slot', () => {
  @Component({
    imports: [MlvPopup, MlvPopupContent, MlvPopupHeaderContent],
    template: `
      <mlv-popup [mobileMode]="mode()">
        <ng-template mlvPopupHeaderContent>
          <input class="in-sheet-field" />
        </ng-template>
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class HostComponent {
    readonly mode = signal<MlvPopupMobileMode>('off');
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
    };
  }

  it('does not stamp the header content while trigger-anchored (mode "off")', () => {
    const { panel } = render();
    expect(panel().querySelector('.mlv-popup__header-content')).toBeNull();
    expect(panel().querySelector('.in-sheet-field')).toBeNull();
  });

  it('renders the header content beneath the title row when fullscreen', () => {
    const { fixture, host, panel } = render();
    host.mode.set('fullscreen');
    fixture.detectChanges();

    const headerContent = panel().querySelector('.mlv-popup__header-content');
    expect(headerContent).not.toBeNull();
    expect(headerContent?.querySelector('.in-sheet-field')).not.toBeNull();
    // Header content sits inside the header, after the title/close row.
    expect(
      panel().querySelector('.mlv-popup__header .mlv-popup__header-row'),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pinned-content slot ([mlvPopupPinnedContent])
// ---------------------------------------------------------------------------

describe('MlvPopup — pinned content slot', () => {
  @Component({
    imports: [MlvPopup, MlvPopupContent, MlvPopupPinnedContent],
    template: `
      <mlv-popup [mobileMode]="mode()" mobileTitle="Pick one">
        <ng-template mlvPopupPinnedContent>
          <input class="pinned-field" />
        </ng-template>
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class HostComponent {
    readonly mode = signal<MlvPopupMobileMode>('off');
    readonly popup = viewChild.required(MlvPopup);
    readonly host = viewChild.required('host', { read: ViewContainerRef });

    stamp(): void {
      this.host().createEmbeddedView(this.popup().popupTemplate());
    }
  }

  /** Same popup without the slot — proves the absent-slot markup is unchanged. */
  @Component({
    imports: [MlvPopup, MlvPopupContent],
    template: `
      <mlv-popup>
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class NoSlotHostComponent {
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
    };
  }

  /** Index of a child inside the panel's own element children. */
  function indexIn(panel: HTMLElement, selector: string): number {
    return Array.from(panel.children).findIndex((el) => el.matches(selector));
  }

  it('renders the pinned block above the scroll region while trigger-anchored', () => {
    const { panel } = render();
    const pinned = panel().querySelector('.mlv-popup__pinned');
    expect(pinned).not.toBeNull();
    expect(pinned?.querySelector('.pinned-field')).not.toBeNull();
    // Outside the scroll viewport entirely — that is the whole point.
    expect(
      panel().querySelector('.mlv-popup__scrollbar .mlv-popup__pinned'),
    ).toBeNull();
    const pinnedIndex = indexIn(panel(), '.mlv-popup__pinned');
    const scrollbarIndex = indexIn(panel(), '.mlv-popup__scrollbar');
    expect(pinnedIndex).toBeGreaterThanOrEqual(0);
    expect(pinnedIndex).toBeLessThan(scrollbarIndex);
  });

  it('renders the pinned block below the fullscreen header and above the scroll region', () => {
    const { fixture, host, panel } = render();
    host.mode.set('fullscreen');
    fixture.detectChanges();

    const headerIndex = indexIn(panel(), '.mlv-popup__header');
    const pinnedIndex = indexIn(panel(), '.mlv-popup__pinned');
    const scrollbarIndex = indexIn(panel(), '.mlv-popup__scrollbar');
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(headerIndex).toBeLessThan(pinnedIndex);
    expect(pinnedIndex).toBeLessThan(scrollbarIndex);
    // The sheet's focus trap wraps the whole panel, so the pinned control is
    // inside it and stays reachable behind the solid backdrop.
    expect(
      panel().querySelector('.mlv-popup__pinned .pinned-field'),
    ).not.toBeNull();
  });

  it('stamps no pinned block when the slot is absent', () => {
    const fixture = TestBed.createComponent(NoSlotHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.stamp();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      '.mlv-popup',
    ) as HTMLElement;
    expect(panel.querySelector('.mlv-popup__pinned')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Header-actions slot ([mlvPopupHeaderActions])
// ---------------------------------------------------------------------------

describe('MlvPopup — header actions slot', () => {
  @Component({
    imports: [MlvPopup, MlvPopupContent, MlvPopupHeaderActions],
    template: `
      <mlv-popup [mobileMode]="mode()" mobileTitle="Pick a date">
        @if (withActions()) {
          <ng-template mlvPopupHeaderActions>
            <button class="sheet-done">Done</button>
          </ng-template>
        }
        <ng-template mlvPopupContent><button>content</button></ng-template>
      </mlv-popup>
      <ng-container #host />
    `,
  })
  class HostComponent {
    readonly mode = signal<MlvPopupMobileMode>('off');
    readonly withActions = signal(true);
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
    };
  }

  it('does not stamp the actions while trigger-anchored (mode "off")', () => {
    // The slot is for sheet chrome. An anchored dropdown has no header row at
    // all, so a consumer that projects a confirm action here must be able to
    // leave its own anchored affordance (a footer button) in place without the
    // two both appearing.
    const { panel } = render();
    expect(panel().querySelector('.mlv-popup__header-actions')).toBeNull();
    expect(panel().querySelector('.sheet-done')).toBeNull();
  });

  it('renders the actions in the title row when fullscreen', () => {
    const { fixture, host, panel } = render();
    host.mode.set('fullscreen');
    fixture.detectChanges();

    const actions = panel().querySelector(
      '.mlv-popup__header-row > .mlv-popup__header-actions',
    );
    expect(actions).not.toBeNull();
    expect(actions?.querySelector('.sheet-done')).not.toBeNull();
  });

  it('places the actions between the title and the close button', () => {
    // Order is the contract: a confirm action after the close button would put
    // the primary action past the dismiss one in both reading and tab order.
    const { fixture, host, panel } = render();
    host.mode.set('fullscreen');
    fixture.detectChanges();

    const row = panel().querySelector('.mlv-popup__header-row') as HTMLElement;
    const classes = Array.from(row.children).map((el) => el.className);

    expect(classes.indexOf('mlv-popup__title')).toBeLessThan(
      classes.indexOf('mlv-popup__header-actions'),
    );
    expect(classes.indexOf('mlv-popup__header-actions')).toBeLessThan(
      classes.findIndex((c) => c.includes('mlv-popup__close')),
    );
  });

  it('stamps no actions wrapper when the slot is absent', () => {
    const { fixture, host, panel } = render();
    host.withActions.set(false);
    host.mode.set('fullscreen');
    fixture.detectChanges();

    expect(panel().querySelector('.mlv-popup__header-actions')).toBeNull();
    expect(panel().querySelector('.mlv-popup__title')).not.toBeNull();
    expect(panel().querySelector('.mlv-popup__close')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Arrow geometry — logical `ConnectedPosition` pair → physical arrow edge (#163)
//
// CDK mirrors `start`/`end` against the *pane's* direction (`_isRtl()` reads
// `overlayRef.getDirection()`), so the pair `updateArrowFromPosition` receives
// is logical. `arrowEdge` is physical — it selects `.mlv-popup--arrow-left` /
// `--arrow-right`, whose `::before` is drawn with a physical `rotate(45deg)`
// and a physical inset — so the pair has to be converted, not copied.
// ---------------------------------------------------------------------------

describe('MlvPopup — arrow geometry', () => {
  /** A popup instance with no host, template or overlay — the mapping is pure. */
  function popup(): MlvPopup {
    const fixture = TestBed.createComponent(MlvPopup);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  /** `left-*`: the popup hangs off the trigger's inline-start side. */
  const INLINE_START_OF_TRIGGER = {
    originX: 'start',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'top',
  } as const satisfies ConnectedPosition;

  /** `right-*`: the popup hangs off the trigger's inline-end side. */
  const INLINE_END_OF_TRIGGER = {
    originX: 'end',
    originY: 'center',
    overlayX: 'start',
    overlayY: 'center',
  } as const satisfies ConnectedPosition;

  /** `bottom-start`: below the trigger, inline-start edges aligned. */
  const BELOW_TRIGGER_START = {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
  } as const satisfies ConnectedPosition;

  /** `top-end`: above the trigger, inline-end edges aligned. */
  const ABOVE_TRIGGER_END = {
    originX: 'end',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
  } as const satisfies ConnectedPosition;

  describe('side-anchored positions', () => {
    it('puts the arrow on the physical right edge in LTR', () => {
      const p = popup();
      p.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'ltr');
      // `overlayX: 'end'` + `originX: 'start'` places the panel to the LEFT of
      // the trigger in LTR, so the arrow points right, off the panel's right edge.
      expect(p.arrowEdge()).toBe('right');
    });

    it('puts the arrow on the physical LEFT edge for the same pair in RTL', () => {
      const p = popup();
      p.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'rtl');
      // Same logical pair, mirrored pane: `start` is the trigger's right edge and
      // `overlayX: 'end'` pins the panel's right edge there, so the panel is to
      // the RIGHT of the trigger and the arrow belongs on its left edge.
      expect(p.arrowEdge()).toBe('left');
    });

    it('puts the arrow on the physical left edge in LTR for the mirrored pair', () => {
      const p = popup();
      p.updateArrowFromPosition(INLINE_END_OF_TRIGGER, 'ltr');
      expect(p.arrowEdge()).toBe('left');
    });

    it('puts the arrow on the physical RIGHT edge for that pair in RTL', () => {
      const p = popup();
      p.updateArrowFromPosition(INLINE_END_OF_TRIGGER, 'rtl');
      expect(p.arrowEdge()).toBe('right');
    });

    it('keeps the block-axis alignment unmirrored', () => {
      // A side arrow's alignment rides `overlayY`, and the block axis never
      // mirrors — `top` is `top` in both directions.
      const ltr = popup();
      const rtl = popup();
      ltr.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'ltr');
      rtl.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'rtl');
      expect(ltr.arrowAlign()).toBe('start');
      expect(rtl.arrowAlign()).toBe('start');

      const bottom = {
        ...INLINE_START_OF_TRIGGER,
        overlayY: 'bottom',
      } as const;
      const p = popup();
      p.updateArrowFromPosition(bottom, 'rtl');
      expect(p.arrowAlign()).toBe('end');

      const centred = popup();
      centred.updateArrowFromPosition(INLINE_END_OF_TRIGGER, 'rtl');
      expect(centred.arrowAlign()).toBe('center');
    });
  });

  describe('top/bottom-anchored positions', () => {
    it('keeps the edge on the block axis in both directions', () => {
      const ltr = popup();
      const rtl = popup();
      ltr.updateArrowFromPosition(BELOW_TRIGGER_START, 'ltr');
      rtl.updateArrowFromPosition(BELOW_TRIGGER_START, 'rtl');
      expect(ltr.arrowEdge()).toBe('top');
      expect(rtl.arrowEdge()).toBe('top');
    });

    it('mirrors the inline alignment of a `bottom-start` panel in RTL', () => {
      const ltr = popup();
      const rtl = popup();
      ltr.updateArrowFromPosition(BELOW_TRIGGER_START, 'ltr');
      rtl.updateArrowFromPosition(BELOW_TRIGGER_START, 'rtl');
      // `overlayX: 'start'` pins the panel's left edge to the trigger's left in
      // LTR and its right edge to the trigger's right in RTL, so the arrow sits
      // 1rem from the physical left, then 1rem from the physical right.
      expect(ltr.arrowAlign()).toBe('start');
      expect(rtl.arrowAlign()).toBe('end');
    });

    it('mirrors the inline alignment of a `top-end` panel in RTL', () => {
      const ltr = popup();
      const rtl = popup();
      ltr.updateArrowFromPosition(ABOVE_TRIGGER_END, 'ltr');
      rtl.updateArrowFromPosition(ABOVE_TRIGGER_END, 'rtl');
      expect(ltr.arrowEdge()).toBe('bottom');
      expect(rtl.arrowEdge()).toBe('bottom');
      expect(ltr.arrowAlign()).toBe('end');
      expect(rtl.arrowAlign()).toBe('start');
    });

    it('leaves a centred panel centred', () => {
      const p = popup();
      p.updateArrowFromPosition(
        { ...BELOW_TRIGGER_START, originX: 'center', overlayX: 'center' },
        'rtl',
      );
      expect(p.arrowAlign()).toBe('center');
    });
  });

  it('assumes LTR when no direction is supplied', () => {
    // The parameter is optional so the public method stays source-compatible;
    // the default has to reproduce the pre-#163 mapping exactly.
    const p = popup();
    p.updateArrowFromPosition(INLINE_START_OF_TRIGGER);
    expect(p.arrowEdge()).toBe('right');
  });

  it('derives the hidden-transform offset from the physical edge', () => {
    // `popupHiddenTransform` switches on `arrowEdge`, so the conversion reaches
    // it too. It is bound to `--mlv-popup-hidden-transform`, which **no**
    // stylesheet in the workspace reads — the `popup-enter` / `popup-leave`
    // keyframes read the `--mlv-popup-enter-from-*` / `--mlv-popup-leave-to-*`
    // set instead — so this pins the computed, not a visual effect.
    const ltr = popup();
    const rtl = popup();
    ltr.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'ltr');
    rtl.updateArrowFromPosition(INLINE_START_OF_TRIGGER, 'rtl');
    expect(ltr.popupHiddenTransform()).toBe('translateX(4px)');
    expect(rtl.popupHiddenTransform()).toBe('translateX(-4px)');
  });
});
