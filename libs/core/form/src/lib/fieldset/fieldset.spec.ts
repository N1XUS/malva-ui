import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvFieldset } from './fieldset';
import { MlvForm } from '../form/form';
import type { MlvFieldsetColumns, MlvFormGap } from '../form.types';

@Component({
  imports: [MlvFieldset],
  template: `
    <fieldset
      mlvFieldset
      [legend]="legend()"
      [description]="description()"
      [columns]="columns()"
      [minColumnWidth]="minColumnWidth()"
      [gap]="gap()"
    >
      <input id="a" />
      <input id="b" />
    </fieldset>
  `,
})
class Host {
  readonly legend = signal<string | undefined>(undefined);
  readonly description = signal<string | undefined>(undefined);
  readonly columns = signal<MlvFieldsetColumns | string>('auto');
  readonly minColumnWidth = signal('10rem');
  readonly gap = signal<MlvFormGap | undefined>(undefined);
}

@Component({
  imports: [MlvFieldset],
  template: `
    <fieldset mlvFieldset>
      <legend id="projected">Rich <em>legend</em></legend>
      <input id="a" />
    </fieldset>
  `,
})
class ProjectedLegendHost {}

@Component({
  imports: [MlvFieldset],
  template: `
    <fieldset mlvFieldset [description]="description()" aria-describedby="ext">
      <input id="a" />
    </fieldset>
  `,
})
class AuthoredDescribedByHost {
  readonly description = signal<string | undefined>(undefined);
}

@Component({
  imports: [MlvForm, MlvFieldset],
  template: `
    <form mlvForm gap="xl">
      <fieldset mlvFieldset id="outer" legend="Outer">
        <fieldset mlvFieldset id="inner" legend="Inner" gap="xs">
          <input />
        </fieldset>
      </fieldset>
    </form>
  `,
})
class NestedHost {}

async function render<T>(host: new () => T): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [host],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('MlvFieldset', () => {
  describe('structure', () => {
    let fixture: ComponentFixture<Host>;
    let fieldset: HTMLFieldSetElement;

    beforeEach(async () => {
      fixture = await render(Host);
      fieldset = fixture.nativeElement.querySelector('fieldset');
    });

    it('applies the block class, an auto id and wraps content in the body grid', () => {
      expect(fieldset.classList).toContain('mlv-fieldset');
      expect(fieldset.id).toMatch(/^mlv-fieldset-\d+$/);
      const body = fieldset.querySelector(
        ':scope > .mlv-fieldset__body',
      ) as HTMLElement;
      expect(body).toBeTruthy();
      expect(body.querySelector('#a')).toBeTruthy();
      expect(body.querySelector('#b')).toBeTruthy();
    });

    it('renders no legend, description or aria-describedby by default', () => {
      expect(fieldset.querySelector('legend')).toBeNull();
      expect(fieldset.querySelector('.mlv-fieldset__description')).toBeNull();
      expect(fieldset.getAttribute('aria-describedby')).toBeNull();
    });

    it('renders the legend input as the first child', async () => {
      fixture.componentInstance.legend.set('Address');
      fixture.detectChanges();
      await fixture.whenStable();
      const legend = fieldset.firstElementChild as HTMLElement;
      expect(legend.tagName).toBe('LEGEND');
      expect(legend.classList).toContain('mlv-fieldset__legend');
      expect(legend.textContent?.trim()).toBe('Address');
    });

    it('renders the description and points aria-describedby at it', async () => {
      fixture.componentInstance.description.set('Where we ship.');
      fixture.detectChanges();
      await fixture.whenStable();
      const description = fieldset.querySelector(
        '.mlv-fieldset__description',
      ) as HTMLElement;
      expect(description.textContent?.trim()).toBe('Where we ship.');
      expect(description.id).toBe(`${fieldset.id}-description`);
      expect(fieldset.getAttribute('aria-describedby')).toBe(description.id);
      // description precedes the body
      expect(description.nextElementSibling?.classList).toContain(
        'mlv-fieldset__body',
      );
    });

    it('is auto (uncapped) by default', () => {
      expect(fieldset.classList).not.toContain('mlv-fieldset--capped');
      expect(fieldset.style.getPropertyValue('--mlv-fieldset-columns')).toBe(
        '',
      );
      expect(
        fieldset.style.getPropertyValue('--mlv-fieldset-min-column-width'),
      ).toBe('10rem');
    });

    it('caps columns for a numeric input, including numeric strings', async () => {
      fixture.componentInstance.columns.set(2);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.classList).toContain('mlv-fieldset--capped');
      expect(fieldset.style.getPropertyValue('--mlv-fieldset-columns')).toBe(
        '2',
      );

      fixture.componentInstance.columns.set('3');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.style.getPropertyValue('--mlv-fieldset-columns')).toBe(
        '3',
      );

      fixture.componentInstance.columns.set('auto');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.classList).not.toContain('mlv-fieldset--capped');
      expect(fieldset.style.getPropertyValue('--mlv-fieldset-columns')).toBe(
        '',
      );
    });

    it('treats invalid column values as auto', async () => {
      fixture.componentInstance.columns.set('nope');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.classList).not.toContain('mlv-fieldset--capped');
    });

    it('forwards minColumnWidth and gap as inline custom properties', async () => {
      fixture.componentInstance.minColumnWidth.set('14rem');
      fixture.componentInstance.gap.set('l');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(
        fieldset.style.getPropertyValue('--mlv-fieldset-min-column-width'),
      ).toBe('14rem');
      expect(fieldset.style.getPropertyValue('--mlv-form-gap')).toBe(
        'var(--mlv-spacing-5)',
      );
    });
  });

  it('projects a native <legend> before the body when no legend input is set', async () => {
    const fixture = await render(ProjectedLegendHost);
    const fieldset = fixture.nativeElement.querySelector(
      'fieldset',
    ) as HTMLElement;
    const first = fieldset.firstElementChild as HTMLElement;
    expect(first.id).toBe('projected');
    expect(first.nextElementSibling?.classList).toContain('mlv-fieldset__body');
  });

  describe('authored aria-describedby', () => {
    let fixture: ComponentFixture<AuthoredDescribedByHost>;
    let fieldset: HTMLFieldSetElement;

    beforeEach(async () => {
      fixture = await render(AuthoredDescribedByHost);
      fieldset = fixture.nativeElement.querySelector('fieldset');
    });

    it('keeps a consumer-authored value when no description is set', () => {
      expect(fieldset.getAttribute('aria-describedby')).toBe('ext');
    });

    it('merges the description id in front of the authored value', async () => {
      fixture.componentInstance.description.set('Where we ship.');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.getAttribute('aria-describedby')).toBe(
        `${fieldset.id}-description ext`,
      );
    });

    it('returns to the authored value when the description is cleared', async () => {
      fixture.componentInstance.description.set('Where we ship.');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentInstance.description.set(undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fieldset.getAttribute('aria-describedby')).toBe('ext');
    });
  });

  it('nests: inner gap override shadows the inherited form gap only on the inner fieldset', async () => {
    const fixture = await render(NestedHost);
    const outer = fixture.nativeElement.querySelector('#outer') as HTMLElement;
    const inner = fixture.nativeElement.querySelector('#inner') as HTMLElement;
    expect(outer.style.getPropertyValue('--mlv-form-gap')).toBe('');
    expect(inner.style.getPropertyValue('--mlv-form-gap')).toBe(
      'var(--mlv-spacing-2)',
    );
    expect(inner.closest('.mlv-fieldset__body')).toBe(
      outer.querySelector(':scope > .mlv-fieldset__body'),
    );
  });
});
