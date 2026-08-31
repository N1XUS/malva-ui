import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { MlvAccordion } from './accordion';
import { MlvAccordionItem } from '../accordion-item/accordion-item';
import { MlvAccordionHeader } from '../accordion-item/accordion-header';

@Component({
  template: `
    <mlv-accordion [multiExpandable]="multi()" [softDisabled]="softDisabled()">
      <mlv-accordion-item header="One" [(expanded)]="firstOpen">
        First content
      </mlv-accordion-item>
      <mlv-accordion-item header="Two">Second content</mlv-accordion-item>
      <mlv-accordion-item header="Three" [disabled]="true">
        Third content
      </mlv-accordion-item>
    </mlv-accordion>
  `,
  imports: [MlvAccordion, MlvAccordionItem],
})
class HostComponent {
  readonly acc = viewChild.required(MlvAccordion);
  readonly multi = signal(true);
  readonly softDisabled = signal(true);
  readonly firstOpen = signal(false);
}

function triggers(
  fixture: ComponentFixture<HostComponent>,
): HTMLButtonElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.mlv-accordion-item__trigger',
    ),
  );
}

function panels(fixture: ComponentFixture<HostComponent>): HTMLElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLElement>(
      '.mlv-accordion-item__panel',
    ),
  );
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
}

describe('MlvAccordion', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders a trigger button per item with role="button"', () => {
    const t = triggers(fixture);
    expect(t.length).toBe(3);
    t.forEach((trigger) => expect(trigger.getAttribute('role')).toBe('button'));
  });

  it('wires aria-controls on the trigger to the panel id (region)', () => {
    const t = triggers(fixture);
    const p = panels(fixture);
    expect(p[0].getAttribute('role')).toBe('region');
    expect(t[0].getAttribute('aria-controls')).toBe(p[0].getAttribute('id'));
    // Panel is labelled by its trigger.
    expect(p[0].getAttribute('aria-labelledby')).toBe(t[0].getAttribute('id'));
  });

  it('starts collapsed: aria-expanded="false", panels inert, content not rendered', () => {
    const t = triggers(fixture);
    const p = panels(fixture);
    expect(t[0].getAttribute('aria-expanded')).toBe('false');
    expect(p[0].hasAttribute('inert')).toBe(true);
    // Lazy: mlv-expand is not instantiated until first expand.
    expect(p[0].querySelector('mlv-expand')).toBeNull();
  });

  it('expands on trigger click: aria-expanded true, content rendered, not inert', async () => {
    const t = triggers(fixture);
    const p = panels(fixture);
    t[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(t[0].getAttribute('aria-expanded')).toBe('true');
    expect(p[0].hasAttribute('inert')).toBe(false);
    expect(p[0].querySelector('mlv-expand')).not.toBeNull();
    expect(p[0].textContent).toContain('First content');
    // Two-way expanded model reflected back to the host.
    expect(host.firstOpen()).toBe(true);
  });

  it('reflects a host-driven expanded model into the aria trigger', async () => {
    host.firstOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const t = triggers(fixture);
    expect(t[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('single-expand mode collapses the previously open item', async () => {
    host.multi.set(false);
    fixture.detectChanges();
    const t = triggers(fixture);

    t[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[0].getAttribute('aria-expanded')).toBe('true');

    t[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[1].getAttribute('aria-expanded')).toBe('true');
    expect(t[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('multi-expand mode keeps multiple items open', async () => {
    const t = triggers(fixture);
    t[0].click();
    t[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[0].getAttribute('aria-expanded')).toBe('true');
    expect(t[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('marks a disabled item aria-disabled and does not expand it on click', async () => {
    const t = triggers(fixture);
    expect(t[2].getAttribute('aria-disabled')).toBe('true');
    t[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[2].getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps every header in the tab order (aria accordion is not roving)', () => {
    // The aria accordion pattern makes each focusable trigger Tab-reachable
    // (tabindex 0); Arrow keys provide additional navigation on top of Tab.
    const t = triggers(fixture);
    t.forEach((trigger) => expect(trigger.getAttribute('tabindex')).toBe('0'));
  });

  it('moves DOM focus to the next header with ArrowDown', () => {
    const t = triggers(fixture);
    t[0].focus();
    key(t[0], 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement).toBe(t[1]);
  });

  it('toggles the active item with Space / Enter on the group', async () => {
    const t = triggers(fixture);
    t[0].focus();
    key(t[0], ' ');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('expandAll / collapseAll operate through the component API', async () => {
    const t = triggers(fixture);
    host.acc().expandAll();
    fixture.detectChanges();
    await fixture.whenStable();
    // Two enabled items open (the disabled third is skipped).
    expect(t[0].getAttribute('aria-expanded')).toBe('true');
    expect(t[1].getAttribute('aria-expanded')).toBe('true');

    host.acc().collapseAll();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(t[0].getAttribute('aria-expanded')).toBe('false');
    expect(t[1].getAttribute('aria-expanded')).toBe('false');
  });
});

@Component({
  template: `
    <mlv-accordion>
      <mlv-accordion-item>
        <span mlvAccordionHeader class="rich-header">
          <em>Rich</em> header
        </span>
        Panel body
      </mlv-accordion-item>
    </mlv-accordion>
  `,
  imports: [MlvAccordion, MlvAccordionItem, MlvAccordionHeader],
})
class RichHeaderHostComponent {}

describe('MlvAccordionItem — rich header slot', () => {
  let fixture: ComponentFixture<RichHeaderHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichHeaderHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RichHeaderHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders projected mlvAccordionHeader content inside the trigger', () => {
    const trigger = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.mlv-accordion-item__trigger',
    );
    const rich = trigger?.querySelector('.rich-header');
    expect(rich).not.toBeNull();
    expect(rich?.querySelector('em')?.textContent).toBe('Rich');
    expect(trigger?.textContent).toContain('header');
  });
});
