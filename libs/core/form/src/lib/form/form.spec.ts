import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MLV_DENSITY_CONTEXT, MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvForm } from './form';
import type { MlvFormGap } from '../form.types';

@Component({
  imports: [MlvForm, MlvButton],
  template: `
    <form
      mlvForm
      [mlvDensity]="density()"
      [gap]="gap()"
      [maxWidth]="maxWidth()"
    >
      <button mlvButton type="button">Save</button>
    </form>
  `,
})
class FormHost {
  readonly density = signal<MlvDensity | undefined>(undefined);
  readonly gap = signal<MlvFormGap | undefined>(undefined);
  readonly maxWidth = signal<string | undefined>(undefined);
}

describe('MlvForm', () => {
  let fixture: ComponentFixture<FormHost>;
  let form: HTMLFormElement;
  let service: MlvDensityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormHost],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    service = TestBed.inject(MlvDensityService);
    fixture = TestBed.createComponent(FormHost);
    fixture.detectChanges();
    await fixture.whenStable();
    form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  });

  it('applies the block class and the service density modifier by default', () => {
    expect(form.classList).toContain('mlv-form');
    expect(form.classList).toContain('mlv-form--comfortable');
  });

  it('stamps the explicit density modifier', async () => {
    fixture.componentInstance.density.set('compact');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.classList).toContain('mlv-form--compact');
    expect(form.classList).not.toContain('mlv-form--comfortable');
  });

  it('projects its density to directive-bearing children (mlvButton)', async () => {
    fixture.componentInstance.density.set('compact');
    fixture.detectChanges();
    await fixture.whenStable();
    const button = form.querySelector('button') as HTMLButtonElement;
    expect(button.classList).toContain('mlv-button--compact');
    expect(button.classList).not.toContain('mlv-button--comfortable');
  });

  it('children follow the service when the form has no explicit density', async () => {
    service.setDensity('spacious');
    fixture.detectChanges();
    await fixture.whenStable();
    const button = form.querySelector('button') as HTMLButtonElement;
    expect(form.classList).toContain('mlv-form--spacious');
    expect(button.classList).toContain('mlv-button--spacious');
  });

  it('provides MLV_DENSITY_CONTEXT to descendants', () => {
    const buttonDebug = fixture.debugElement.query((d) => d.name === 'button');
    const context = buttonDebug.injector.get(MLV_DENSITY_CONTEXT);
    expect(context()).toBe('comfortable');
  });

  it('leaves --mlv-form-gap to the stylesheet when gap is unset', () => {
    expect(form.style.getPropertyValue('--mlv-form-gap')).toBe('');
  });

  it('writes the gap step as an inline --mlv-form-gap override', async () => {
    fixture.componentInstance.gap.set('s');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.style.getPropertyValue('--mlv-form-gap')).toBe(
      'var(--mlv-spacing-3)',
    );
    fixture.componentInstance.gap.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.style.getPropertyValue('--mlv-form-gap')).toBe('');
  });

  it('binds maxWidth to max-inline-size', async () => {
    fixture.componentInstance.maxWidth.set('28rem');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.style.maxInlineSize).toBe('28rem');
  });
});
