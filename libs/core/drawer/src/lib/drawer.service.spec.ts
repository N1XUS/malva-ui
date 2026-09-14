import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvDrawerService } from './drawer.service';

@Component({
  selector: 'test-drawer-content',
  template: `
    <div class="mlv-scrollbar__viewport" tabindex="0">
      <input class="drawer-field" />
    </div>
  `,
})
class DrawerContentComponent {}

describe('MlvDrawerService', () => {
  let service: MlvDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvDrawerService);
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.mlv-drawer');
  }

  function finishClose(): void {
    panel()?.dispatchEvent(new Event('animationend'));
  }

  it('clamps a fixed size to the viewport', () => {
    const ref = service.open(DrawerContentComponent, { size: '36rem' });

    expect(panel()?.style.width).toBe('36rem');
    expect(panel()?.style.maxWidth).toBe('100dvw');
    expect(panel()?.style.maxHeight).toBe('100dvh');

    ref.close();
    finishClose();
  });

  it('folds a configured maxSize into the viewport clamp', () => {
    const ref = service.open(DrawerContentComponent, {
      position: 'bottom',
      size: '40rem',
      maxSize: '24rem',
    });

    expect(panel()?.style.height).toBe('40rem');
    expect(panel()?.style.maxHeight).toBe('min(24rem, 100dvh)');
    expect(panel()?.style.maxWidth).toBe('100dvw');

    ref.close();
    finishClose();
  });

  it('focuses content past the scroll viewport rather than the viewport itself', async () => {
    const ref = service.open(DrawerContentComponent);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(
      document.querySelector('.drawer-field'),
    );

    ref.close();
    finishClose();
  });

  describe('animationend target', () => {
    /**
     * A bubbling `animationend`, the way a finished CSS animation dispatches
     * one. A plain `Event`: jsdom implements neither `AnimationEvent` nor CSS
     * animations, and the listener under test reads only `target`.
     */
    function animationEnd(): Event {
      return new Event('animationend', { bubbles: true });
    }

    /** Drawer panes attached to the live CDK overlay container right now. */
    function attachedPanes(): NodeListOf<HTMLElement> {
      return TestBed.inject(OverlayContainer)
        .getContainerElement()
        .querySelectorAll<HTMLElement>('.mlv-drawer');
    }

    it("ignores an animationend bubbling out of its content during the leave, then disposes on the pane's own at once", () => {
      const ref = service.open(DrawerContentComponent);
      expect(attachedPanes()).toHaveLength(1);
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      // Synchronous from here on, well inside MlvDrawerRef's 350ms fallback.
      const child = attachedPanes()[0].querySelector('.drawer-field');
      expect(child).not.toBeNull();
      child?.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(1);
      expect(closed).toBe(false);

      // …and the pane's own leave still disposes at once. A `once: true`
      // listener spent on the ignored event above would leave the close to the
      // 350ms fallback, which cannot fire inside this synchronous test.
      attachedPanes()[0].dispatchEvent(animationEnd());
      expect(attachedPanes()).toHaveLength(0);
      expect(closed).toBe(true);
    });

    it('disposes the drawer for an animationend raised by the pane itself', () => {
      const ref = service.open(DrawerContentComponent);
      const pane = attachedPanes()[0];
      let closed = false;
      ref.afterClosed().subscribe(() => (closed = true));

      ref.close();
      pane.dispatchEvent(animationEnd());

      expect(attachedPanes()).toHaveLength(0);
      expect(closed).toBe(true);
    });
  });
});
