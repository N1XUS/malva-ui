import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSwitch } from '@malva-ui/core/switch';
import axe from 'axe-core';
import type { MlvSwipeActionsHost } from '../swipe-actions-token';
import { MLV_SWIPE_ACTIONS } from '../swipe-actions-token';
import type { MlvSwipeActionTone } from './swipe-action';
import { MlvSwipeAction } from './swipe-action';

@Component({
  imports: [MlvSwipeAction],
  template: `
    <button mlvSwipeAction class="plain" [tone]="tone()">Plain</button>
    <button mlvSwipeAction class="typed" type="submit">Submit</button>
    <button mlvSwipeAction class="bare" appearance="plain">Bare</button>
    <span
      mlvSwipeAction
      class="span-host"
      appearance="plain"
      role="switch"
      tabindex="0"
      aria-checked="false"
    >
      Toggle
    </span>
  `,
})
class HostComponent {
  readonly tone = signal<MlvSwipeActionTone | undefined>(undefined);
}

@Component({
  imports: [MlvSwipeAction],
  providers: [{ provide: MLV_SWIPE_ACTIONS, useExisting: RowHostComponent }],
  template: `
    <button mlvSwipeAction class="closing">Delete</button>
    <button mlvSwipeAction class="staying" closeOnActivate="false">
      Toggle
    </button>
  `,
})
class RowHostComponent implements MlvSwipeActionsHost {
  closes = 0;

  close(): void {
    this.closes += 1;
  }
}

describe('MlvSwipeAction', () => {
  let fixture: ComponentFixture<HostComponent>;
  let plain: HTMLButtonElement;
  let typed: HTMLButtonElement;
  let bare: HTMLButtonElement;
  let spanHost: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    plain = fixture.nativeElement.querySelector('.plain');
    typed = fixture.nativeElement.querySelector('.typed');
    bare = fixture.nativeElement.querySelector('.bare');
    spanHost = fixture.nativeElement.querySelector('.span-host');
  });

  it('carries the BEM block class and the neutral tone by default', () => {
    expect(plain.classList.contains('mlv-swipe-action')).toBe(true);
    expect(plain.classList.contains('mlv-swipe-action--tone-neutral')).toBe(
      true,
    );
  });

  it('reflects each tone as a modifier class', async () => {
    for (const tone of [
      'accent',
      'info',
      'success',
      'warning',
      'danger',
      'neutral',
    ] as const) {
      fixture.componentInstance.tone.set(tone);
      fixture.detectChanges();
      await fixture.whenStable();

      const toneClasses = [...plain.classList].filter((name) =>
        name.startsWith('mlv-swipe-action--tone-'),
      );
      expect(toneClasses).toEqual([`mlv-swipe-action--tone-${tone}`]);
    }
  });

  it('is a filled block by default and chromeless when plain', () => {
    expect(plain.classList.contains('mlv-swipe-action--block')).toBe(true);
    expect(plain.classList.contains('mlv-swipe-action--plain')).toBe(false);

    expect(bare.classList.contains('mlv-swipe-action--plain')).toBe(true);
    expect(bare.classList.contains('mlv-swipe-action--block')).toBe(false);
  });

  it('defaults the native type to "button" so a row inside a form never submits it', () => {
    expect(plain.getAttribute('type')).toBe('button');
  });

  it('keeps an explicit native type', () => {
    expect(typed.getAttribute('type')).toBe('submit');
  });

  it('writes no native type onto a host that is not a button', () => {
    expect(spanHost.classList.contains('mlv-swipe-action')).toBe(true);
    expect(spanHost.hasAttribute('type')).toBe(false);
  });

  it('works standalone: activating it outside a swipe row is a plain click', () => {
    const seen: Event[] = [];
    plain.addEventListener('click', (event) => seen.push(event));

    plain.click();

    expect(seen).toHaveLength(1);
    expect(seen[0].defaultPrevented).toBe(false);
  });
});

describe('MlvSwipeAction inside a row', () => {
  let fixture: ComponentFixture<RowHostComponent>;
  let row: RowHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RowHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RowHostComponent);
    row = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('closes the row once activated', () => {
    (fixture.nativeElement.querySelector('.closing') as HTMLElement).click();

    expect(row.closes).toBe(1);
  });

  it('leaves the row open when closeOnActivate is false', () => {
    (fixture.nativeElement.querySelector('.staying') as HTMLElement).click();

    expect(row.closes).toBe(0);
  });
});

/**
 * The plain appearance on hosts that paint themselves — the two the docs
 * compose: an icon `button[mlvButton]` and an `mlv-switch` whose state lives
 * on the row.
 */
@Component({
  imports: [MlvSwipeAction, MlvButton, MlvSwitch],
  providers: [
    { provide: MLV_SWIPE_ACTIONS, useExisting: CompositionHostComponent },
  ],
  template: `
    <button
      mlvSwipeAction
      appearance="plain"
      mlvButton
      shape="circle"
      class="icon"
      aria-label="Delete"
    >
      x
    </button>
    <mlv-switch
      mlvSwipeAction
      appearance="plain"
      closeOnActivate="false"
      class="staying-switch"
      ariaLabel="Mute"
      [(checked)]="muted"
    />
    <mlv-switch
      mlvSwipeAction
      appearance="plain"
      class="closing-switch"
      ariaLabel="Archive"
    />
  `,
})
class CompositionHostComponent implements MlvSwipeActionsHost {
  readonly muted = signal(false);
  closes = 0;

  close(): void {
    this.closes += 1;
  }
}

describe('MlvSwipeAction on a self-painting host', () => {
  let fixture: ComponentFixture<CompositionHostComponent>;
  let row: CompositionHostComponent;
  let icon: HTMLButtonElement;
  let stayingSwitch: HTMLElement;
  let closingSwitch: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompositionHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompositionHostComponent);
    row = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    icon = fixture.nativeElement.querySelector('.icon');
    stayingSwitch = fixture.nativeElement.querySelector('.staying-switch');
    closingSwitch = fixture.nativeElement.querySelector('.closing-switch');
  });

  it('lets an mlvButton keep its chrome and still defaults the native type', () => {
    expect(icon.classList.contains('mlv-button')).toBe(true);
    expect(icon.classList.contains('mlv-swipe-action--plain')).toBe(true);
    expect(icon.classList.contains('mlv-swipe-action--block')).toBe(false);
    expect(icon.getAttribute('type')).toBe('button');

    icon.click();
    expect(row.closes).toBe(1);
  });

  it('toggles a switch host through its native input without closing the row', () => {
    const input = stayingSwitch.querySelector(
      'input[role="switch"]',
    ) as HTMLInputElement;
    input.click();
    fixture.detectChanges();

    expect(row.muted()).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('true');
    expect(row.closes).toBe(0);
    expect(stayingSwitch.hasAttribute('type')).toBe(false);
  });

  it('closes the row from a switch host that keeps the default closeOnActivate', () => {
    (
      closingSwitch.querySelector('input[role="switch"]') as HTMLInputElement
    ).click();

    expect(row.closes).toBe(1);
  });

  it('has no axe violations on the composed hosts', async () => {
    const results = await axe.run(fixture.nativeElement, {
      runOnly: {
        type: 'rule',
        values: ['button-name', 'nested-interactive', 'aria-allowed-attr'],
      },
    });
    expect(results.violations).toEqual([]);
  });
});
