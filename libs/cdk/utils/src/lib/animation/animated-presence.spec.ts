import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvAnimatedPresence } from './animated-presence';

@Component({
  imports: [MlvAnimatedPresence],
  template: `<div *mlvAnimatedPresence="show()" class="target">content</div>`,
})
class TestHostComponent {
  show = signal(false);
}

@Component({
  imports: [MlvAnimatedPresence],
  template: `
    <div
      *mlvAnimatedPresence="
        show();
        enterClass: 'custom-enter';
        leaveClass: 'custom-leave'
      "
      class="target"
    >
      content
    </div>
  `,
})
class CustomClassHostComponent {
  show = signal(false);
}

/** A presence root holding its own animated content, as a real card or panel does. */
@Component({
  imports: [MlvAnimatedPresence],
  template: `
    <div *mlvAnimatedPresence="show()" class="target">
      <span class="child">content</span>
    </div>
  `,
})
class NestedContentHostComponent {
  show = signal(false);
}

/**
 * A bubbling `animationend`, the way a finished CSS animation dispatches one.
 * A plain `Event`: jsdom implements neither `AnimationEvent` nor CSS
 * animations, and the listeners under test read only `target`.
 */
function animationEnd(): Event {
  return new Event('animationend', { bubbles: true });
}

describe('MlvAnimatedPresence', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        CustomClassHostComponent,
        NestedContentHostComponent,
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when condition is false', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should render when condition is true', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should add enter class when mounting', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.target.mlv-presence--enter'),
    ).toBeTruthy();
  });

  it('should add leave class when unmounting before rAF fires', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Before rAF fires, element is still present with leave class
    const el = fixture.nativeElement.querySelector('.target');
    expect(el).toBeTruthy();
    expect(el.classList.contains('mlv-presence--leave')).toBeTruthy();
  });

  it('should remove element after rAF fires (no animation in jsdom)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Run the requestAnimationFrame callback
    vi.runAllTimers();

    // In jsdom, getComputedStyle returns animationName 'none', so element is destroyed immediately
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should cancel leave when re-entering before rAF fires', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    // Begin leave
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Re-enter before rAF fires (leavePending = true, rAF pending)
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    vi.runAllTimers();

    // View should still be present
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should use custom enter class', () => {
    const fixture = TestBed.createComponent(CustomClassHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.target.custom-enter'),
    ).toBeTruthy();
  });

  it('should remove element with custom leave class after rAF fires', () => {
    const fixture = TestBed.createComponent(CustomClassHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    vi.runAllTimers();

    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should mount only once when condition stays true', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    fixture.detectChanges();

    const targets = fixture.nativeElement.querySelectorAll('.target');
    expect(targets.length).toBe(1);
  });

  it('should not render when toggled off after rAF', () => {
    const fixture = TestBed.createComponent(TestHostComponent);

    // Mount
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    vi.runAllTimers();

    // Unmount
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    vi.runAllTimers();

    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  describe('animationend target', () => {
    beforeEach(() => {
      // jsdom runs no CSS animations, so `animationName` reads '' and both
      // paths would skip their listener entirely. Report a running animation
      // on the presence root — the state a real stylesheet produces — and
      // leave every other element to the real implementation.
      const realGetComputedStyle = globalThis.getComputedStyle.bind(
        globalThis,
      ) as typeof getComputedStyle;
      vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(((
        ...args: Parameters<typeof getComputedStyle>
      ) => {
        const declaration = realGetComputedStyle(...args);
        if (!args[0].classList.contains('target')) return declaration;
        return new Proxy(declaration, {
          get: (target, prop) =>
            prop === 'animationName'
              ? 'mlv-presence-running'
              : Reflect.get(target, prop),
        });
      }) as typeof getComputedStyle);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Mounts the root and runs the enter rAF, which arms the enter listener. */
    function mount() {
      const fixture = TestBed.createComponent(NestedContentHostComponent);
      fixture.componentInstance.show.set(true);
      fixture.detectChanges();
      vi.runAllTimers();
      const root = fixture.nativeElement.querySelector(
        '.target',
      ) as HTMLElement;
      const child = root.querySelector('.child') as HTMLElement;
      return { fixture, root, child };
    }

    it("keeps the enter class through a descendant animationend, then clears it on the root's own", () => {
      const { root, child } = mount();
      expect(root.classList.contains('mlv-presence--enter')).toBe(true);

      // Projected content finishing its own finite animation mid-enter (#231).
      child.dispatchEvent(animationEnd());
      expect(root.classList.contains('mlv-presence--enter')).toBe(true);

      // A `once: true` listener would have been spent above and latch the
      // class; the root's own keyframes must still clear it.
      root.dispatchEvent(animationEnd());
      expect(root.classList.contains('mlv-presence--enter')).toBe(false);
    });

    it("keeps the view mounted through a descendant animationend during the leave, then destroys it on the root's own", () => {
      const { fixture, root, child } = mount();
      root.dispatchEvent(animationEnd()); // finish the enter

      fixture.componentInstance.show.set(false);
      fixture.detectChanges();
      vi.runAllTimers(); // the leave rAF arms the leave listener
      expect(root.classList.contains('mlv-presence--leave')).toBe(true);

      child.dispatchEvent(animationEnd());
      expect(fixture.nativeElement.querySelector('.target')).not.toBeNull();

      root.dispatchEvent(animationEnd());
      expect(fixture.nativeElement.querySelector('.target')).toBeNull();
    });
  });
});

describe('MlvAnimatedPresence — server platform', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    // Node defines neither. Angular's own scheduler checks for them before
    // use; the directive must not reach for them at all.
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('getComputedStyle', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * The directive's `effect()` is a view effect, so it runs during server
   * change detection. It used to add the enter class there — serialized into
   * the payload — and then call the ambient `requestAnimationFrame`, which
   * Node does not define, so every server render threw. Now the server ships
   * the view in its final state; the hydrating client adds the enter class to
   * the claimed view once (measured with a hydration round trip during #337;
   * skipping it for a claimed view is a follow-up).
   */
  it('renders the view in its final state, without the enter class', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    const target: HTMLElement | null =
      fixture.nativeElement.querySelector('.target');
    expect(target?.className).toBe('target');
  });

  it('removes the view at once on leave, with no leave class', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });
});
