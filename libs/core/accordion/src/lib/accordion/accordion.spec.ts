import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
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

@Component({
  template: `
    <mlv-accordion [multiExpandable]="true">
      <mlv-accordion-item [(expanded)]="richOpen">
        <span mlvAccordionHeader>
          <span aria-hidden="true">&#9679;</span>
          Documents
        </span>
        <p>Panel content</p>
        <a href="#deep">A control only reachable once expanded</a>
      </mlv-accordion-item>
    </mlv-accordion>
  `,
  imports: [MlvAccordion, MlvAccordionItem, MlvAccordionHeader],
})
class RichHeaderHost {
  readonly richOpen = signal(false);
}

/**
 * Accessibility sweeps.
 *
 * Every sweep is rooted at the fixture root — the `<mlv-accordion>` element and
 * everything under it — rather than at a trigger or a panel, because the
 * attributes that matter here span the pair: `aria-controls` on the trigger has
 * to resolve to the panel's `id`, and `aria-labelledby` on the panel back to
 * the trigger's. Rooting at either half evaluates neither link.
 *
 * The states are the ones that change the markup: all collapsed (the panel's
 * content is not rendered at all, since `ngAccordionContent` is deferred), one
 * expanded (content mounted, `inert` lifted), a disabled item (which is present
 * in both), and a rich `[mlvAccordionHeader]` header, where the trigger's
 * accessible name comes from projected markup instead of the `header` string.
 */
describe('MlvAccordion accessibility', () => {
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

  it('has no axe violations with every item collapsed', async () => {
    const t = triggers(fixture);
    // State: three collapsed triggers, the third disabled, no panel content.
    expect(t.map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
      'false',
    ]);
    expect(t[2].getAttribute('aria-disabled')).toBe('true');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations with a panel expanded', async () => {
    host.firstOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // State: the first panel's deferred content is mounted and its trigger
    // reports the expansion; the other two are still collapsed.
    const t = triggers(fixture);
    expect(t[0].getAttribute('aria-expanded')).toBe('true');
    const controlled = t[0].getAttribute('aria-controls') as string;
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(`#${controlled}`),
    ).toHaveLength(1);
    expect(panels(fixture)[0].textContent).toContain('First content');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations for a projected rich header, collapsed and expanded', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RichHeaderHost],
    }).compileComponents();
    const richFixture = TestBed.createComponent(RichHeaderHost);
    richFixture.detectChanges();
    await richFixture.whenStable();
    richFixture.detectChanges();
    const root = richFixture.nativeElement as HTMLElement;

    // State: the trigger is named by projected markup, not by `header`, and the
    // decorative glyph inside it is hidden — so the name is the text alone.
    const trigger = root.querySelector(
      '.mlv-accordion-item__trigger',
    ) as HTMLButtonElement;
    expect(trigger.textContent?.trim()).toContain('Documents');
    await expectNoAxeViolations(root);

    richFixture.componentInstance.richOpen.set(true);
    richFixture.detectChanges();
    await richFixture.whenStable();
    richFixture.detectChanges();

    expect(root.querySelector('a[href="#deep"]')).not.toBeNull();
    await expectNoAxeViolations(root);
  });
});
