import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvHint } from './hint';
import { MlvLabel } from '../label/label';

// ---------------------------------------------------------------------------
// Host components
// ---------------------------------------------------------------------------

/** Static projected text, the documented content-projection API. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvHint],
  template: `<mlv-hint>Sent to your phone</mlv-hint>`,
})
class StaticHostComponent {}

/** Interpolated text, the shape every `hint`-input control renders. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvHint],
  template: `<mlv-hint>{{ hint() }}</mlv-hint>`,
})
class InterpolatedHostComponent {
  readonly hint = signal('Shown on every audit entry');
}

/** Empty hint — the degenerate case that must not leave a nameless button. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvHint],
  template: `<mlv-hint>{{ hint() }}</mlv-hint>`,
})
class EmptyHostComponent {
  readonly hint = signal('');
}

/** The real composition: a hint nested inside the label of a control. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvHint, MlvLabel],
  template: `
    <mlv-label for="full-name">
      Full name
      <mlv-hint>Shown on every comment</mlv-hint>
    </mlv-label>
    <input id="full-name" />
  `,
})
class LabelledHostComponent {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createFixture<T>(
  type: new () => T,
): Promise<ComponentFixture<T>> {
  TestBed.configureTestingModule({
    imports: [type as never],
    providers: [provideMlvI18nTesting()],
  });

  const fixture = TestBed.createComponent(type);
  // Two passes around `whenStable`: the trigger only exists once the
  // `afterNextRender` hook has read the projected text into `_text`.
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function getTrigger(
  fixture: ComponentFixture<unknown>,
): HTMLButtonElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector(
    'button.mlv-hint__trigger',
  );
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('MlvHint', () => {
  describe('icon trigger', () => {
    let fixture: ComponentFixture<StaticHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(StaticHostComponent);
    });

    it('renders an icon trigger instead of inline text', () => {
      const trigger = getTrigger(fixture);
      expect(trigger).not.toBeNull();
      expect(trigger?.querySelector('svg')).not.toBeNull();
    });

    it('renders the trigger as type="button" so it never submits a form', () => {
      expect(getTrigger(fixture)?.getAttribute('type')).toBe('button');
    });

    it('names the trigger with the projected text', () => {
      expect(getTrigger(fixture)?.getAttribute('aria-label')).toBe(
        'Sent to your phone',
      );
    });

    it('hides the projected source from assistive tech', () => {
      const source = (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-hint__source',
      );
      expect(source?.getAttribute('aria-hidden')).toBe('true');
      // Still present in the DOM — it is the string's only source.
      expect(source?.textContent?.trim()).toBe('Sent to your phone');
    });

    it('marks the icon itself aria-hidden so it adds no second name', () => {
      expect(
        getTrigger(fixture)?.querySelector('svg')?.getAttribute('aria-hidden'),
      ).toBe('true');
    });
  });

  describe('tooltip', () => {
    it('binds the projected text as the tooltip and shows it on hover', async () => {
      const fixture = await createFixture(StaticHostComponent);
      const trigger = getTrigger(fixture) as HTMLButtonElement;

      trigger.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 350));
      fixture.detectChanges();

      const panel = document.querySelector('.mlv-tooltip');
      expect(panel?.textContent).toContain('Sent to your phone');
      // The text is already the trigger's accessible name (`aria-label`), so
      // the tooltip adds no description that would only repeat it (#321).
      expect(trigger.hasAttribute('aria-describedby')).toBe(false);

      trigger.dispatchEvent(new MouseEvent('mouseleave'));
      fixture.detectChanges();
      fixture.destroy();
    });

    it('renders no trigger — and therefore no tooltip — when the content is empty', async () => {
      const fixture = await createFixture(EmptyHostComponent);
      expect(getTrigger(fixture)).toBeNull();
    });
  });

  describe('interpolated content', () => {
    it('picks up the initial interpolated value', async () => {
      const fixture = await createFixture(InterpolatedHostComponent);
      expect(getTrigger(fixture)?.getAttribute('aria-label')).toBe(
        'Shown on every audit entry',
      );
    });

    it('stays in sync when the interpolated value changes at runtime', async () => {
      const fixture = await createFixture(InterpolatedHostComponent);
      fixture.componentInstance.hint.set('Only visible to admins');
      fixture.detectChanges();
      // The MutationObserver callback lands as a microtask.
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getTrigger(fixture)?.getAttribute('aria-label')).toBe(
        'Only visible to admins',
      );
    });

    it('drops the trigger when the interpolated value becomes empty', async () => {
      const fixture = await createFixture(InterpolatedHostComponent);
      expect(getTrigger(fixture)).not.toBeNull();

      fixture.componentInstance.hint.set('');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getTrigger(fixture)).toBeNull();
    });
  });

  describe('inside a label', () => {
    let fixture: ComponentFixture<LabelledHostComponent>;

    beforeEach(async () => {
      fixture = await createFixture(LabelledHostComponent);
    });

    it('does not propagate the trigger click to the enclosing label', () => {
      const label = (fixture.nativeElement as HTMLElement).querySelector(
        'label',
      ) as HTMLLabelElement;
      let labelClicks = 0;
      label.addEventListener('click', () => labelClicks++);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      getTrigger(fixture)?.dispatchEvent(event);

      expect(labelClicks).toBe(0);
      expect(event.defaultPrevented).toBe(true);
    });

    it('keeps the hint out of the label element the control is named by', () => {
      const label = (fixture.nativeElement as HTMLElement).querySelector(
        'label',
      ) as HTMLLabelElement;
      // The source span is `display: none` + `aria-hidden`, so the accessible
      // name computation stops at the label text — but the trigger carries the
      // hint as its own `aria-label` so the information is still reachable.
      expect(
        label.querySelector('.mlv-hint__source')?.getAttribute('aria-hidden'),
      ).toBe('true');
      expect(getTrigger(fixture)?.getAttribute('aria-label')).toBe(
        'Shown on every comment',
      );
    });
  });
});
