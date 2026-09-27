import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
  type ElementRef,
  type Type,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MlvAlertFocusTarget } from './alert';
import { MlvAlert } from './alert';

/**
 * #333: dismissing hid the host while its close button held focus, so the
 * browser dropped focus to `<body>` (measured in Chromium, two frames after
 * Enter; the same on a mouse click, on a consumer removing the alert from its
 * `(dismissed)` handler, and at the end of an `animate.leave`). jsdom does no
 * focus fix-up, so asserting "not `<body>`" would pass against the old code
 * with focus still on the hidden button: every case names the element focus
 * must land on.
 */

/** Id of the focused element, or a marker naming where focus is instead. */
function focusedId(): string {
  const active = document.activeElement;
  if (!active || active === document.body) return 'BODY';
  if (active.closest('mlv-alert')) {
    return `inside-alert:${active.id || active.tagName.toLowerCase()}`;
  }
  return active.id || active.tagName.toLowerCase();
}

function closeButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(
    '.mlv-alert__dismiss button',
  );
  if (!button) throw new Error('no dismiss button rendered');
  return button;
}

/** Focuses the dismiss button and activates it, as Enter or a click does. */
async function dismissFromKeyboard<T>(fixture: ComponentFixture<T>) {
  const button = closeButton(fixture.nativeElement as HTMLElement);
  button.focus();
  expect(focusedId()).toBe('inside-alert:button');
  button.click();
  fixture.detectChanges();
  await fixture.whenStable();
}

/**
 * Focuses the dismiss button, then dispatches the click a real activation
 * produces: `detail` 1 for a mouse or touch click, 0 for Enter or Space
 * (measured in Chromium, Firefox and WebKit).
 */
async function dismissWithDetail<T>(
  fixture: ComponentFixture<T>,
  detail: number,
) {
  const button = closeButton(fixture.nativeElement as HTMLElement);
  button.focus();
  expect(focusedId()).toBe('inside-alert:button');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
  fixture.detectChanges();
  await fixture.whenStable();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    <button id="before" type="button">Before</button>
    <mlv-alert
      tone="info"
      dismissible
      [dismissFocusTarget]="target()"
      (dismissed)="dismissedCount.set(dismissedCount() + 1)"
    >
      Saved.
      <button id="undo" type="button">Undo</button>
    </mlv-alert>
    <button id="disabled-after" type="button" disabled>Disabled</button>
    <div id="not-tabbable" tabindex="-1">Programmatic only</div>
    <a id="no-href">Not a link</a>
    <input id="hidden-input" type="hidden" />
    <!-- Tabbable to CDK (it reads the button's own disabled attribute only),
         refused by focus(): only the read-back skips it. -->
    <fieldset disabled>
      <button id="fieldset-disabled" type="button">
        In a disabled fieldset
      </button>
    </fieldset>
    <span>
      <button id="after" type="button">After</button>
    </span>
    <h2 #heading id="heading" tabindex="-1">Heading</h2>
    <button #disabledTarget id="disabled-target" type="button" disabled>
      Nope
    </button>
  `,
})
class NextTargetHost {
  readonly target = signal<MlvAlertFocusTarget | null>(null);
  readonly dismissedCount = signal(0);
  readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  readonly disabledTarget =
    viewChild.required<ElementRef<HTMLButtonElement>>('disabledTarget');
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    <div>
      <button id="before" type="button">Before</button>
      <span id="plain">Plain text</span>
    </div>
    <mlv-alert tone="warning" dismissible>Last focusable thing.</mlv-alert>
    <p>Trailing text, nothing to focus.</p>
  `,
})
class PreviousTargetHost {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `<mlv-alert tone="danger" dismissible>Alone.</mlv-alert>`,
})
class NothingElseHost {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    @for (item of items(); track item) {
      <mlv-alert tone="success" dismissible (dismissed)="remove(item)">
        {{ item }}
      </mlv-alert>
    }
    <button id="restore" type="button">Restore</button>
  `,
})
class RemovalHost {
  readonly items = signal(['one', 'two']);

  remove(item: string): void {
    this.items.update((list) => list.filter((entry) => entry !== item));
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    <mlv-alert tone="info" dismissible (dismissed)="heading.focus()">
      Consumer moves focus itself.
    </mlv-alert>
    <button id="after" type="button">After</button>
    <h2 #heading id="heading" tabindex="-1">Heading</h2>
  `,
})
class ConsumerFocusHost {}

@Component({
  selector: 'mlv-test-shadow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [MlvAlert],
  template: `
    <mlv-alert tone="info" dismissible>Inside a shadow root.</mlv-alert>
    @if (withSibling()) {
      <button id="shadow-next" type="button">Beside it, same root</button>
    }
  `,
})
class ShadowPanel {
  readonly withSibling = input(false);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShadowPanel],
  template: `
    <button id="light-before" type="button">Before the component</button>
    <mlv-test-shadow-panel [withSibling]="withSibling()" />
    <button id="light-after" type="button">After the component</button>
  `,
})
class ShadowHost {
  readonly withSibling = signal(false);
}

describe('MlvAlert — focus after dismiss (#333)', () => {
  function setup<T>(
    host: Type<T>,
    errorHandler?: ErrorHandler,
  ): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [host],
      providers: [
        provideMlvI18nTesting(),
        errorHandler ? [{ provide: ErrorHandler, useValue: errorHandler }] : [],
      ],
      // Read on every configureTestingModule call, so it is set here, once.
      rethrowApplicationErrors: !errorHandler,
    });
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  it('moves focus to the next tabbable element after the alert', async () => {
    const fixture = setup(NextTargetHost);
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    // Skips the alert's own Undo button, the disabled button, the
    // tabindex="-1" element, the href-less anchor, the hidden input and —
    // through the read-back — the button in the disabled fieldset.
    expect(focusedId()).toBe('after');
    expect(fixture.componentInstance.dismissedCount()).toBe(1);
    const host = fixture.nativeElement.querySelector(
      'mlv-alert',
    ) as HTMLElement;
    expect(host.hasAttribute('hidden')).toBe(true);
  });

  it('falls back to the previous tabbable element when nothing follows', async () => {
    const fixture = setup(PreviousTargetHost);
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    expect(focusedId()).toBe('before');
  });

  it('leaves focus alone when no tabbable element remains', async () => {
    const fixture = setup(NothingElseHost);
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    // Nowhere to go: the alert does not invent a target. The browser moves
    // focus off the hidden button on its own.
    expect(focusedId()).toBe('inside-alert:button');
  });

  it('moves focus to dismissFocusTarget when it can take focus', async () => {
    const fixture = setup(NextTargetHost);
    fixture.componentInstance.target.set(
      fixture.componentInstance.heading().nativeElement,
    );
    fixture.detectChanges();
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    expect(focusedId()).toBe('heading');
  });

  it('accepts any object with focus(), such as a component', async () => {
    const fixture = setup(NextTargetHost);
    const heading = fixture.componentInstance.heading().nativeElement;
    let calls = 0;
    fixture.componentInstance.target.set({
      focus: () => {
        calls += 1;
        heading.focus();
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    expect(calls).toBe(1);
    expect(focusedId()).toBe('heading');
  });

  it('falls back to the next tabbable element when dismissFocusTarget cannot take focus', async () => {
    const fixture = setup(NextTargetHost);
    fixture.componentInstance.target.set(
      fixture.componentInstance.disabledTarget().nativeElement,
    );
    fixture.detectChanges();
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    expect(focusedId()).toBe('after');
  });

  it('does not take focus when focus was not in the alert', async () => {
    const fixture = setup(NextTargetHost);
    await fixture.whenStable();
    const before = fixture.nativeElement.querySelector(
      '#before',
    ) as HTMLElement;
    before.focus();
    // Spied after #before takes focus: from here on nothing — the target, a
    // candidate of the walk, #before itself — may be focused. Where focus
    // ends is not enough (review G1): without the focus-inside guard the walk
    // tries #fieldset-disabled first, which refuses focus, and the read-back
    // then sees focus on #before, not lost, and stops — #before untouched.
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    try {
      // A script, or a screen reader activating without moving focus.
      closeButton(fixture.nativeElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(focus).not.toHaveBeenCalled();
    } finally {
      focus.mockRestore();
    }
    expect(focusedId()).toBe('before');
    expect(fixture.componentInstance.dismissedCount()).toBe(1);
  });

  it('keeps focus where a (dismissed) handler put it', async () => {
    const fixture = setup(ConsumerFocusHost);
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    expect(focusedId()).toBe('heading');
  });

  it('keeps focus in place when the consumer removes the alert from (dismissed)', async () => {
    const fixture = setup(RemovalHost);
    await fixture.whenStable();

    await dismissFromKeyboard(fixture);

    // The first alert is gone; focus moved to the next one's dismiss button
    // before the consumer removed it, so dismissing a stack keeps going.
    expect(fixture.nativeElement.querySelectorAll('mlv-alert')).toHaveLength(1);
    expect(focusedId()).toBe('inside-alert:button');
    expect(
      (document.activeElement as HTMLElement).closest('mlv-alert')?.textContent,
    ).toContain('two');

    await dismissFromKeyboard(fixture);

    expect(fixture.nativeElement.querySelectorAll('mlv-alert')).toHaveLength(0);
    expect(focusedId()).toBe('restore');
  });

  it('never focuses a control inside the alert on the way out', async () => {
    const fixture = setup(NextTargetHost);
    await fixture.whenStable();
    const undo = fixture.nativeElement.querySelector('#undo') as HTMLElement;
    const focusedUndo = vi.fn();
    undo.addEventListener('focus', focusedUndo);

    await dismissFromKeyboard(fixture);

    // The walk rejects the alert's subtree; trying its controls and reading
    // the refusal back would still end on #after, but would fire focus and
    // blur on each — a projected tooltip host would schedule a show.
    expect(focusedUndo).not.toHaveBeenCalled();
    expect(focusedId()).toBe('after');
  });

  describe('scroll (review F1)', () => {
    it('focuses without scrolling after a pointer click', async () => {
      const fixture = setup(NextTargetHost);
      await fixture.whenStable();
      const after = fixture.nativeElement.querySelector(
        '#after',
      ) as HTMLElement;
      const focus = vi.spyOn(after, 'focus');

      await dismissWithDetail(fixture, 1);

      // Chromium and Firefox focus a clicked button, so the move runs for a
      // mouse too; scrolling a far-off control into view would jump the page.
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusedId()).toBe('after');
    });

    it('passes preventScroll to dismissFocusTarget after a pointer click', async () => {
      const fixture = setup(NextTargetHost);
      const heading = fixture.componentInstance.heading().nativeElement;
      const focus = vi.fn(() => heading.focus());
      fixture.componentInstance.target.set({ focus });
      fixture.detectChanges();
      await fixture.whenStable();

      await dismissWithDetail(fixture, 1);

      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusedId()).toBe('heading');
    });

    it('scrolls the new focus into view after Enter or Space (detail 0)', async () => {
      const fixture = setup(NextTargetHost);
      await fixture.whenStable();
      const after = fixture.nativeElement.querySelector(
        '#after',
      ) as HTMLElement;
      const focus = vi.spyOn(after, 'focus');

      await dismissWithDetail(fixture, 0);

      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus.mock.calls[0]?.[0]).toBeUndefined();
      expect(focusedId()).toBe('after');
    });
  });

  describe('a target that cannot be focused (review F2)', () => {
    it('falls back when dismissFocusTarget has no callable focus()', async () => {
      const handleError = vi.fn();
      const fixture = setup(NextTargetHost, { handleError });
      // What `#ref` on `button[mlvButton]` hands a non-strict template: the
      // component instance, which has no focus().
      fixture.componentInstance.target.set({} as MlvAlertFocusTarget);
      fixture.detectChanges();
      await fixture.whenStable();

      await dismissFromKeyboard(fixture);

      expect(focusedId()).toBe('after');
      // Skipped, not called: the try/catch around a throwing focus() would
      // also reach the fallback, but would report a TypeError for a target
      // that simply has no focus() to call.
      expect(handleError).not.toHaveBeenCalled();
      expect(fixture.componentInstance.dismissedCount()).toBe(1);
      const host = fixture.nativeElement.querySelector(
        'mlv-alert',
      ) as HTMLElement;
      expect(host.hasAttribute('hidden')).toBe(true);
    });

    it('reports a throwing target to the ErrorHandler and falls back', async () => {
      const handleError = vi.fn();
      const fixture = setup(NextTargetHost, { handleError });
      const failure = new Error('consumer focus() failed');
      fixture.componentInstance.target.set({
        focus: () => {
          throw failure;
        },
      });
      fixture.detectChanges();
      await fixture.whenStable();

      await dismissFromKeyboard(fixture);

      // Treated as refused: the walk runs instead of focus dropping to <body>.
      expect(focusedId()).toBe('after');
      // The failure is not swallowed.
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toBe(failure);
      expect(fixture.componentInstance.dismissedCount()).toBe(1);
      const host = fixture.nativeElement.querySelector(
        'mlv-alert',
      ) as HTMLElement;
      expect(host.hasAttribute('hidden')).toBe(true);
    });
  });

  describe('inside a shadow root (review F6)', () => {
    function shadowRootOf(fixture: ComponentFixture<ShadowHost>): ShadowRoot {
      const panel = (fixture.nativeElement as HTMLElement).querySelector(
        'mlv-test-shadow-panel',
      );
      if (!panel?.shadowRoot) throw new Error('no shadow root rendered');
      return panel.shadowRoot;
    }

    async function dismissInShadow(fixture: ComponentFixture<ShadowHost>) {
      const root = shadowRootOf(fixture);
      const button = root.querySelector<HTMLButtonElement>(
        '.mlv-alert__dismiss button',
      );
      if (!button) throw new Error('no dismiss button rendered');
      button.focus();
      expect(root.activeElement).toBe(button);
      button.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('moves to a control beside the alert in the same shadow root', async () => {
      const fixture = setup(ShadowHost);
      fixture.componentInstance.withSibling.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await dismissInShadow(fixture);

      expect(shadowRootOf(fixture).activeElement?.id).toBe('shadow-next');
    });

    it('leaves the shadow root when the alert is its only tabbable', async () => {
      const fixture = setup(ShadowHost);
      await fixture.whenStable();

      await dismissInShadow(fixture);

      // Nothing else in the component: the walk continues around the shadow
      // host in the document, next first.
      expect(shadowRootOf(fixture).activeElement).toBeNull();
      expect(document.activeElement?.id).toBe('light-after');
    });
  });
});
