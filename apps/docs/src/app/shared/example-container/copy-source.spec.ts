import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { CopySourceComponent } from './copy-source';

describe('CopySourceComponent', () => {
  const createFixture = (copy = vi.fn().mockReturnValue(true)) => {
    const fixture = TestBed.configureTestingModule({
      imports: [CopySourceComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: Clipboard, useValue: { copy } },
      ],
    }).createComponent(CopySourceComponent);
    fixture.componentRef.setInput('value', 'const ready = true;');
    fixture.componentRef.setInput('label', 'Copy TypeScript');
    fixture.detectChanges();
    return { fixture, copy };
  };

  const buttonOf = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  it('is a real button carrying the accessible name, so it stays keyboard reachable', async () => {
    const { fixture } = createFixture();
    await fixture.whenStable();

    const button = buttonOf(fixture);
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-label')).toBe('Copy TypeScript');
    // Hover-only visibility is a pointer affordance; the control must never be
    // removed from the tab order to achieve it.
    expect(button.getAttribute('tabindex')).toBeNull();
    expect(button.disabled).toBe(false);
  });

  it('writes the value to the clipboard and confirms it', async () => {
    const { fixture, copy } = createFixture();
    await fixture.whenStable();

    buttonOf(fixture).click();
    await fixture.whenStable();

    expect(copy).toHaveBeenCalledWith('const ready = true;');
    expect(fixture.componentInstance.copied()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-copy-state="copied"]'),
    ).not.toBeNull();
  });

  it('announces the confirmation politely rather than only by icon', async () => {
    const { fixture } = createFixture();
    await fixture.whenStable();

    buttonOf(fixture).click();
    await fixture.whenStable();

    const live = fixture.nativeElement.querySelector(
      '[aria-live="polite"]',
    ) as HTMLElement;
    expect(live.textContent?.trim()).not.toBe('');
  });

  it('reverts to the idle icon once the confirmation window elapses', async () => {
    vi.useFakeTimers();
    try {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('copiedDuration', 1000);
      fixture.detectChanges();

      buttonOf(fixture).click();
      expect(fixture.componentInstance.copied()).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(fixture.componentInstance.copied()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays idle when the clipboard write is refused', async () => {
    const { fixture } = createFixture(vi.fn().mockReturnValue(false));
    await fixture.whenStable();

    buttonOf(fixture).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.copied()).toBe(false);
  });
});
