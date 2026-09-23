import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvList } from '../list/list';
import { MlvListItem } from './list-item';
import type { MlvListItemAccent } from './list-item';
import { MlvListItemActions } from '../list-item-actions';
import { MlvListItemByline } from '../list-item-byline';
import { MlvListItemMedia } from '../list-item-media';
import { MlvListItemTitle } from '../list-item-title';
import { MlvListItemPrefix } from '../list-item-prefix';

@Component({
  imports: [
    MlvList,
    MlvListItem,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItemMedia,
    MlvListItemTitle,
  ],
  template: `
    <mlv-list>
      <mlv-list-item>
        <span mlvListItemMedia class="test-media">M</span>
        <span mlvListItemTitle>The Odyssey</span>
        <span mlvListItemByline>Explore unknown galaxies.</span>
        <button
          mlvListItemActions
          type="button"
          class="test-action"
          (click)="handleActionClick()"
        >
          Get
        </button>
      </mlv-list-item>
    </mlv-list>
  `,
})
class TestListItemHostComponent {
  readonly actionClicks = signal(0);

  handleActionClick(): void {
    this.actionClicks.update((value) => value + 1);
  }
}

@Component({
  imports: [MlvListItem, MlvListItemPrefix],
  template: `
    <mlv-list-item>
      <span mlvListItemPrefix data-prefix>+</span>
      Edit
    </mlv-list-item>
  `,
})
class PrefixListItemHostComponent {}

describe('MlvListItem', () => {
  let fixture: ComponentFixture<TestListItemHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListItemHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestListItemHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render rich slots into the structured layout', () => {
    const item = fixture.nativeElement.querySelector(
      'mlv-list-item',
    ) as HTMLElement;

    expect(item.classList.contains('mlv-list-item--rich')).toBe(true);
    expect(
      item.querySelector('.mlv-list-item__media')?.textContent?.trim(),
    ).toBe('M');
    expect(
      item.querySelector('.mlv-list-item__title')?.textContent?.trim(),
    ).toBe('The Odyssey');
    expect(
      item.querySelector('.mlv-list-item__byline')?.textContent?.trim(),
    ).toBe('Explore unknown galaxies.');
    expect(
      item.querySelector('.mlv-list-item__actions button')?.textContent?.trim(),
    ).toBe('Get');
  });

  it('should wrap rendered row content in an inner surface', () => {
    const item = fixture.nativeElement.querySelector(
      'mlv-list-item',
    ) as HTMLElement;
    const surface = item.querySelector('.mlv-list-item__surface');

    expect(surface).toBeTruthy();
    expect(
      surface?.querySelector('.mlv-list-item__title')?.textContent?.trim(),
    ).toBe('The Odyssey');
  });

  it('should render the legacy prefix slot', () => {
    const prefixFixture = TestBed.createComponent(PrefixListItemHostComponent);
    prefixFixture.detectChanges();

    expect(
      prefixFixture.nativeElement.querySelector('[data-prefix]'),
    ).toBeTruthy();
  });
});

@Component({
  imports: [MlvListItem],
  template: `<mlv-list-item [accent]="accent()">Row</mlv-list-item>`,
})
class AccentListItemHostComponent {
  readonly accent = signal<MlvListItemAccent | undefined>(undefined);
}

describe('MlvListItem accent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccentListItemHostComponent],
    }).compileComponents();
  });

  function accentFor(accent: MlvListItemAccent): string {
    const fixture = TestBed.createComponent(AccentListItemHostComponent);
    fixture.componentInstance.accent.set(accent);
    fixture.detectChanges();
    const item = fixture.nativeElement.querySelector(
      'mlv-list-item',
    ) as HTMLElement;
    return item.style.getPropertyValue('--mlv-list-item-accent').trim();
  }

  it('paints a neutral accent with a resting token, never a pressed `-active` one', () => {
    // SF-R1: `-active` means "the pointer is down right now"; an accent bar is
    // persistent.
    expect(accentFor('neutral')).toBe('var(--mlv-border-normal)');
  });

  it.each([
    ['success', 'var(--mlv-background-success-1)'],
    ['danger', 'var(--mlv-background-danger-1)'],
    ['info', 'var(--mlv-background-info-1)'],
    ['warning', 'var(--mlv-background-warning-1)'],
  ] as const)(
    'resolves the MlvTone value %s to its semantic fill',
    (accent, expected) => {
      expect(accentFor(accent)).toBe(expected);
    },
  );

  it.each([
    ['primary', 'var(--mlv-background-accent-1)'],
    ['positive', 'var(--mlv-background-success-1)'],
    ['negative', 'var(--mlv-background-danger-1)'],
  ] as const)('keeps resolving the list key %s', (accent, expected) => {
    expect(accentFor(accent)).toBe(expected);
  });

  it('passes any other string through as a raw colour', () => {
    expect(accentFor('#ff00aa')).toBe('#ff00aa');
  });
});
