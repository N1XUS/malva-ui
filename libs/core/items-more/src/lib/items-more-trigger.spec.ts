import { TestBed } from '@angular/core/testing';
import type { ElementRef } from '@angular/core';
import { Component, computed, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvItemsMoreAccessor } from './items-more-token';
import { MLV_ITEMS_MORE } from './items-more-token';
import { MlvItemsMoreTrigger } from './items-more-trigger';

/** An accessor double that records what the trigger asked of it. */
class FakeRow implements MlvItemsMoreAccessor {
  readonly opened = signal(false);
  readonly hiddenItems = computed(() => []);
  readonly panelOpened = this.opened.asReadonly();
  readonly panelId = 'fake-panel';
  readonly toggles: HTMLElement[] = [];

  openPanel(): void {
    this.opened.set(true);
  }

  closePanel(): void {
    this.opened.set(false);
  }

  togglePanel(origin: ElementRef<HTMLElement>): void {
    this.toggles.push(origin.nativeElement);
    this.opened.update((open) => !open);
  }
}

@Component({
  imports: [MlvItemsMoreTrigger],
  template: `
    <button type="button" class="bare" mlvItemsMoreTrigger>Bare</button>
    <button type="button" class="bound" [mlvItemsMoreTrigger]="row">
      Bound
    </button>
  `,
})
class NoProviderHost {
  readonly row = new FakeRow();
}

@Component({
  imports: [MlvItemsMoreTrigger],
  providers: [{ provide: MLV_ITEMS_MORE, useFactory: () => new FakeRow() }],
  template: `<button type="button" class="injected" mlvItemsMoreTrigger>
    Injected
  </button>`,
})
class ProviderHost {}

describe('MlvItemsMoreTrigger', () => {
  it('carries no ARIA state when there is no row to drive', async () => {
    const fixture = TestBed.createComponent(NoProviderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const bare = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.bare');

    expect(bare?.hasAttribute('aria-expanded')).toBe(false);
    expect(bare?.hasAttribute('aria-controls')).toBe(false);
    // A click with nothing to drive is a no-op, not a throw.
    expect(() => bare?.click()).not.toThrow();
  });

  it('drives a row bound through the input, anchored on its own host', async () => {
    const fixture = TestBed.createComponent(NoProviderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const bound = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.bound');
    const row = fixture.componentInstance.row;

    expect(bound?.getAttribute('aria-expanded')).toBe('false');
    expect(bound?.hasAttribute('aria-controls')).toBe(false);

    bound?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(row.toggles).toEqual([bound]);
    expect(bound?.getAttribute('aria-expanded')).toBe('true');
    expect(bound?.getAttribute('aria-controls')).toBe('fake-panel');
  });

  it('falls back to the enclosing row when written bare', async () => {
    const fixture = TestBed.createComponent(ProviderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.injected');
    const row = fixture.debugElement.injector.get(MLV_ITEMS_MORE) as FakeRow;

    element?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(row.toggles).toEqual([element]);
    expect(element?.getAttribute('aria-expanded')).toBe('true');
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(NoProviderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
