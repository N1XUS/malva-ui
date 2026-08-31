import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import PageEndPaneExampleComponent from './index';

class FakeBreakpointService {
  private readonly _down = signal<Record<MlvBreakpoint, boolean>>({
    sm: false,
    md: false,
    lg: false,
  });

  isDown(breakpoint: MlvBreakpoint) {
    return computed(() => this._down()[breakpoint]);
  }

  setDown(breakpoint: MlvBreakpoint, down: boolean): void {
    this._down.update((value) => ({ ...value, [breakpoint]: down }));
  }
}

describe('PageEndPaneExampleComponent', () => {
  const setup = () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PageEndPaneExampleComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).createComponent(PageEndPaneExampleComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    const breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    const trigger = fixture.nativeElement.querySelector(
      'button[aria-controls^="mlv-page-end-pane-"]',
    ) as HTMLButtonElement;

    return { fixture, breakpoint, trigger };
  };

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('opens and closes the inline details pane through rendered controls', () => {
    const { fixture, trigger } = setup();

    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('aside')).not.toBeNull();
    expect(
      document.querySelectorAll('.page-end-pane-example__details'),
    ).toHaveLength(1);

    const close = fixture.nativeElement.querySelector(
      '.page-end-pane-example__details button',
    ) as HTMLButtonElement;
    close.click();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('aside')).toBeNull();
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('crosses lg and dismisses the compact Drawer through Escape and backdrop', () => {
    const { fixture, breakpoint, trigger } = setup();

    trigger.click();
    fixture.detectChanges();
    breakpoint.setDown('lg', true);
    fixture.detectChanges();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.querySelectorAll('.page-end-pane-example__details'),
    ).toHaveLength(1);

    document.querySelector('.mlv-drawer')?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
    document
      .querySelector('.mlv-drawer')
      ?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    fixture.detectChanges();
    document.querySelector<HTMLElement>('.mlv-drawer-backdrop')?.click();
    fixture.detectChanges();
    document
      .querySelector('.mlv-drawer')
      ?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
