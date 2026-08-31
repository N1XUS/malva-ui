import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { Component } from '@angular/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MlvDensityService } from '@malva-ui/cdk/density';
import axe from 'axe-core';
import { MlvSwitch } from './switch';
import { MlvSwitchGroup } from '../switch-group/switch-group';

@Component({
  template: `
    <mlv-switch aria-label="Enable feature" />
    <mlv-switch aria-labelledby="ext-label" />
    <span id="ext-label">External label</span>
  `,
  imports: [MlvSwitch],
})
class SwitchAriaHostComponent {}

@Component({
  template: `
    <mlv-switch-group>
      <mlv-switch>First</mlv-switch>
      <mlv-switch [disabled]="true">Disabled</mlv-switch>
      <mlv-switch>Third</mlv-switch>
    </mlv-switch-group>
  `,
  imports: [MlvSwitch, MlvSwitchGroup],
})
class SwitchGroupHostComponent {}

function dispatchArrowDown(element: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 40 });
  element.dispatchEvent(event);
}

describe('MlvSwitch', () => {
  let component: MlvSwitch;
  let fixture: ComponentFixture<MlvSwitch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSwitch],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSwitch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle checked state', () => {
    expect(component.checked()).toBe(false);
    component.toggle();
    expect(component.checked()).toBe(true);
    component.toggle();
    expect(component.checked()).toBe(false);
  });

  it('should not toggle when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.toggle();
    expect(component.checked()).toBe(false);
  });

  it('exposes the native input as the single focus target (host not tabbable)', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('.mlv-switch__native');
    expect(host.getAttribute('tabindex')).toBeNull();
    expect(input?.getAttribute('tabindex')).toBe('0');
    expect(input?.getAttribute('role')).toBe('switch');
    component.focus();
    expect(document.activeElement).toBe(input);
  });

  it('toggles on Enter via the native input keydown', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-switch__native');
    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.checked()).toBe(true);
  });

  it('reflects the native change event (Space toggles natively)', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-switch__native');
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    expect(component.checked()).toBe(true);
  });

  it('does not emit an empty aria-label/aria-labelledby on the input when none is supplied', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-switch__native');
    expect(input?.hasAttribute('aria-label')).toBe(false);
    expect(input?.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('MlvSwitch host aria-label/aria-labelledby forwarding', () => {
  let fixture: ComponentFixture<SwitchAriaHostComponent>;
  let hosts: HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchAriaHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SwitchAriaHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    hosts = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-switch'),
    );
  });

  it('moves a host aria-label onto the inner input and strips it from the host', () => {
    const host = hosts[0];
    const input = host.querySelector<HTMLInputElement>('.mlv-switch__native');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-label')).toBe('Enable feature');
  });

  it('moves a host aria-labelledby onto the inner input and strips it from the host', () => {
    const host = hosts[1];
    const input = host.querySelector<HTMLInputElement>('.mlv-switch__native');
    expect(host.hasAttribute('aria-labelledby')).toBe(false);
    expect(input?.getAttribute('aria-labelledby')).toBe('ext-label');
  });

  it('has no aria-prohibited-attr violations (axe)', async () => {
    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      runOnly: { type: 'rule', values: ['aria-prohibited-attr'] },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('MlvSwitchGroup', () => {
  it('should skip disabled switches during arrow navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(SwitchGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const switches = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-switch'),
    );

    const firstInput = switches[0].querySelector<HTMLInputElement>(
      '.mlv-switch__native',
    );
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    dispatchArrowDown(switches[0]);
    fixture.detectChanges();

    // Focus now lands on the native input inside the third switch, not the host.
    expect(switches[2].contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(
      switches[2].querySelector('.mlv-switch__native'),
    );
  });
});

@Component({
  template: `
    <mlv-switch label="Email alerts" />
    <mlv-switch label="Fallback loser">Projected wins</mlv-switch>
  `,
  imports: [MlvSwitch],
})
class SwitchLabelHostComponent {}

describe('MlvSwitch visible label input', () => {
  let fixture: ComponentFixture<SwitchLabelHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchLabelHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SwitchLabelHostComponent);
    await fixture.whenStable();
  });

  function switches(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-switch'),
    );
  }

  it('renders the label input as visible text when nothing is projected', () => {
    expect(
      (
        switches()[0].querySelector('.mlv-switch__label-text') as HTMLElement
      ).textContent?.trim(),
    ).toBe('Email alerts');
    expect(
      (
        switches()[0].querySelector('.mlv-switch__label') as HTMLElement
      ).textContent?.trim(),
    ).toBe('Email alerts');
  });

  it('keeps the projected text as the single visible label when both are set', () => {
    const content = switches()[1].querySelector(
      '.mlv-switch__content',
    ) as HTMLElement;
    expect(content.textContent?.trim()).toBe('Projected wins');
    // The fallback stays in the DOM but is display:none-d by the sibling rule,
    // so it never joins the accessible name.
    expect(content.matches(':empty')).toBe(false);
  });

  it('warns in dev mode when nothing labels the switch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const bare = TestBed.createComponent(MlvSwitch);
    await bare.whenStable();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('mlv-switch');
    warn.mockRestore();
  });

  it('sets aria-required on the native input when required', async () => {
    const bare = TestBed.createComponent(MlvSwitch);
    bare.componentRef.setInput('required', true);
    bare.componentRef.setInput('ariaLabel', 'Enable two-factor auth');
    await bare.whenStable();

    expect(
      bare.nativeElement
        .querySelector('.mlv-switch__native')
        .getAttribute('aria-required'),
    ).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Density
// ---------------------------------------------------------------------------

@Component({
  template: `
    <mlv-switch mlvDensity="tight" label="Tight" />
    <mlv-switch mlvDensity="compact" label="Compact" />
    <mlv-switch mlvDensity="comfortable" label="Comfortable" />
    <mlv-switch mlvDensity="spacious" label="Spacious" />
    <mlv-switch mlvDensity="airy" label="Airy" />
  `,
  imports: [MlvSwitch],
})
class SwitchDensityHostComponent {}

@Component({
  template: `
    <mlv-switch-group mlvDensity="airy" label="Projected">
      <mlv-switch label="Inherits" />
      <mlv-switch mlvDensity="tight" label="Overrides" />
    </mlv-switch-group>
  `,
  imports: [MlvSwitch, MlvSwitchGroup],
})
class SwitchGroupDensityHostComponent {}

@Component({
  template: `
    <mlv-switch-group label="Default">
      <mlv-switch label="Default child" />
    </mlv-switch-group>
  `,
  imports: [MlvSwitch, MlvSwitchGroup],
})
class SwitchDefaultDensityHostComponent {}

describe('MlvSwitch density', () => {
  function switches(fixture: ComponentFixture<unknown>): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-switch'),
    );
  }

  async function createHost<T>(host: Type<T>): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [host],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    await fixture.whenStable();
    return fixture;
  }

  it('stamps the matching BEM modifier for each of the five levels', async () => {
    const fixture = await createHost(SwitchDensityHostComponent);

    expect(switches(fixture).map((el) => el.className)).toEqual([
      expect.stringContaining('mlv-switch--tight'),
      expect.stringContaining('mlv-switch--compact'),
      expect.stringContaining('mlv-switch--comfortable'),
      expect.stringContaining('mlv-switch--spacious'),
      expect.stringContaining('mlv-switch--airy'),
    ]);
    // Exactly one density modifier per host — the effect clears the others.
    for (const el of switches(fixture)) {
      const applied = Array.from(el.classList).filter((c) =>
        /^mlv-switch--(tight|compact|comfortable|spacious|airy)$/.test(c),
      );
      expect(applied).toHaveLength(1);
      expect(el.classList.contains('mlv-switch')).toBe(true);
    }
  });

  it('projects the group density onto every projected switch', async () => {
    const fixture = await createHost(SwitchGroupDensityHostComponent);

    const group = fixture.nativeElement.querySelector(
      'mlv-switch-group',
    ) as HTMLElement;
    expect(group.classList.contains('mlv-switch-group--airy')).toBe(true);
    expect(group.classList.contains('mlv-switch-group')).toBe(true);

    expect(switches(fixture)[0].classList.contains('mlv-switch--airy')).toBe(
      true,
    );
  });

  it('lets an explicit mlvDensity on the switch override the group density', async () => {
    const fixture = await createHost(SwitchGroupDensityHostComponent);

    const overridden = switches(fixture)[1];
    expect(overridden.classList.contains('mlv-switch--tight')).toBe(true);
    expect(overridden.classList.contains('mlv-switch--airy')).toBe(false);
  });

  it('falls back to the library-wide default density', async () => {
    const fixture = await createHost(SwitchDefaultDensityHostComponent);

    const group = fixture.nativeElement.querySelector(
      'mlv-switch-group',
    ) as HTMLElement;
    expect(group.classList.contains('mlv-switch-group--comfortable')).toBe(
      true,
    );
    expect(
      switches(fixture)[0].classList.contains('mlv-switch--comfortable'),
    ).toBe(true);
  });

  it('follows the global service density when nothing is set locally', async () => {
    const fixture = await createHost(SwitchDefaultDensityHostComponent);
    TestBed.inject(MlvDensityService).setDensity('compact');
    await fixture.whenStable();

    expect(switches(fixture)[0].classList.contains('mlv-switch--compact')).toBe(
      true,
    );
    expect(
      switches(fixture)[0].classList.contains('mlv-switch--comfortable'),
    ).toBe(false);
  });
});

describe('MlvSwitch stylesheet', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(dir, 'switch.scss'), 'utf8');

  // Locks `--mlv-switch-font-size` onto the shared control-text ramp
  // (CH-R3 in docs/superpowers/specs/2026-08-24-visual-language-spec.md),
  // the same five values `--form-ctrl-font-size` uses in
  // form-control-wrapper.scss. `compact` and `airy` previously read one
  // step below the ramp (body-s / body-l instead of body-m / font-size-xl),
  // so a switch label rendered smaller than an input's text at those two
  // densities even though every other control agreed.
  it('scales the label to the shared five-step type ramp', () => {
    expect(scss).toContain(
      '--mlv-switch-font-size: var(--mlv-typography-body-m-size);',
    );

    const tight = scss.match(
      /density-tight\s*{[^}]*--mlv-switch-font-size:\s*([^;]+);/,
    );
    const compact = scss.match(
      /density-compact\s*{[^}]*--mlv-switch-font-size:\s*([^;]+);/,
    );
    const spacious = scss.match(
      /density-spacious\s*{[^}]*--mlv-switch-font-size:\s*([^;]+);/,
    );
    const airy = scss.match(
      /density-airy\s*{[^}]*--mlv-switch-font-size:\s*([^;]+);/,
    );

    expect(tight?.[1]).toBe('var(--mlv-typography-body-s-size)');
    expect(compact?.[1]).toBe('var(--mlv-typography-body-m-size)');
    expect(spacious?.[1]).toBe('var(--mlv-typography-body-l-size)');
    expect(airy?.[1]).toBe('var(--mlv-font-size-xl)');
  });

  // The thumb paints `--mlv-elevation-bg-5`. In dark theme that token
  // resolves to the general elevation ladder's lightened grey
  // (color-mix toward white off neutral-700, ~#707070) — muddy against the
  // ~#262626 off-track and near-indistinguishable (~1.07:1) against the
  // accent-1 (#5770cb) on-track. Locks the local `[mlvTheme='dark']`
  // override that repaints it as a crisp near-white knob
  // (--mlv-palette-neutral-50) without touching the shared theme.scss
  // token (its only other declared role: light stays --mlv-background-raised
  // / #ffffff, unchanged) or any other --mlv-elevation-bg-5 consumer.
  it('repaints the thumb as a light knob in dark theme', () => {
    expect(scss).toContain('background-color: var(--mlv-elevation-bg-5);');

    const darkOverride = scss.match(
      /\[mlvTheme='dark'\]\s*\.#\{\$block\}\s*{[^}]*--mlv-elevation-bg-5:\s*([^;]+);/,
    );
    expect(darkOverride?.[1]).toBe('var(--mlv-palette-neutral-50)');
  });
});
