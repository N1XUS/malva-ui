import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MockInstance } from 'vitest';
import { MlvSelect } from './select';

/**
 * #360 — a select destroyed with its dropdown open closes the overlay from its
 * `mlv-popup-container`'s `ngOnDestroy`. Container and popup share the
 * select's view, so Angular runs that close before the popup's outputs are
 * destroyed: no NG0953 was ever printed here, and the select's own bindings
 * to the popup — `[(opened)]="isOpen"` and `(afterClosed)="_onPopupClosed()"`
 * — still run during teardown.
 *
 * This is the shape every container-built control shares, and the one a guard
 * keyed on the view's `DestroyRef.destroyed` would break without a warning: it
 * is `true` during that `ngOnDestroy` pass, so it would skip both writes. The
 * spec pins the two neutral effects of them — the open flag and the search
 * query reset — not the focus restore and touched handling a teardown close
 * also reaches, which are an open question of their own.
 */

function ng0953(spy: MockInstance<typeof console.warn>): string[] {
  return spy.mock.calls
    .map((args) => String(args[0]))
    .filter((message) => message.includes('NG0953'));
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

@Component({
  imports: [MlvSelect],
  template: `
    @if (show()) {
      <mlv-select ariaLabel="Fruit" searchable [options]="options" />
    }
  `,
})
class DestroyHost {
  readonly show = signal(true);
  readonly options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Pear', value: 'pear' },
  ];
  readonly select = viewChild(MlvSelect);
}

describe('mlv-select — destroyed with the dropdown open (#360)', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    warn = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    warn.mockRestore();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('still runs its own close handling, warns nothing and removes the pane', async () => {
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const fixture = TestBed.createComponent(DestroyHost);
    await settle(fixture);
    const select = fixture.componentInstance.select();
    expect(select).toBeDefined();
    select?.openDropdown();
    await settle(fixture);
    select?.searchQuery.set('ap');
    await settle(fixture);
    expect(select?.isOpen()).toBe(true);
    expect(select?.searchQuery()).toBe('ap');
    expect(overlay.querySelectorAll('.cdk-overlay-pane').length).toBe(1);

    fixture.componentInstance.show.set(false);
    await settle(fixture);

    // `[(opened)]` wrote `isOpen` back, and `(afterClosed)` reset the query.
    expect(select?.isOpen()).toBe(false);
    expect(select?.searchQuery()).toBe('');
    expect(ng0953(warn)).toEqual([]);
    expect(overlay.querySelectorAll('.cdk-overlay-pane').length).toBe(0);
  });
});
