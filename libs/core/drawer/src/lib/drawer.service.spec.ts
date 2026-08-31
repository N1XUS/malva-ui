import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
});
