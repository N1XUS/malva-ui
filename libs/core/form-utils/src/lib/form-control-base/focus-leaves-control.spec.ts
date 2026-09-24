import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvSignalFormControlBase } from './signal-form-control-base';

/**
 * Counts, per event type, how many listeners `target` gained minus how many
 * it lost — so a spec can assert **which** object received a listener and
 * that a teardown removed it (the `sidebar-rail.spec.ts` pattern).
 */
function trackListeners(target: EventTarget): Map<string, number> {
  const net = new Map<string, number>();
  const bump = (type: string, delta: number): void =>
    void net.set(type, (net.get(type) ?? 0) + delta);
  const realAdd = target.addEventListener.bind(target);
  const realRemove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, 1);
      realAdd(type, listener, options);
    },
  );
  vi.spyOn(target, 'removeEventListener').mockImplementation(
    (type, listener, options) => {
      bump(type, -1);
      realRemove(type, listener, options);
    },
  );
  return net;
}

/** Lets the verdict's one-task delay run. */
function nextTask(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function press(target: EventTarget, type: string): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

/**
 * What a browser dispatches when a press on a non-focusable part (an
 * `mlv-radio`'s label) blurs the focused part at `mousedown`: a `focusout`
 * naming no element. jsdom moves no focus on a press, so it is dispatched
 * by hand.
 */
function blurToNowhere(part: Element): void {
  part.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
  );
}

/**
 * A control with two focusable parts, wired the way every multi-part Malva
 * control is: the parts set `focused()` on focus, and the base's focus-leave
 * report decides whether focus left the control. A native input is fine here
 * (test fixture, not shipped code).
 */
@Component({
  selector: 'mlv-test-composite',
  template: `
    <input class="part-a" (focus)="setFocused(true)" />
    <span class="label-text">Label text</span>
    <input class="part-b" (focus)="setFocused(true)" />
    <div class="nested-shadow-host" #shadowHost></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestCompositeComponent extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);

  constructor() {
    super();
    this._reportTouchOnFocusLeave();
  }

  /** Element a nested shadow root is attached to. */
  readonly shadowHost =
    viewChild.required<ElementRef<HTMLElement>>('shadowHost');

  /** Test hook: {@link _focusLeavesControl} with extra containers. */
  leaves(event: FocusEvent, ...containers: (Element | null)[]): boolean {
    return this._focusLeavesControl(event, ...containers);
  }
}

@Component({
  template: `
    <!-- A focusable page around the control, as main[mlvPage] is. -->
    <main class="page" tabindex="-1">
      <mlv-test-composite (touch)="touches = touches + 1" />
      <button type="button" class="outside">Outside</button>
    </main>
  `,
  imports: [TestCompositeComponent],
})
class CompositeHost {
  touches = 0;
  readonly control = viewChild.required(TestCompositeComponent);
}

/**
 * A control with a part outside its host — the shape of a control that
 * portals a pane to `<body>` — passing it as a container.
 */
@Component({
  selector: 'mlv-test-pane-composite',
  template: `<input class="part-a" (focus)="setFocused(true)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPaneCompositeComponent extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);

  /** Containers outside the host; set by the spec, read on every event. */
  panes: Element[] = [];

  constructor() {
    super();
    this._reportTouchOnFocusLeave({ containers: () => this.panes });
  }
}

@Component({
  template: `
    <mlv-test-pane-composite (touch)="touches = touches + 1" />
    <button type="button" class="outside">Outside</button>
  `,
  imports: [TestPaneCompositeComponent],
})
class PaneHost {
  touches = 0;
  readonly control = viewChild.required(TestPaneCompositeComponent);
}

/**
 * #347 (owner decision D22): the base's focus-leave helpers — a control with
 * several parts reports touched, and stops reporting focused, only when focus
 * leaves the control.
 */
describe('MlvSignalFormUiControlBase — focus leaving the control (#347)', () => {
  let fixture: ComponentFixture<CompositeHost>;
  let host: CompositeHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompositeHost],
    }).compileComponents();
    fixture = TestBed.createComponent(CompositeHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function query<T extends HTMLElement>(selector: string): T {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) as T;
  }

  it('neither touches nor unfocuses on a move between two parts', () => {
    query<HTMLInputElement>('.part-a').focus();
    query<HTMLInputElement>('.part-b').focus();
    query<HTMLInputElement>('.part-a').focus();

    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);
  });

  it('touches once and unfocuses when focus moves outside the host', () => {
    query<HTMLInputElement>('.part-a').focus();
    query<HTMLInputElement>('.part-b').focus();
    query<HTMLButtonElement>('.outside').focus();

    expect(host.touches).toBe(1);
    expect(host.control().focused()).toBe(false);
  });

  it('counts a focusout naming no element as leaving', () => {
    const part = query<HTMLInputElement>('.part-a');
    part.focus();
    part.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );

    expect(host.touches).toBe(1);
    expect(host.control().focused()).toBe(false);
  });

  it('counts el.blur() as leaving', () => {
    const part = query<HTMLInputElement>('.part-a');
    part.focus();
    part.blur();

    expect(host.touches).toBe(1);
  });

  it('keeps focus that enters a shadow root nested inside the control', () => {
    const shadow = host
      .control()
      .shadowHost()
      .nativeElement.attachShadow({ mode: 'open' });
    const inner = document.createElement('input');
    shadow.append(inner);

    query<HTMLInputElement>('.part-a').focus();
    inner.focus();

    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);
  });

  it('does not touch when a press inside blurs a part and the click focuses another', async () => {
    const label = query<HTMLElement>('.label-text');
    query<HTMLInputElement>('.part-a').focus();

    press(label, 'pointerdown');
    // The `mousedown` blur: focus goes to <body>, naming no element (jsdom
    // names the document, which counts the same).
    query<HTMLInputElement>('.part-a').blur();
    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);

    press(label, 'pointerup');
    press(label, 'click');
    // The click's default action — the label focusing its control — runs
    // after the click's listeners, so after the press has already ended.
    query<HTMLInputElement>('.part-b').focus();
    await nextTask();

    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);
  });

  it('does not touch when a press inside moves focus to a focusable ancestor and the click brings it back', async () => {
    // Measured on the docs app: mousedown on a radio's label text focuses the
    // nearest focusable ancestor, the `tabindex="-1"` page.
    const label = query<HTMLElement>('.label-text');
    query<HTMLInputElement>('.part-a').focus();

    press(label, 'pointerdown');
    query<HTMLElement>('.page').focus();
    expect(host.touches).toBe(0);

    press(label, 'click');
    query<HTMLInputElement>('.part-b').focus();
    await nextTask();

    expect(host.touches).toBe(0);
  });

  it('touches when a press inside leaves focus on the ancestor', async () => {
    const label = query<HTMLElement>('.label-text');
    query<HTMLInputElement>('.part-a').focus();

    press(label, 'pointerdown');
    query<HTMLElement>('.page').focus();
    press(label, 'click');
    await nextTask();

    expect(host.touches).toBe(1);
  });

  it('counts focus moving to an ancestor with no press as leaving, on the spot', () => {
    query<HTMLInputElement>('.part-a').focus();
    query<HTMLElement>('.page').focus();

    expect(host.touches).toBe(1);
  });

  it('counts a synthetic focusout naming no element the same during a press', async () => {
    const label = query<HTMLElement>('.label-text');
    query<HTMLInputElement>('.part-a').focus();

    press(label, 'pointerdown');
    blurToNowhere(query('.part-a'));
    press(label, 'click');
    await nextTask();

    // Focus never left part A in jsdom, so the verdict finds it inside.
    expect(host.touches).toBe(0);
  });

  it('touches once the press ends if focus did not come back inside', async () => {
    // Focus already outside, so no real focus move reaches the host: only the
    // deferred verdict can report this one.
    query<HTMLButtonElement>('.outside').focus();
    const label = query<HTMLElement>('.label-text');

    press(label, 'pointerdown');
    blurToNowhere(query('.part-a'));
    press(label, 'click');
    expect(host.touches).toBe(0);

    await nextTask();
    expect(host.touches).toBe(1);
    expect(host.control().focused()).toBe(false);
  });

  it('ends a press no click follows after the fallback delay', async () => {
    query<HTMLButtonElement>('.outside').focus();
    const label = query<HTMLElement>('.label-text');

    press(label, 'pointerdown');
    blurToNowhere(query('.part-a'));
    press(label, 'pointerup');
    await nextTask(100);
    expect(host.touches).toBe(0);

    await nextTask(500);
    expect(host.touches).toBe(1);
  });

  it('ends a press on pointercancel', async () => {
    query<HTMLButtonElement>('.outside').focus();
    const label = query<HTMLElement>('.label-text');

    press(label, 'pointerdown');
    blurToNowhere(query('.part-a'));
    press(label, 'pointercancel');
    await nextTask();

    expect(host.touches).toBe(1);
  });

  it('decides a focusout to a named element on the spot, even during a press', () => {
    query<HTMLInputElement>('.part-a').focus();
    press(query('.label-text'), 'pointerdown');

    query<HTMLButtonElement>('.outside').focus();

    expect(host.touches).toBe(1);
  });

  it('treats a container outside the host — a portaled pane — as part of the control', () => {
    const pane = document.createElement('div');
    const paneInput = document.createElement('input');
    pane.append(paneInput);
    document.body.append(pane);
    try {
      const into = new FocusEvent('focusout', { relatedTarget: paneInput });
      expect(host.control().leaves(into)).toBe(true);
      expect(host.control().leaves(into, pane)).toBe(false);
      expect(host.control().leaves(into, null, pane)).toBe(false);

      const elsewhere = new FocusEvent('focusout', {
        relatedTarget: query<HTMLButtonElement>('.outside'),
      });
      expect(host.control().leaves(elsewhere, pane)).toBe(true);
    } finally {
      pane.remove();
    }
  });
});

describe('MlvSignalFormUiControlBase — focus leaving through a container (#347)', () => {
  let fixture: ComponentFixture<PaneHost>;
  let host: PaneHost;
  let pane: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaneHost],
    }).compileComponents();
    fixture = TestBed.createComponent(PaneHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    // A pane portaled to <body>, outside the control's host.
    pane = document.createElement('div');
    pane.innerHTML = `
      <input class="pane-a" />
      <span class="pane-label">Label text</span>
      <input class="pane-b" />
    `;
    document.body.append(pane);
    host.control().panes = [pane];
  });

  afterEach(() => pane.remove());

  function part(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.part-a',
    ) as HTMLInputElement;
  }

  function inPane<T extends HTMLElement>(selector: string): T {
    return pane.querySelector(selector) as T;
  }

  function outside(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.outside',
    ) as HTMLButtonElement;
  }

  it('stays inside when focus moves from the host into the container and back', () => {
    part().focus();
    inPane<HTMLInputElement>('.pane-a').focus();
    inPane<HTMLInputElement>('.pane-b').focus();
    part().focus();

    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);
  });

  // The container's own `focusout` never reaches the host; the base hears it
  // on the document.
  it('touches once when focus leaves the container for anywhere else', () => {
    part().focus();
    inPane<HTMLInputElement>('.pane-a').focus();
    outside().focus();

    expect(host.touches).toBe(1);
    expect(host.control().focused()).toBe(false);
  });

  // A `focusout` inside the host also bubbles to the document: it is reported
  // once, by the host's own listener.
  it('touches once when focus leaves from the host itself', () => {
    part().focus();
    outside().focus();

    expect(host.touches).toBe(1);
  });

  it('touches once when a container overlaps the host', () => {
    const control = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-test-pane-composite',
    ) as HTMLElement;
    host.control().panes = [control, pane];
    part().focus();
    outside().focus();

    expect(host.touches).toBe(1);
  });

  it('defers the verdict for a press inside the container, as for one inside the host', async () => {
    const label = inPane<HTMLElement>('.pane-label');
    part().focus();
    inPane<HTMLInputElement>('.pane-a').focus();

    press(label, 'pointerdown');
    blurToNowhere(inPane('.pane-a'));
    expect(host.touches).toBe(0);

    press(label, 'click');
    inPane<HTMLInputElement>('.pane-b').focus();
    await nextTask();

    expect(host.touches).toBe(0);
    expect(host.control().focused()).toBe(true);
  });

  it('defers a press that moves focus to a focusable ancestor of the container', async () => {
    // An overlay wrapper that takes focus, around the pane but not the host.
    const wrapper = document.createElement('div');
    wrapper.tabIndex = -1;
    document.body.append(wrapper);
    wrapper.append(pane);
    try {
      const label = inPane<HTMLElement>('.pane-label');
      inPane<HTMLInputElement>('.pane-a').focus();

      press(label, 'pointerdown');
      wrapper.focus();
      expect(host.touches).toBe(0);

      press(label, 'click');
      inPane<HTMLInputElement>('.pane-b').focus();
      await nextTask();

      expect(host.touches).toBe(0);
    } finally {
      wrapper.remove();
    }
  });
});

// Under server rendering the injected DOCUMENT and the ambient global are
// different objects, and the global is defined, so binding the ambient one
// would attach a per-render control to a process-wide object no teardown
// reaches — and nothing would throw. Only asserting **which** object received
// a listener can see it.
describe('MlvSignalFormUiControlBase — focus-leave listeners and DOCUMENT (#347)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('binds a press to the injected DOCUMENT, not the ambient global, and releases it on destroy', async () => {
    const isolated = document.implementation.createHTMLDocument('control');
    await TestBed.configureTestingModule({
      imports: [CompositeHost],
      providers: [{ provide: DOCUMENT, useValue: isolated }],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompositeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);

    (root.querySelector('.part-a') as HTMLInputElement).focus();
    press(root.querySelector('.label-text') as HTMLElement, 'pointerdown');

    for (const type of ['click', 'pointerup', 'pointercancel']) {
      expect(`${type}: ${isolatedNet.get(type)}`).toBe(`${type}: 1`);
      expect(`${type}: ${ambientNet.get(type)}`).toBe(`${type}: undefined`);
    }

    // Destroyed mid-press, with a verdict pending: the press listeners go,
    // and the press's end reports nothing.
    blurToNowhere(root.querySelector('.part-a') as HTMLInputElement);
    const touches = (): number => fixture.componentInstance.touches;
    fixture.destroy();
    for (const type of ['click', 'pointerup', 'pointercancel']) {
      expect(`${type}: ${isolatedNet.get(type)}`).toBe(`${type}: 0`);
    }
    press(isolated, 'click');
    await nextTask();
    expect(touches()).toBe(0);
  });

  it('binds a container’s listeners to the injected DOCUMENT and releases them on destroy', async () => {
    const isolated = document.implementation.createHTMLDocument('control');
    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);
    await TestBed.configureTestingModule({
      imports: [PaneHost],
      providers: [{ provide: DOCUMENT, useValue: isolated }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaneHost);
    fixture.detectChanges();
    await fixture.whenStable();

    for (const type of ['pointerdown', 'focusout']) {
      expect(`${type}: ${isolatedNet.get(type)}`).toBe(`${type}: 1`);
      expect(`${type}: ${ambientNet.get(type)}`).toBe(`${type}: undefined`);
    }

    fixture.destroy();
    for (const type of ['pointerdown', 'focusout']) {
      expect(`${type}: ${isolatedNet.get(type)}`).toBe(`${type}: 0`);
    }
  });
});
