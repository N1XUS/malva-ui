import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvToastItem } from './toast-item';
import { MLV_TOAST_CLOSE } from '../toast.types';
import type { MlvInternalToast, MlvToastTone } from '../toast.types';
import { MlvToastIcon } from '../toast.directives';

// Deliberately renders no icon: the assertion below proves the *built-in* icon is
// suppressed, so this content must not contribute a `__icon` element of its own.
@Component({
  selector: 'mlv-test-dynamic-toast-content',
  template: `dynamic`,
})
class DynamicToastContent {}

// Consumer content marks its own leading icon with `[mlvToastIcon]`.
@Component({
  selector: 'mlv-test-slotted-icon-content',
  imports: [MlvToastIcon],
  template: `<svg mlvToastIcon></svg>slotted`,
})
class SlottedIconContent {}

function makeToast(
  overrides: Partial<MlvInternalToast> = {},
): MlvInternalToast {
  return {
    id: 'toast-1',
    title: 'Title',
    description: '',
    tone: 'info',
    shape: 'default',
    position: 'top-right',
    displayTime: 5000,
    pauseOnHover: true,
    closable: true,
    ...overrides,
  };
}

describe('MlvToastItem', () => {
  let fixture: ComponentFixture<MlvToastItem>;
  let component: MlvToastItem;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvToastItem],
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_TOAST_CLOSE, useValue: vi.fn() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvToastItem);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
  });

  function render(toast: MlvInternalToast): void {
    fixture.componentRef.setInput('toast', toast);
    fixture.detectChanges();
  }

  it('should create', () => {
    render(makeToast());
    expect(component).toBeTruthy();
  });

  it('uses only the inner native close button as the interactive target', () => {
    render(makeToast());
    const dismiss = TestBed.inject(MLV_TOAST_CLOSE);
    const closeHost = hostEl.querySelector('mlv-button-close') as HTMLElement;
    const closeButton = closeHost.querySelector('button') as HTMLButtonElement;

    expect(closeHost.hasAttribute('tabindex')).toBe(false);
    expect(closeHost.hasAttribute('role')).toBe(false);
    expect(closeButton.tabIndex).toBe(0);

    closeButton.click();

    expect(dismiss).toHaveBeenCalledWith('toast-1');
  });

  describe('announcement', () => {
    const tones: MlvToastTone[] = [
      'danger',
      'warning',
      'success',
      'info',
      'default',
    ];

    // Announcing is the service's job, through the single persistent LiveAnnouncer
    // region. The rendered item must therefore carry no live-region semantics of
    // its own, or every message would be announced twice.
    for (const tone of tones) {
      it(`exposes no live-region role for the ${tone} tone`, () => {
        render(makeToast({ tone }));
        expect(hostEl.hasAttribute('role')).toBe(false);
        expect(hostEl.hasAttribute('aria-live')).toBe(false);
      });
    }
  });

  describe('shape', () => {
    it('omits the pill modifier for the default shape', () => {
      render(makeToast({ shape: 'default' }));
      expect(hostEl.classList.contains('mlv-toast-item--pill')).toBe(false);
      expect(hostEl.classList.contains('mlv-toast-item--info')).toBe(true);
    });

    it('applies the pill modifier alongside the tone modifier', () => {
      render(makeToast({ shape: 'pill', tone: 'success' }));
      expect(hostEl.classList.contains('mlv-toast-item--pill')).toBe(true);
      expect(hostEl.classList.contains('mlv-toast-item--success')).toBe(true);
    });
  });

  describe('tone-derived icon', () => {
    const iconTones: MlvToastTone[] = ['success', 'warning', 'danger', 'info'];

    for (const tone of iconTones) {
      it(`renders a decorative icon for the ${tone} tone`, () => {
        render(makeToast({ tone, icon: true }));
        const icon = hostEl.querySelector('.mlv-toast-item__icon');

        expect(icon).not.toBeNull();
        expect(icon?.getAttribute('aria-hidden')).toBe('true');
        expect(icon?.querySelector('svg')).not.toBeNull();
      });
    }

    it('renders a distinct icon per semantic tone', () => {
      const drawn = iconTones.map((tone) => {
        render(makeToast({ tone, icon: true }));
        return (
          hostEl.querySelector('.mlv-toast-item__icon svg')?.innerHTML ?? ''
        );
      });

      expect(drawn.every((svg) => svg.length > 0)).toBe(true);
      // Guards against the @switch collapsing to a single always-rendered icon.
      expect(new Set(drawn).size).toBe(iconTones.length);
    });

    it('renders no icon when icon is not requested', () => {
      render(makeToast({ tone: 'success' }));
      expect(hostEl.querySelector('.mlv-toast-item__icon')).toBeNull();
    });

    it('renders no icon for the default tone even when icon is true', () => {
      render(makeToast({ tone: 'default', icon: true }));
      expect(hostEl.querySelector('.mlv-toast-item__icon')).toBeNull();
    });

    it('never leaks the icon flag as text content', () => {
      render(makeToast({ tone: 'default', icon: true }));
      expect(hostEl.textContent).not.toContain('true');
    });

    it('suppresses the built-in icon for dynamic content', () => {
      render(
        makeToast({
          tone: 'success',
          icon: true,
          title: '',
          content: DynamicToastContent,
        }),
      );

      expect(hostEl.querySelector('.mlv-toast-item__icon')).toBeNull();
      expect(hostEl.textContent).toContain('dynamic');
    });

    it('lets dynamic content supply its own leading icon via [mlvToastIcon]', () => {
      render(
        makeToast({
          tone: 'success',
          icon: true,
          title: '',
          content: SlottedIconContent,
        }),
      );

      const icon = hostEl.querySelector('.mlv-toast-item__icon');

      // The single `__icon` present is the consumer's, inside the content slot —
      // not a built-in sibling of `__content`.
      expect(hostEl.querySelectorAll('.mlv-toast-item__icon').length).toBe(1);
      expect(icon?.closest('.mlv-toast-item__dynamic-content')).not.toBeNull();
      expect(hostEl.textContent).toContain('slotted');
    });
  });

  describe('auto-dismiss timer pause on focus (WCAG 2.2.1)', () => {
    it('pauses the timer on focusin', () => {
      render(makeToast());
      const pauseSpy = vi.spyOn(
        (component as unknown as { timer: { pause(): void } }).timer,
        'pause',
      );

      hostEl.dispatchEvent(new FocusEvent('focusin'));

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('resumes the timer when focus leaves the item entirely', () => {
      render(makeToast());
      const startSpy = vi.spyOn(
        (
          component as unknown as {
            timer: { start(t: number, cb: () => void): void };
          }
        ).timer,
        'start',
      );

      hostEl.dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: document.body }),
      );

      expect(startSpy).toHaveBeenCalled();
    });

    it('does not resume when focus moves within the item', () => {
      render(makeToast());
      const inner = hostEl.querySelector('button') as HTMLElement;
      const startSpy = vi.spyOn(
        (
          component as unknown as {
            timer: { start(t: number, cb: () => void): void };
          }
        ).timer,
        'start',
      );

      hostEl.dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: inner }),
      );

      expect(startSpy).not.toHaveBeenCalled();
    });
  });
});
