import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MLV_TOAST_CLOSE } from '@malva-ui/core/toast';
import { MlvNotificationItem } from './notification-item';
import type { MlvInternalNotification } from '../notification.types';
import type { MlvNotificationTone } from '../notification.types';

function makeNotification(
  overrides: Partial<MlvInternalNotification> = {},
): MlvInternalNotification {
  return {
    id: 'notif-1',
    title: 'Title',
    description: '',
    tone: 'info',
    position: 'top-right',
    displayTime: 6000,
    pauseOnHover: true,
    closable: true,
    actions: [],
    showIcon: true,
    ...overrides,
  };
}

describe('MlvNotificationItem', () => {
  let fixture: ComponentFixture<MlvNotificationItem>;
  let component: MlvNotificationItem;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvNotificationItem],
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_TOAST_CLOSE, useValue: vi.fn() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvNotificationItem);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
  });

  function render(notification: MlvInternalNotification): void {
    fixture.componentRef.setInput('toast', notification);
    fixture.detectChanges();
  }

  it('should create', () => {
    render(makeNotification());
    expect(component).toBeTruthy();
  });

  describe('announcement', () => {
    const tones: MlvNotificationTone[] = [
      'danger',
      'warning',
      'success',
      'info',
      'default',
    ];

    // MlvNotificationService announces through the single persistent LiveAnnouncer
    // region, so the rendered item must carry no live-region semantics of its own —
    // otherwise every notification is announced twice.
    for (const tone of tones) {
      it(`exposes no live-region role for the ${tone} tone`, () => {
        render(makeNotification({ tone }));
        expect(hostEl.hasAttribute('role')).toBe(false);
        expect(hostEl.hasAttribute('aria-live')).toBe(false);
      });
    }
  });

  it('pauses the auto-dismiss timer on focusin', () => {
    render(makeNotification());
    const pauseSpy = vi.spyOn(
      (component as unknown as { timer: { pause(): void } }).timer,
      'pause',
    );

    hostEl.dispatchEvent(new FocusEvent('focusin'));

    expect(pauseSpy).toHaveBeenCalled();
  });

  /**
   * An action button is a native `<button>`, so a real browser answers Enter
   * and Space with a `click` of its own (#299). jsdom synthesises none, so the
   * keydown → click → keyup sequence Chrome dispatches for one trusted press is
   * replayed by hand. "Undo" used to run twice: once for the keydown, once for
   * the click the browser made from it.
   */
  describe('action keyboard activation', () => {
    for (const key of ['Enter', ' ']) {
      it(`runs the action once per ${JSON.stringify(key)} press`, () => {
        const action = vi.fn();
        render(makeNotification({ actions: [{ label: 'Undo', action }] }));
        const button = hostEl.querySelector(
          '.mlv-notification-item__actions button',
        ) as HTMLButtonElement;
        expect(button.textContent?.trim()).toBe('Undo');

        const keydown = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        button.dispatchEvent(keydown);
        if (!keydown.defaultPrevented) {
          button.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
          );
        }
        button.dispatchEvent(
          new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }),
        );

        expect(action).toHaveBeenCalledTimes(1);
      });
    }
  });
});
