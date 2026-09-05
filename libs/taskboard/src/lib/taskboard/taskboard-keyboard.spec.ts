import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { MlvTaskboardMoveCancelledEvent } from '../taskboard.types';
import { MlvTaskboard } from './taskboard';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const INITIAL_ITEMS: readonly Ticket[] = [
  { id: 'a', status: 'todo' },
  { id: 'b', status: 'todo' },
  { id: 'x', status: 'done' },
];

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    [dir]="direction()"
    dataKey="id"
    columnField="status"
    (moveCancelled)="cancellations.push($event)"
  />`,
})
class KeyboardHost {
  readonly items = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly columns = [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done' },
  ];
  readonly direction = signal('ltr');
  readonly cancellations: MlvTaskboardMoveCancelledEvent<Ticket>[] = [];
  readonly board = viewChild.required(MlvTaskboard<Ticket>);
}

describe('MlvTaskboard keyboard interaction', () => {
  let rtlService: MlvRtlService;

  async function mount() {
    await TestBed.configureTestingModule({
      imports: [KeyboardHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    rtlService = TestBed.inject(MlvRtlService);
    const fixture = TestBed.createComponent(KeyboardHost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const card = (id: string) =>
      host.querySelector(
        `[data-mlv-taskboard-card-id="string:${id}"]`,
      ) as HTMLElement;
    const key = (id: string, value: string) => {
      card(id).dispatchEvent(
        new KeyboardEvent('keydown', { key: value, bubbles: true }),
      );
      fixture.detectChanges();
    };
    const focus = (id: string) => {
      card(id).dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
    };
    const live = () =>
      host.querySelector('.mlv-taskboard__live-region')?.textContent?.trim() ??
      '';
    return { fixture, host, card, key, focus, live };
  }

  afterEach(() => rtlService.setDirection('ltr'));

  it('gives exactly one card the board tab stop', async () => {
    const { host, card } = await mount();

    expect(card('a').getAttribute('tabindex')).toBe('0');
    expect(card('b').getAttribute('tabindex')).toBe('-1');
    expect(
      [...host.querySelectorAll('[data-mlv-taskboard-card-id]')].filter(
        (element) => element.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);
  });

  it('describes every card with the shared keyboard instructions', async () => {
    const { host, card } = await mount();

    const describedBy = card('a').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(
      host.querySelector(`#${describedBy}`)?.textContent?.trim(),
    ).toContain('Press Space to pick up a card');
  });

  it('moves the roving focus down a cell and across to the next column', async () => {
    const { card, key, focus } = await mount();

    focus('a');
    key('a', 'ArrowDown');
    expect(card('b').getAttribute('tabindex')).toBe('0');

    key('b', 'ArrowUp');
    key('a', 'ArrowRight');
    expect(card('x').getAttribute('tabindex')).toBe('0');
  });

  it('mirrors the horizontal arrows and keeps the vertical ones in RTL', async () => {
    const { card, key, focus, fixture } = await mount();
    rtlService.setDirection('rtl');
    fixture.componentInstance.direction.set('rtl');
    fixture.detectChanges();

    focus('a');
    key('a', 'ArrowLeft');
    expect(card('x').getAttribute('tabindex')).toBe('0');

    key('x', 'ArrowDown');
    expect(card('x').getAttribute('tabindex')).toBe('0');
  });

  it('grabs, aims, and commits a move through the shared pipeline', async () => {
    const { fixture, key, focus, live } = await mount();

    focus('a');
    key('a', ' ');
    expect(live()).toContain('Grabbed a');

    key('a', 'ArrowRight');
    expect(live()).toBe('Move to Done, position 1 of 2.');

    key('a', ' ');
    await fixture.whenStable();
    expect(
      fixture.componentInstance.items().find((item) => item.id === 'a')?.status,
    ).toBe('done');
    expect(live()).toBe('Moved a to Done, position 1.');
  });

  it('cancels a grab on Escape without changing the controlled items', async () => {
    const { fixture, key, focus, live } = await mount();
    const before = fixture.componentInstance.items();

    focus('a');
    key('a', ' ');
    key('a', 'ArrowRight');
    key('a', 'Escape');

    expect(fixture.componentInstance.items()).toBe(before);
    expect(
      fixture.componentInstance.cancellations.map((event) => event.reason),
    ).toEqual(['cancelled']);
    expect(live()).toBe('Cancelled moving a.');
  });

  it('cancels a grab the user blurs away from', async () => {
    const { fixture, card, key, focus, live } = await mount();

    focus('a');
    key('a', ' ');
    card('a').dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(
      fixture.componentInstance.cancellations.map((event) => event.reason),
    ).toEqual(['cancelled']);
    expect(live()).toBe('Cancelled moving a.');
  });

  it('activates the focused card on Enter and never while it is grabbed', async () => {
    const { fixture, key, focus } = await mount();
    const activated: string[] = [];
    fixture.componentInstance
      .board()
      .cardActivated.subscribe((event) => activated.push(event.item.id));

    focus('a');
    key('a', 'Enter');
    key('a', ' ');
    key('a', 'Enter');

    expect(activated).toEqual(['a']);
  });

  it('announces a slot the board refuses and keeps the card in hand', async () => {
    await TestBed.configureTestingModule({
      imports: [LockedHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    rtlService = TestBed.inject(MlvRtlService);
    const fixture = TestBed.createComponent(LockedHost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const card = host.querySelector(
      '[data-mlv-taskboard-card-id="string:a"]',
    ) as HTMLElement;
    const live = () =>
      host.querySelector('.mlv-taskboard__live-region')?.textContent?.trim() ??
      '';

    card.dispatchEvent(new FocusEvent('focus'));
    card.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    card.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(live()).toBe(
      'Cannot move to Done: the work-in-progress limit is reached.',
    );

    card.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.items()[0]?.status).toBe('todo');
    expect(live()).toBe(
      'a was not moved: the work-in-progress limit is reached.',
    );
  });
});

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns"
    dataKey="id"
    columnField="status"
  />`,
})
class LockedHost {
  readonly items = signal<readonly Ticket[]>([
    { id: 'a', status: 'todo' },
    { id: 'x', status: 'done' },
  ]);
  readonly columns = [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done', wipLimit: 1 },
  ];
}
