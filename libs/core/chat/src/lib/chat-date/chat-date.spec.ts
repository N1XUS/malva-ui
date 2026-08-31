import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatDate } from './chat-date';

function setup(date: Date): HTMLElement {
  const fixture = TestBed.createComponent(MlvChatDate);
  fixture.componentRef.setInput('date', date);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0, 0);
}

describe('MlvChatDate', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('renders Today for the current day', () => {
    expect(setup(daysAgo(0)).textContent?.trim()).toBe('Today');
  });

  it('renders Yesterday for the previous day', () => {
    expect(setup(daysAgo(1)).textContent?.trim()).toBe('Yesterday');
  });

  it('renders a formatted date for older days', () => {
    const text = setup(new Date(2024, 0, 15, 12)).textContent?.trim();
    expect(text).not.toBe('Today');
    expect(text).not.toBe('Yesterday');
    expect(text).toContain('2024');
  });
});
