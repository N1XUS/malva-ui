import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Signal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService, MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvPopup } from '@malva-ui/core/popup';
import type { MlvPopupMobileMode } from '@malva-ui/core/popup';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import { defaultCompareWith } from '@malva-ui/core/dropdown';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvSelectOptionTransform,
} from '@malva-ui/core/dropdown';
import { MlvSelect } from './select';
import {
  MlvSelectItemTemplate,
  MlvSelectSelectedTemplate,
} from '../select-template.directives';
import type { MlvSelectNativeMode } from './select';
import type { MlvSelectOption } from '../select-option';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

describe('MlvSelect', () => {
  let component: MlvSelect;
  let fixture: ComponentFixture<MlvSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSelect],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSelect);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('trigger accessibility', () => {
    @Component({
      imports: [MlvSelect],
      template: `
        <mlv-select
          [label]="label()"
          ariaLabel="Country selector"
          [disabled]="disabled()"
          [options]="['a', 'b']"
        />
      `,
    })
    class HostComponent {
      readonly label = signal('Country');
      readonly disabled = signal(false);
    }

    function setup(): {
      fixture: ComponentFixture<HostComponent>;
      trigger: () => HTMLElement;
    } {
      const f = TestBed.createComponent(HostComponent);
      f.detectChanges();
      return {
        fixture: f,
        trigger: () =>
          f.nativeElement.querySelector('.mlv-select__trigger') as HTMLElement,
      };
    }

    it('keeps role="combobox" on the trigger (MlvClick does not override it)', () => {
      const { trigger } = setup();
      expect(trigger().getAttribute('role')).toBe('combobox');
    });

    it('names the trigger via aria-labelledby pointing at the visible label', () => {
      const { fixture: f, trigger } = setup();
      const labelledBy = trigger().getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const label = f.nativeElement.querySelector(
        `#${labelledBy}`,
      ) as HTMLElement;
      expect(label).toBeTruthy();
      expect(label.textContent).toContain('Country');
      expect(trigger().getAttribute('aria-label')).toBeNull();
    });

    it('uses ariaLabel when no visible label is present', () => {
      const { fixture: f, trigger } = setup();
      f.componentInstance.label.set('');
      f.detectChanges();

      expect(trigger().getAttribute('aria-labelledby')).toBeNull();
      expect(trigger().getAttribute('aria-label')).toBe('Country selector');
    });

    it('omits aria-disabled and keeps tabindex=0 when enabled', () => {
      const { trigger } = setup();
      expect(trigger().getAttribute('aria-disabled')).toBeNull();
      expect(trigger().getAttribute('tabindex')).toBe('0');
    });

    it('sets aria-disabled=true and tabindex=-1 when disabled', () => {
      const { fixture: f, trigger } = setup();
      f.componentInstance.disabled.set(true);
      f.detectChanges();
      expect(trigger().getAttribute('aria-disabled')).toBe('true');
      expect(trigger().getAttribute('tabindex')).toBe('-1');
    });

    it('does not focus a disabled trigger from the label click target', () => {
      const { fixture: f, trigger } = setup();
      f.componentInstance.disabled.set(true);
      f.detectChanges();
      const select = f.debugElement.query(By.directive(MlvSelect))
        .componentInstance as MlvSelect<string>;
      select.openDropdown();
      f.detectChanges();
      // tabindex="-1" would still accept programmatic focus — a disabled field
      // must not take the caret.
      expect(document.activeElement).not.toBe(trigger());
      expect(select.isOpen()).toBe(false);
    });
  });
});

/**
 * The dropdown panel is the migrated `@angular/aria` listbox (`ngListbox`/
 * `ngOption` via `mlv-dropdown-panel`). These specs pin the CVA ↔ aria value
 * bridge (`toAriaValues` / `fromAriaValues`) and the panel wiring the trigger's
 * `aria-controls` points at.
 */
describe('MlvSelect — aria listbox panel + CVA bridge', () => {
  @Component({
    imports: [MlvSelect],
    template: `
      <mlv-select id="fruit" [options]="options" [multiple]="multiple()" />
    `,
  })
  class HostComponent {
    readonly multiple = signal(false);
    options = ['Apple', 'Banana', 'Cherry'];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  function make(multiple = false): {
    fixture: ComponentFixture<HostComponent>;
    select: MlvSelect<string>;
  } {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.multiple.set(multiple);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(MlvSelect))
      .componentInstance as MlvSelect<string>;
    return { fixture, select };
  }

  describe('forms value bridging (toAriaValues / fromAriaValues)', () => {
    it('a scalar model value drives the aria panel selection source (single)', () => {
      const { fixture, select } = make(false);
      select.value.set('Banana');
      fixture.detectChanges();
      expect(select.selectionService.selectedValues()).toEqual(['Banana']);
      expect(select.displayValue).toBe('Banana');
    });

    it('a null model value clears the selection', () => {
      const { fixture, select } = make(false);
      select.value.set('Banana');
      fixture.detectChanges();
      select.value.set(null);
      fixture.detectChanges();
      expect(select.selectionService.selectedValues()).toEqual([]);
      expect(select.displayValue).toBe('');
    });

    it('an array model value populates the multi-select model', () => {
      const { fixture, select } = make(true);
      select.value.set(['Apple', 'Cherry']);
      fixture.detectChanges();
      expect(select.selectionService.selectedValues()).toEqual([
        'Apple',
        'Cherry',
      ]);
      expect(select.displayValue).toBe('2 items selected');
    });

    it('selectOption collapses the aria array to a scalar model value and closes', () => {
      const { select } = make(false);
      select.isOpen.set(true);
      select.selectOption(['Banana']);
      expect(select.value()).toBe('Banana');
      expect(select.isOpen()).toBe(false);
    });

    it('selectOption emits null when the aria array is emptied (single)', () => {
      const { select } = make(false);
      select.selectOption([]);
      expect(select.value()).toBeNull();
    });

    it('selectOption keeps an array model value in multi mode and stays open', () => {
      const { select } = make(true);
      select.isOpen.set(true);
      select.selectOption(['Apple', 'Banana']);
      expect(select.value()).toEqual(['Apple', 'Banana']);
      expect(select.isOpen()).toBe(true);
    });
  });

  describe('rendered aria listbox panel', () => {
    let overlayContainer: OverlayContainer;
    let overlayEl: HTMLElement;

    beforeEach(() => {
      overlayContainer = TestBed.inject(OverlayContainer);
      overlayEl = overlayContainer.getContainerElement();
    });

    afterEach(() => overlayContainer.ngOnDestroy());

    async function open(multiple = false): Promise<{
      fixture: ComponentFixture<HostComponent>;
      select: MlvSelect<string>;
    }> {
      const made = make(multiple);
      made.select.openDropdown();
      made.fixture.detectChanges();
      await made.fixture.whenStable();
      made.fixture.detectChanges();
      return made;
    }

    it('renders an aria listbox with one option role per item', async () => {
      await open();
      expect(overlayEl.querySelector('[role="listbox"]')).toBeTruthy();
      expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(3);
    });

    it('uses only the popup scrollbar for the dropdown panel', async () => {
      await open();
      expect(overlayEl.querySelectorAll('mlv-scrollbar').length).toBe(1);
      expect(
        overlayEl.querySelector('.mlv-popup__scrollbar.mlv-scrollbar'),
      ).toBeTruthy();
      expect(
        overlayEl.querySelector('.mlv-dropdown-panel__scrollbar'),
      ).toBeNull();
    });

    it('links the trigger aria-controls to the rendered listbox DOM id', async () => {
      const { fixture } = await open();
      const trigger = fixture.nativeElement.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;
      const listbox = overlayEl.querySelector(
        '[role="listbox"]',
      ) as HTMLElement;
      // Real linkage: the trigger's aria-controls resolves to an element that
      // actually exists in the DOM. `MlvListSelectable` now forwards the
      // consumer id into aria's `Listbox.id` input, so the rendered listbox id
      // equals listboxId() ("<id>-listbox") instead of aria's generated id.
      expect(listbox).toBeTruthy();
      expect(trigger.getAttribute('aria-controls')).toBe('fruit-listbox');
      expect(listbox.getAttribute('id')).toBe('fruit-listbox');
      expect(trigger.getAttribute('aria-controls')).toBe(
        listbox.getAttribute('id'),
      );
    });

    it('drops aria-controls from the trigger once the panel closes', () => {
      const { fixture, select } = make();
      const trigger = fixture.nativeElement.querySelector(
        '.mlv-select__trigger',
      ) as HTMLElement;
      expect(select.isOpen()).toBe(false);
      expect(trigger.getAttribute('aria-controls')).toBeNull();
    });

    it('feeds each option its label text (aria typeahead source)', async () => {
      await open();
      const labels = Array.from(
        overlayEl.querySelectorAll('[role="option"]'),
      ).map((o) => o.textContent?.trim());
      expect(labels).toEqual(['Apple', 'Banana', 'Cherry']);
    });

    it('reflects a model write as a checked option in the panel (single)', async () => {
      const { fixture, select } = await open(false);
      select.value.set('Banana');
      fixture.detectChanges();
      await fixture.whenStable();
      const checks = overlayEl.querySelectorAll(
        '.mlv-dropdown-panel__item-check',
      );
      expect(checks.length).toBe(1);
    });

    it('accumulates multiple checked options in multi-select mode', async () => {
      const { fixture, select } = await open(true);
      select.value.set(['Apple', 'Cherry']);
      fixture.detectChanges();
      await fixture.whenStable();
      const checks = overlayEl.querySelectorAll(
        '.mlv-dropdown-panel__item-check',
      );
      expect(checks.length).toBe(2);
    });
  });
});

/**
 * `role="listbox"` is an ARIA input field (axe's `aria-input-field-name`
 * rule flags it unnamed) — the dropdown panel's `ariaLabel` must carry the
 * same resolved accessible name as the trigger (`_panelAriaLabel`: the
 * visible `label`, else the explicit `ariaLabel` input).
 */
describe('MlvSelect — dropdown panel accessible name', () => {
  @Component({
    imports: [MlvSelect],
    template: `
      <mlv-select
        id="fruit"
        [label]="label()"
        ariaLabel="Fruit selector"
        [options]="['Apple', 'Banana']"
      />
    `,
  })
  class HostComponent {
    readonly label = signal('Fruit');
  }

  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function open(): Promise<ComponentFixture<HostComponent>> {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(MlvSelect))
      .componentInstance as MlvSelect<string>;
    select.openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('names the rendered listbox from the visible label', async () => {
    await open();
    const listbox = overlayEl.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox).toBeTruthy();
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
  });

  it('falls back to ariaLabel on the listbox when no visible label is set', async () => {
    const fixture = await open();
    fixture.componentInstance.label.set('');
    fixture.detectChanges();
    const listbox = overlayEl.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox.getAttribute('aria-label')).toBe('Fruit selector');
  });

  it('is axe-clean with the dropdown open', async () => {
    await open();
    await expectNoAxeViolations(document.body);
  });
});

/**
 * Option groups: a `toOption` that tags each option with a `group` label makes
 * the shared dropdown panel render sticky, non-selectable group headers. The
 * select's value is unaffected — headers are not options and never enter the CVA.
 */
describe('MlvSelect — option groups', () => {
  interface City {
    name: string;
    country: string;
  }

  @Component({
    imports: [MlvSelect],
    template: `
      <mlv-select id="city" [options]="cities" [toOption]="toOption" />
    `,
  })
  class HostComponent {
    readonly cities: City[] = [
      { name: 'Paris', country: 'France' },
      { name: 'Lyon', country: 'France' },
      { name: 'Berlin', country: 'Germany' },
    ];
    readonly toOption = (c: City) => ({
      label: c.name,
      value: c,
      group: c.country,
    });
  }

  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function open(): Promise<{
    fixture: ComponentFixture<HostComponent>;
    select: MlvSelect<City>;
  }> {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(MlvSelect))
      .componentInstance as MlvSelect<City>;
    select.openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, select };
  }

  it('renders a sticky group header per country and keeps options non-header', async () => {
    await open();
    const groups = overlayEl.querySelectorAll('[role="group"]');
    expect(groups.length).toBe(2);
    const headers = Array.from(
      overlayEl.querySelectorAll('.mlv-dropdown-panel__group-header'),
    ).map((h) => h.textContent?.trim());
    expect(headers).toEqual(['France', 'Germany']);
    // Headers do not inflate the option set.
    expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(3);
  });

  it('commits an option value (never a header) on selection', async () => {
    const { select } = await open();
    select.selectOption([{ name: 'Berlin', country: 'Germany' }]);
    expect(select.value()).toEqual({ name: 'Berlin', country: 'Germany' });
  });
});

/**
 * Mobile fullscreen: the dropdown `mlv-popup` opts into `mobileMode="auto"`
 * (overridable) and derives the sheet title from the field label / placeholder.
 * The trigger is a plain button and the dropdown is the whole interaction
 * surface, so full-screen composes cleanly (unlike `mlv-combobox`, whose search
 * input lives outside the overlay panel — see combobox docs for that blocker).
 */
describe('MlvSelect — mobile fullscreen', () => {
  @Component({
    imports: [MlvSelect],
    template: `
      <mlv-select
        id="fruit"
        [label]="label()"
        [options]="['Apple', 'Banana']"
        [mobileMode]="mobileMode()"
        [mobileTitle]="mobileTitle()"
        [mlvDensity]="density()"
      />
    `,
  })
  class HostComponent {
    readonly label = signal('Fruit');
    readonly mobileMode = signal<MlvPopupMobileMode>('auto');
    readonly mobileTitle = signal<string | undefined>(undefined);
    readonly density = signal<MlvDensity | undefined>(undefined);
  }

  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  function make(): {
    fixture: ComponentFixture<HostComponent>;
    host: HostComponent;
    select: MlvSelect<string>;
    popup: MlvPopup;
    trigger: () => HTMLElement;
  } {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(MlvSelect))
      .componentInstance as MlvSelect<string>;
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    return {
      fixture,
      host: fixture.componentInstance,
      select,
      popup,
      trigger: () =>
        fixture.nativeElement.querySelector(
          '.mlv-select__trigger',
        ) as HTMLElement,
    };
  }

  it('defaults the popup mobileMode to "auto" (passthrough)', () => {
    const { popup } = make();
    expect(popup.mobileMode()).toBe('auto');
  });

  it('stamps the forwarded mlvDensity on the detached popup panel', async () => {
    const { fixture, host, select } = make();
    host.density.set('compact');
    host.mobileMode.set('off');
    fixture.detectChanges();
    select.openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayEl.querySelector('.mlv-popup') as HTMLElement;
    expect(panel.classList.contains('mlv--compact')).toBe(true);
  });

  it('passes an overridden mobileMode straight through to the popup', () => {
    const { fixture, host, popup } = make();
    host.mobileMode.set('off');
    fixture.detectChanges();
    expect(popup.mobileMode()).toBe('off');
  });

  it('derives the fullscreen sheet title from the field label', () => {
    const { popup } = make();
    expect(popup.mobileTitle()).toBe('Fruit');
  });

  it('prefers an explicit mobileTitle over the label', () => {
    const { fixture, host, popup } = make();
    host.mobileTitle.set('Choose fruit');
    fixture.detectChanges();
    expect(popup.mobileTitle()).toBe('Choose fruit');
  });

  it('renders the fullscreen header (title + close button) when forced fullscreen', async () => {
    const { fixture, host, select } = make();
    host.mobileMode.set('fullscreen');
    fixture.detectChanges();
    select.openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = overlayEl.querySelector('.mlv-popup') as HTMLElement;
    expect(panel.classList.contains('mlv-popup--fullscreen')).toBe(true);
    expect(panel.querySelector('.mlv-popup__title')?.textContent).toContain(
      'Fruit',
    );
    expect(panel.querySelector('.mlv-popup__close')).not.toBeNull();
  });

  it('closes via the fullscreen X button and restores focus to the trigger', async () => {
    const { fixture, host, select, trigger } = make();
    host.mobileMode.set('fullscreen');
    fixture.detectChanges();
    select.openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = overlayEl.querySelector('.mlv-popup') as HTMLElement;
    const closeBtn = panel.querySelector(
      '.mlv-popup__close',
    ) as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    // Drive the leave animation to completion so the overlay detaches and the
    // popup's `afterClosed` (→ `setInitialFocus`) runs.
    panel.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(select.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });
});

// ---------------------------------------------------------------------------
// Inline clear button (value-gated, overlaid before the chevron)
// ---------------------------------------------------------------------------
@Component({
  // `ariaLabel` because the trigger carries `role="combobox"` — an ARIA input
  // field, which axe's `aria-input-field-name` requires to be named. The name
  // comes from the consumer's `label`/`ariaLabel`; the component cannot invent
  // one, so a harness without either is unrealistic rather than a defect.
  template: `<mlv-select
    clearable
    ariaLabel="Fruit"
    [options]="['Apple', 'Banana']"
  />`,
  imports: [MlvSelect],
})
class ClearableSelectHostComponent {
  readonly select = viewChild.required(MlvSelect<string>);
}

describe('MlvSelect (inline clear button)', () => {
  let fixture: ComponentFixture<ClearableSelectHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClearableSelectHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ClearableSelectHostComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const clearEl = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.mlv-select__clear');

  it('renders the clear button only while a value is selected', () => {
    const select = fixture.componentInstance.select();
    expect(select.hasValue()).toBe(false);
    expect(clearEl()).toBeNull(); // clearable but empty — no X

    select.value.set('Apple');
    fixture.detectChanges();
    expect(select.hasValue()).toBe(true);
    expect(clearEl()).not.toBeNull();
  });

  it('onClear clears the selection, commits null, marks touched, and hides the X', () => {
    const select = fixture.componentInstance.select();
    select.value.set('Apple');
    fixture.detectChanges();

    select.onClear();
    fixture.detectChanges();

    expect(select.selectionService.selectedValues()).toEqual([]);
    expect(select.value()).toBeNull();
    expect(clearEl()).toBeNull();
  });

  it('suppresses the wrapper-rendered clear button (ownsClearButton) and reserves trigger padding', () => {
    const select = fixture.componentInstance.select();
    select.value.set('Apple');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('mlv-button-close').length,
    ).toBe(1);
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-select__trigger',
    ) as HTMLElement;
    expect(trigger.classList.contains('mlv-select__trigger--with-clear')).toBe(
      true,
    );
  });

  it('keeps the inline clear action as one native button and emits one cleared value', async () => {
    const select = fixture.componentInstance.select();
    select.value.set('Apple');
    fixture.detectChanges();
    const valueChanges = vi.fn();
    select.value.subscribe(valueChanges);

    const closeHost = fixture.nativeElement.querySelector(
      'mlv-button-close',
    ) as HTMLElement;
    const clearButton = closeHost.querySelector('button') as HTMLButtonElement;
    expect(closeHost).not.toBeNull();
    expect(closeHost.getAttribute('role')).toBeNull();
    expect(closeHost.getAttribute('tabindex')).toBeNull();
    expect(closeHost.querySelectorAll('button')).toHaveLength(1);

    await expectNoAxeViolations(fixture.nativeElement);

    clearButton.click();
    expect(valueChanges).toHaveBeenCalledTimes(1);
    expect(valueChanges).toHaveBeenLastCalledWith(null);
  });
});

/**
 * `compareWith` (parity with `mlv-combobox`) plus the shared aria reconciliation
 * guard from `@malva-ui/core/dropdown`: written values collapse onto their option
 * instances (label + check-mark agree, and a value that arrives before its
 * options resolves once they load), and an aria `valueChange` that only drops
 * values whose option is not currently rendered never wipes the committed value.
 */
describe('MlvSelect — compareWith + reconciliation guard', () => {
  interface Tag {
    id: number;
    name: string;
  }

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="tags"
      [options]="options()"
      [toOption]="toOption"
      [compareWith]="compareWith"
      [multiple]="multiple()"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<Tag>);
    readonly options = signal<Tag[]>([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    readonly multiple = signal(false);
    readonly toOption = (t: Tag) => ({ label: t.name, value: t });
    readonly compareWith = (a: Tag, b: Tag) => a.id === b.id;
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('normalises a structurally-equal written value onto the option instance', () => {
    const select = fixture.componentInstance.select();
    select.value.set({ id: 2, name: 'stale' });
    fixture.detectChanges();
    expect(select.selectionService.selectedValues()[0]).toBe(
      fixture.componentInstance.options()[1],
    );
    expect(select.displayValue).toBe('Beta');
  });

  it('re-normalises when options arrive after the value', () => {
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();
    const select = fixture.componentInstance.select();
    select.value.set({ id: 1, name: '' });
    fixture.detectChanges();
    fixture.componentInstance.options.set([{ id: 1, name: 'Alpha' }]);
    fixture.detectChanges();
    expect(select.displayValue).toBe('Alpha');
    expect(select.selectionService.selectedValues()[0]).toBe(
      fixture.componentInstance.options()[0],
    );
  });

  it('ignores an aria reconciliation emit that only drops a value not currently rendered', () => {
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();
    const select = fixture.componentInstance.select();
    const alpha = { id: 1, name: 'Alpha' };
    select.value.set(alpha);
    fixture.detectChanges();
    // aria sees no rendered options and re-emits [] — must NOT clear the value.
    select.selectOption([]);
    expect(select.value()).toEqual(alpha);
    expect(select.selectionService.selectedValues()).toEqual([alpha]);
  });

  it('still honours a genuine deselect of a rendered option (single → null)', () => {
    const select = fixture.componentInstance.select();
    const [alpha] = fixture.componentInstance.options();
    select.value.set(alpha);
    fixture.detectChanges();
    select.selectOption([]);
    expect(select.value()).toBeNull();
  });

  it('re-adds committed values aria dropped only because they were not rendered (multi)', () => {
    fixture.componentInstance.multiple.set(true);
    fixture.componentInstance.options.set([{ id: 2, name: 'Beta' }]);
    fixture.detectChanges();
    const select = fixture.componentInstance.select();
    const alpha = { id: 1, name: 'Alpha' };
    select.value.set([alpha]);
    fixture.detectChanges();
    const beta = fixture.componentInstance.options()[0];
    // Genuine pick of Beta while Alpha's option is not rendered.
    select.selectOption([beta]);
    expect(select.value()).toEqual([beta, alpha]);
  });
});

/**
 * A consumer that never sets `compareWith` must see exactly the reference
 * (`===`) semantics it always had. The input default is now the shared
 * module-level `defaultCompareWith` (so the reconciliation helpers can
 * recognise it and take their `Set` fast path) rather than a per-instance
 * inline arrow — same behaviour, one reference.
 */
describe('MlvSelect — default compareWith (unset by the consumer)', () => {
  interface Tag {
    id: number;
    name: string;
  }

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="tags"
      [options]="options()"
      [toOption]="toOption"
      [multiple]="multiple()"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<Tag>);
    readonly options = signal<Tag[]>([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    readonly multiple = signal(false);
    readonly toOption = (t: Tag) => ({ label: t.name, value: t });
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('resolves to the shared default comparator', () => {
    expect(fixture.componentInstance.select().compareWith()).toBe(
      defaultCompareWith,
    );
  });

  it('selects an option written by reference', () => {
    const select = fixture.componentInstance.select();
    const [, beta] = fixture.componentInstance.options();
    select.value.set(beta);
    fixture.detectChanges();
    expect(select.selectionService.selectedValues()[0]).toBe(beta);
    expect(select.displayValue).toBe('Beta');
  });

  it('does NOT collapse a structurally-equal value onto its option (reference equality)', () => {
    const select = fixture.componentInstance.select();
    const written = { id: 2, name: 'Beta' };
    select.value.set(written);
    fixture.detectChanges();
    // The custom-comparator block above normalises this onto the option
    // instance; the default must NOT — no option matches by reference, so the
    // written object stays exactly as written.
    expect(select.selectionService.selectedValues()[0]).toBe(written);
    expect(select.selectionService.selectedValues()[0]).not.toBe(
      fixture.componentInstance.options()[1],
    );
    expect(
      select.selectionService.isSelected(
        fixture.componentInstance.options()[1],
      ),
    ).toBe(false);
  });

  it('ignores an aria reconciliation emit that drops a value not currently rendered', () => {
    fixture.componentInstance.options.set([]);
    fixture.detectChanges();
    const select = fixture.componentInstance.select();
    const alpha = { id: 1, name: 'Alpha' };
    select.value.set(alpha);
    fixture.detectChanges();
    select.selectOption([]);
    expect(select.value()).toBe(alpha);
  });

  it('still honours a genuine deselect of a rendered option (single -> null)', () => {
    const select = fixture.componentInstance.select();
    const [alpha] = fixture.componentInstance.options();
    select.value.set(alpha);
    fixture.detectChanges();
    select.selectOption([]);
    expect(select.value()).toBeNull();
  });

  it('re-adds committed values aria dropped only because they were not rendered (multi)', () => {
    fixture.componentInstance.multiple.set(true);
    const alpha = { id: 1, name: 'Alpha' };
    fixture.componentInstance.options.set([{ id: 2, name: 'Beta' }]);
    fixture.detectChanges();
    const select = fixture.componentInstance.select();
    select.value.set([alpha]);
    fixture.detectChanges();
    const beta = fixture.componentInstance.options()[0];
    select.selectOption([beta]);
    expect(select.value()).toEqual([beta, alpha]);
    expect(select.value()?.[1]).toBe(alpha);
  });
});

/**
 * Async sources through the shared `MlvOptionsAdapter`: an observable / data
 * source feeds `options`, the dropdown renders the panel's spinner row while a
 * source loads (without closing), and a committed value whose label has not
 * resolved yet puts the trigger into the tabbable-but-inert loading variant.
 */
describe('MlvSelect — async options + loading variant', () => {
  interface Tag {
    id: number;
    name: string;
  }

  /**
   * A paged `MlvDataSource` whose fetches resolve only when the spec calls
   * `flush()`, so "page in flight" is an observable state (jsdom gives every
   * element a zero-height box, so the panel's scroll sentinel can never fire
   * there — paging is driven through `setPage` directly).
   *
   * `_loading` flips **synchronously** with the request, per the `MlvDataSource`
   * contract, so `loading()` is already true on the tick the page is asked for.
   */
  class PagedTagSource extends MlvDataSource<Tag> {
    private readonly _slice = signal<Tag[]>([]);
    /** @private The pending page's resolution, run by `flush()`. */
    private _pending: (() => void) | null = null;

    readonly totalItems = signal(0);

    constructor(private readonly _all: Tag[]) {
      super();
      this._perPage.set(2);
      this.totalItems.set(_all.length);
      this._fetch();
    }

    connect(): Signal<Tag[]> {
      return this._slice.asReadonly();
    }

    override setPage(page: number): void {
      super.setPage(page);
      this._fetch();
    }

    /** Resolves the in-flight page request. */
    flush(): void {
      const pending = this._pending;
      this._pending = null;
      pending?.();
    }

    /** @private Starts a page request: loading now, slice on `flush()`. */
    private _fetch(): void {
      const page = this.page();
      const perPage = this.perPage();
      this._loading.set(true);
      this._pending = () => {
        this._slice.set(this._all.slice((page - 1) * perPage, page * perPage));
        this._loading.set(false);
      };
    }
  }

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="async"
      clearable
      [options]="options()"
      [searchFn]="searchFn()"
      [searchDebounce]="0"
      [toOption]="toOption"
      [compareWith]="compareWith"
      [loading]="loading()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<Tag>);
    readonly options = signal<MlvOptionsInput<Tag>>([]);
    readonly searchFn = signal<MlvOptionsSearchFn<Tag> | null>(null);
    readonly loading = signal(false);
    readonly value = signal<Tag | Tag[] | null>(null);
    readonly toOption = (t: Tag) => ({ label: t.name, value: t });
    readonly compareWith = (a: Tag, b: Tag) => a.id === b.id;
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
  });
  afterEach(() => overlayContainer.ngOnDestroy());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const host = () =>
    fixture.nativeElement.querySelector('mlv-select') as HTMLElement;
  const trigger = () =>
    fixture.nativeElement.querySelector('.mlv-select__trigger') as HTMLElement;
  const clearButton = () =>
    fixture.nativeElement.querySelector('.mlv-select__clear');
  const overlay = () => overlayContainer.getContainerElement();
  const pressKey = (key: string) =>
    trigger().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );

  it('renders the loading variant while a preset value has no option yet, then resolves', async () => {
    const subject = new Subject<Tag[]>();
    fixture.componentInstance.options.set(subject.asObservable());
    fixture.componentInstance.value.set({ id: 2, name: '' });
    await settle();
    expect(host().classList).toContain('mlv-select--loading');
    expect(trigger().getAttribute('aria-busy')).toBe('true');
    expect(trigger().getAttribute('tabindex')).toBe('0'); // still tabbable
    expect(
      fixture.nativeElement.querySelector('.mlv-select__arrow mlv-loader'),
    ).toBeTruthy();
    expect(trigger().textContent).toContain('Loading');
    expect(trigger().textContent).not.toContain('[object');
    fixture.componentInstance.select().toggleDropdown();
    expect(fixture.componentInstance.select().isOpen()).toBe(false);

    subject.next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    expect(host().classList).not.toContain('mlv-select--loading');
    expect(trigger().getAttribute('aria-busy')).toBeNull();
    expect(trigger().textContent).toContain('Beta');
    fixture.componentInstance.select().toggleDropdown();
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
  });

  it('does not enter the loading variant when the value already matches an option or there is no value', async () => {
    const subject = new Subject<Tag[]>();
    fixture.componentInstance.options.set(subject.asObservable());
    await settle();
    expect(host().classList).not.toContain('mlv-select--loading');
    fixture.componentInstance.options.set([{ id: 1, name: 'Alpha' }]);
    fixture.componentInstance.value.set({ id: 1, name: 'x' });
    await settle();
    expect(host().classList).not.toContain('mlv-select--loading');
    expect(trigger().textContent).toContain('Alpha');
  });

  it('shows the panel spinner row inside the open dropdown while the source loads (no close)', async () => {
    const subject = new Subject<Tag[]>();
    fixture.componentInstance.options.set(subject.asObservable());
    await settle();
    fixture.componentInstance.select().openDropdown();
    await settle();
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    subject.next([{ id: 1, name: 'Alpha' }]);
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
    expect(overlay().querySelector('.mlv-dropdown-panel__loading')).toBeNull();
    expect(overlay().querySelectorAll('[role="option"]').length).toBe(1);
  });

  it('[loading] input drives the panel spinner and the value-await variant', async () => {
    fixture.componentInstance.options.set([]);
    await settle();
    // Open first: once the variant engages the trigger is inert and cannot open.
    fixture.componentInstance.select().openDropdown();
    await settle();

    fixture.componentInstance.loading.set(true);
    fixture.componentInstance.value.set({ id: 9, name: '' });
    await settle();
    expect(host().classList).toContain('mlv-select--loading');
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();

    fixture.componentInstance.loading.set(false);
    await settle();
    // ready → falls back to the raw label (unchanged behaviour)
    expect(host().classList).not.toContain('mlv-select--loading');
    expect(overlay().querySelector('.mlv-dropdown-panel__loading')).toBeNull();
  });

  it('keeps the clear X while awaiting — the escape hatch for a source that never answers', async () => {
    fixture.componentInstance.options.set(new Subject<Tag[]>().asObservable());
    fixture.componentInstance.value.set({ id: 7, name: '' });
    await settle();
    expect(host().classList).toContain('mlv-select--loading');
    expect(clearButton()).not.toBeNull();

    // The label's click target still lands focus on the field — only the open
    // is suppressed — so the X is reachable by keyboard from there.
    fixture.componentInstance.select().openDropdown();
    await settle();
    expect(document.activeElement).toBe(trigger());
    expect(fixture.componentInstance.select().isOpen()).toBe(false);

    fixture.componentInstance.select().onClear();
    await settle();
    expect(fixture.componentInstance.value()).toBeNull();
    // No value left → nothing to await → the variant (and the X) are gone.
    expect(host().classList).not.toContain('mlv-select--loading');
    expect(clearButton()).toBeNull();
  });

  it('closes an already-open dropdown from the trigger even while inert', async () => {
    fixture.componentInstance.options.set([]);
    await settle();
    fixture.componentInstance.select().openDropdown();
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(true);

    // The variant engages under the open panel (a late consumer-driven load).
    fixture.componentInstance.loading.set(true);
    fixture.componentInstance.value.set({ id: 9, name: '' });
    await settle();
    expect(host().classList).toContain('mlv-select--loading');

    fixture.componentInstance.select().toggleDropdown();
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(false);
  });

  it('keeps a value committed while the rendered options change with the popup open (guard)', async () => {
    const subject = new Subject<Tag[]>();
    fixture.componentInstance.options.set(subject.asObservable());
    fixture.componentInstance.value.set({ id: 1, name: 'Alpha' });
    await settle();
    subject.next([{ id: 1, name: 'Alpha' }]); // label resolves → not awaiting
    await settle();
    fixture.componentInstance.select().openDropdown();
    await settle();
    subject.next([{ id: 2, name: 'Beta' }]); // Alpha vanishes from the rendered set → aria reconciles → emits []
    await settle();
    expect(fixture.componentInstance.value()).toEqual({ id: 1, name: 'Alpha' });
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
  });

  it('forwards data-source paging to the panel', async () => {
    const ds = new PagedTagSource([
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
      { id: 3, name: 'Three' },
      { id: 4, name: 'Four' },
    ]);
    fixture.componentInstance.options.set(ds);
    await settle();
    fixture.componentInstance.select().openDropdown();
    await settle();
    // Page one is still in flight — the panel shows the top spinner row.
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();

    ds.flush();
    await settle();
    expect(overlay().querySelectorAll('[role="option"]').length).toBe(2);
    expect(
      overlay().querySelector('.mlv-dropdown-panel__sentinel'),
    ).toBeTruthy();
    expect(overlay().querySelector('.mlv-dropdown-panel__loading')).toBeNull();

    // Page two: `[loadingMore]` renders the bottom status row (not the top
    // spinner) and the already-rendered options stay put.
    ds.setPage(2);
    await settle();
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading-more'),
    ).toBeTruthy();
    expect(overlay().querySelector('.mlv-dropdown-panel__loading')).toBeNull();
    expect(overlay().querySelectorAll('[role="option"]').length).toBe(2);

    ds.flush();
    await settle();
    expect(overlay().querySelectorAll('[role="option"]').length).toBe(4);
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading-more'),
    ).toBeNull();
  });

  it('loads a searchFn eagerly for a preset value and does not reload on open', async () => {
    const queries: string[] = [];
    const results = new Subject<Tag[]>();
    // A stable field-style reference (not an inline arrow) — the adapter's
    // swap effect must see exactly one function for the whole spec.
    const searchFn: MlvOptionsSearchFn<Tag> = (query) => {
      queries.push(query);
      return results.asObservable();
    };
    fixture.componentInstance.searchFn.set(searchFn);
    fixture.componentInstance.value.set({ id: 2, name: '' });
    await settle();

    // Eager: a committed value with no resolvable label loads without an open.
    expect(queries).toEqual(['']);
    expect(host().classList).toContain('mlv-select--loading');

    results.next([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ]);
    await settle();
    expect(host().classList).not.toContain('mlv-select--loading');
    expect(trigger().textContent).toContain('Beta');

    // `ensureLoaded()` is idempotent — opening does not re-run the function.
    fixture.componentInstance.select().openDropdown();
    await settle();
    expect(queries).toEqual(['']);
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
  });

  it('opens from the trigger keyboard, and not while awaiting a label', async () => {
    fixture.componentInstance.options.set([{ id: 1, name: 'Alpha' }]);
    await settle();

    pressKey('ArrowDown');
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(true);

    fixture.componentInstance.select().toggleDropdown(); // close
    await settle();
    pressKey('Home');
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(true);

    fixture.componentInstance.select().toggleDropdown(); // close
    await settle();
    // Loading variant on → every open path (including the keyboard) is inert.
    fixture.componentInstance.loading.set(true);
    fixture.componentInstance.value.set({ id: 9, name: '' });
    await settle();
    expect(host().classList).toContain('mlv-select--loading');
    pressKey('ArrowDown');
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(false);
  });
});

/**
 * Searchable mode: a sticky search field is stamped as the first row of the open
 * dropdown, the combobox semantics move from the trigger onto it while it is
 * open, and navigation switches to the WAI-ARIA activedescendant model (DOM
 * focus stays in the search input). Local sources filter by label; remote ones
 * (`searchFn` / data source) search server-side.
 */
describe('MlvSelect — searchable', () => {
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="fruit"
      label="Fruit"
      searchable
      required
      [options]="options()"
      [searchFn]="searchFn()"
      [searchDebounce]="0"
      [multiple]="multiple()"
      [toOption]="toOption()"
      [matcher]="matcher()"
      [searchPlaceholder]="searchPlaceholder()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
    readonly options = signal<MlvOptionsInput<string>>([
      'Apple',
      'Banana',
      'Cherry',
    ]);
    readonly searchFn = signal<MlvOptionsSearchFn<string> | null>(null);
    readonly multiple = signal(false);
    readonly toOption = signal<MlvSelectOptionTransform<string>>((s) => ({
      label: s,
      value: s,
    }));
    readonly matcher = signal<MlvOptionMatcher<string> | undefined>(undefined);
    readonly searchPlaceholder = signal<string | undefined>(undefined);
    readonly value = signal<string | string[] | null>(null);
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    overlayContainer = TestBed.inject(OverlayContainer);
  });
  afterEach(() => overlayContainer.ngOnDestroy());

  const overlay = () => overlayContainer.getContainerElement();
  const trigger = () =>
    fixture.nativeElement.querySelector('.mlv-select__trigger') as HTMLElement;
  const searchInput = () =>
    overlay().querySelector('.mlv-select__search input') as HTMLInputElement;
  const options = () =>
    Array.from(overlay().querySelectorAll<HTMLElement>('[role="option"]'));

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function open(): Promise<void> {
    fixture.componentInstance.select().openDropdown();
    await settle();
    // afterOpened → focus handoff
    await settle();
  }
  function type(text: string): void {
    const el = searchInput();
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function key(k: string): void {
    searchInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true }),
    );
    fixture.detectChanges();
  }
  /**
   * Drives the popup's leave animation to completion so the overlay detaches
   * and the select's `afterClosed` handler (focus restore + search reset) runs.
   * jsdom never fires `animationend` on its own.
   */
  async function finishClose(): Promise<void> {
    const panel = overlay().querySelector('.mlv-popup') as HTMLElement | null;
    panel?.dispatchEvent(new Event('animationend'));
    await settle();
  }

  it('pins the search field above the dropdown scroll region and focuses it', async () => {
    await open();
    const panel = overlay().querySelector('.mlv-popup') as HTMLElement;
    const search = overlay().querySelector(
      '.mlv-select__search',
    ) as HTMLElement;
    expect(search).toBeTruthy();
    // Projected into the popup's pinned slot, which lives outside the scroll
    // viewport — a long list can no longer scroll the search row away.
    const pinned = panel.querySelector('.mlv-popup__pinned') as HTMLElement;
    expect(pinned).toBeTruthy();
    expect(pinned.contains(search)).toBe(true);
    expect(
      overlay().querySelector('.mlv-scrollbar__viewport')?.contains(search),
    ).toBe(false);
    // DOM order: pinned row, then the scroll region holding the listbox.
    const children = Array.from(panel.children);
    const scrollbar = panel.querySelector(
      '.mlv-popup__scrollbar',
    ) as HTMLElement;
    expect(children.indexOf(pinned)).toBeLessThan(children.indexOf(scrollbar));
    expect(scrollbar.querySelector('[role="listbox"]')).toBeTruthy();
    expect(document.activeElement?.id).toBe('fruit-search');
    expect(searchInput().getAttribute('placeholder')).toBe('Search...');
  });

  it('exposes exactly one combobox: the search input while open, the trigger otherwise', async () => {
    expect(trigger().getAttribute('role')).toBe('combobox');
    expect(trigger().getAttribute('aria-required')).toBe('true');
    await open();
    // The trigger steps down to a plain button rather than losing its role —
    // a role-less div may carry no ARIA state, a button legitimately keeps
    // aria-expanded / aria-haspopup / aria-controls.
    expect(trigger().getAttribute('role')).toBe('button');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-controls')).toBe('fruit-listbox');
    // aria-required is invalid on button, so it is the one attribute dropped.
    expect(trigger().getAttribute('aria-required')).toBeNull();
    expect(
      overlay().querySelectorAll('[role="combobox"]').length +
        fixture.nativeElement.querySelectorAll('[role="combobox"]').length,
    ).toBe(1);
    expect(searchInput().getAttribute('role')).toBe('combobox');
    expect(searchInput().getAttribute('aria-expanded')).toBe('true');
    expect(searchInput().getAttribute('aria-autocomplete')).toBe('list');
    expect(searchInput().getAttribute('aria-controls')).toBe('fruit-listbox');
    expect(overlay().querySelector('#fruit-listbox')).toBeTruthy();
    fixture.componentInstance.select().isOpen.set(false);
    await settle();
    expect(trigger().getAttribute('role')).toBe('combobox');
  });

  it('filters locally as you type, highlights the match, and shows the i18n empty row', async () => {
    await open();
    type('an');
    await settle();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Banana']);
    expect(
      overlay().querySelector('.mlv-dropdown-panel__match')?.textContent,
    ).toBe('an');
    type('zzz');
    await settle();
    expect(options().length).toBe(0);
    expect(
      overlay().querySelector('.mlv-select__empty')?.textContent,
    ).toContain('No results found');
  });

  it('navigates with arrows via aria-activedescendant and commits with Enter (single closes + refocuses trigger)', async () => {
    await open();
    key('ArrowDown');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-0',
    );
    expect(
      overlay().querySelector('#fruit-listbox-option-0')?.classList,
    ).toContain('mlv-dropdown-panel__item--active');
    key('ArrowDown');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-1',
    );
    key('Enter');
    await settle();
    expect(fixture.componentInstance.value()).toBe('Banana');
    expect(fixture.componentInstance.select().isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it('multi: Enter toggles the active option and keeps the dropdown open', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();
    await open();
    key('ArrowDown');
    key('Enter');
    await settle();
    expect(fixture.componentInstance.value()).toEqual(['Apple']);
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
    key('ArrowDown');
    key('Enter');
    await settle();
    expect(fixture.componentInstance.value()).toEqual([]); // same option toggled off
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
  });

  it('still selects on an option click, with the mousedown swallowed so focus stays in the search field', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.detectChanges();
    await open();
    const option = options()[1];
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    option.dispatchEvent(mousedown);
    // The panel wrapper swallows it, so the browser never blurs the input.
    expect(mousedown.defaultPrevented).toBe(true);
    option.click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual(['Banana']);
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
    expect(document.activeElement?.id).toBe('fruit-search');
  });

  it('Escape closes and reverts the query; Tab closes and returns focus to the trigger', async () => {
    await open();
    type('ch');
    await settle();
    expect(options().length).toBe(1);
    key('Escape');
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(false);
    await finishClose();
    expect(fixture.componentInstance.select().searchQuery()).toBe('');
    await open();
    expect(options().length).toBe(3);
    key('Tab');
    await settle();
    expect(fixture.componentInstance.select().isOpen()).toBe(false);
    await finishClose();
    expect(document.activeElement).toBe(trigger());
  });

  it('remote searchFn: spinner row while searching, dropdown stays open, no local filtering', async () => {
    const subject = new Subject<string[]>();
    const queries: string[] = [];
    // A stable field-style reference — the adapter's swap effect must see
    // exactly one function for the whole spec.
    const searchFn: MlvOptionsSearchFn<string> = (q) => {
      queries.push(q);
      return subject.asObservable();
    };
    fixture.componentInstance.searchFn.set(searchFn);
    fixture.detectChanges();
    await open();
    expect(queries).toEqual(['']);
    expect(
      overlay().querySelector('.mlv-dropdown-panel__loading'),
    ).toBeTruthy();
    subject.next(['Remote A', 'Remote B']);
    await settle();
    expect(options().length).toBe(2);
    type('zzz');
    await settle();
    expect(queries).toEqual(['', 'zzz']);
    expect(fixture.componentInstance.select().isOpen()).toBe(true);
    expect(options().length).toBe(2); // stale kept, receded
    expect(
      overlay().querySelector('.mlv-dropdown-panel--loading'),
    ).toBeTruthy();
    subject.next(['Zed']);
    await settle();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Zed']);
  });

  it('announces the result count politely', async () => {
    await open();
    const status = fixture.nativeElement.querySelector(
      '.mlv-select__sr-status',
    ) as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('3 results available');
  });

  it('non-searchable select is unchanged (no search row, roving focus, mousedown not swallowed)', async () => {
    @Component({
      imports: [MlvSelect],
      template: `<mlv-select id="plain" required [options]="['a', 'b']" />`,
    })
    class PlainHost {
      readonly select = viewChild.required(MlvSelect<string>);
    }
    const f = TestBed.createComponent(PlainHost);
    f.detectChanges();
    f.componentInstance.select().openDropdown();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(overlay().querySelector('.mlv-select__search')).toBeNull();
    expect(overlay().querySelector('.mlv-select__empty')).toBeNull();

    const plainTrigger = f.nativeElement.querySelector('.mlv-select__trigger');
    expect(plainTrigger.getAttribute('role')).toBe('combobox');
    expect(plainTrigger.getAttribute('aria-required')).toBe('true');

    // Roving focus: aria keeps the listbox itself out of the tab order and
    // publishes no aria-activedescendant (both are activedescendant-only).
    const listbox = overlay().querySelector('#plain-listbox') as HTMLElement;
    expect(listbox.getAttribute('tabindex')).toBe('-1');
    expect(listbox.hasAttribute('aria-activedescendant')).toBe(false);

    // The panel wrapper must NOT swallow the mousedown default here, or roving
    // focus could never transfer to the clicked option.
    const panel = overlay().querySelector('.mlv-select__panel') as HTMLElement;
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    panel.dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(false);
  });

  it('filters within groups and keeps the search row above the first group header', async () => {
    const country: Record<string, string> = {
      Paris: 'France',
      Lyon: 'France',
      Berlin: 'Germany',
    };
    fixture.componentInstance.options.set(['Paris', 'Lyon', 'Berlin']);
    fixture.componentInstance.toOption.set((s) => ({
      label: s,
      value: s,
      group: country[s],
    }));
    await open();

    const search = overlay().querySelector(
      '.mlv-select__search',
    ) as HTMLElement;
    expect(search).toBeTruthy();
    // The pinned search row precedes the whole grouped listbox, not just the
    // options — and stays outside the scroll region the group headers pin to.
    const scrollbar = overlay().querySelector(
      '.mlv-popup__scrollbar',
    ) as HTMLElement;
    expect(scrollbar.contains(search)).toBe(false);
    expect(scrollbar.querySelector('[role="group"]')).toBeTruthy();
    expect(overlay().querySelectorAll('[role="group"]').length).toBe(2);
    expect(options().length).toBe(3);

    type('ber');
    await settle();
    expect(
      Array.from(
        overlay().querySelectorAll('.mlv-dropdown-panel__group-header'),
      ).map((h) => h.textContent?.trim()),
    ).toEqual(['Germany']);
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Berlin']);
  });

  it('applies a custom matcher to the local filter', async () => {
    // startsWith — 'an' matches nothing, unlike the default substring matcher
    // (which would return Banana).
    fixture.componentInstance.matcher.set((option, query) =>
      option.label.toLowerCase().startsWith(query.toLowerCase()),
    );
    await open();
    type('an');
    await settle();
    expect(options().length).toBe(0);
    type('ba');
    await settle();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Banana']);
  });

  it('prefers an explicit searchPlaceholder over the i18n default', async () => {
    fixture.componentInstance.searchPlaceholder.set('Find a fruit');
    await open();
    expect(searchInput().getAttribute('placeholder')).toBe('Find a fruit');
  });

  it('Home and End jump the active option to the ends of the filtered list', async () => {
    await open();
    key('End');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-2',
    );
    key('Home');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-0',
    );
  });

  it('re-announces the result count as the query narrows, then the empty copy', async () => {
    const status = () =>
      fixture.nativeElement.querySelector(
        '.mlv-select__sr-status',
      ) as HTMLElement;
    await open();
    expect(status().textContent).toContain('3 results available');
    type('an');
    await settle();
    expect(status().textContent).toContain('1 result available');
    type('zzz');
    await settle();
    expect(status().textContent).toContain('No results found');
  });

  it('drops a stale active index when a remote response shrinks the list', async () => {
    const subject = new Subject<string[]>();
    const searchFn: MlvOptionsSearchFn<string> = () => subject.asObservable();
    fixture.componentInstance.searchFn.set(searchFn);
    fixture.detectChanges();
    await open();
    subject.next(['Remote A', 'Remote B', 'Remote C']);
    await settle();

    // Type first (which resets the index), then navigate over the still-rendered
    // stale results while the newer query is in flight — all the way to the last
    // row, so the shrink below leaves the index exactly one past the new end.
    type('z');
    await settle();
    key('End');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-2',
    );

    subject.next(['Zed', 'Zulu']);
    await settle();
    expect(options().length).toBe(2);
    // Index 2 no longer exists — it must not dangle.
    expect(searchInput().getAttribute('aria-activedescendant')).toBeNull();
    // Discriminating: from a *reset* index the next ArrowDown lands on the first
    // row. Had the stale index 2 survived, `move(+1)` would wrap it modulo the
    // new count (`(2 + 1) % 2`) and land on option-1 instead.
    key('ArrowDown');
    expect(searchInput().getAttribute('aria-activedescendant')).toBe(
      'fruit-listbox-option-0',
    );
  });
});

describe('MlvSelect stylesheet — chevron flip + rotation origin', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(dir, 'select.scss'), 'utf8');

  it('rotates the arrow 180deg while open, driven by the existing open-state class', () => {
    const openBlock = scss.match(
      /&--open\s*{\s*\.#\{\$block\}__arrow\s*{([^}]*)}/,
    );
    expect(openBlock).toBeTruthy();
    expect(openBlock?.[1]).toContain('transform: rotate(180deg);');
  });

  it('fills the arrow box with its svg so rotation pivots on the glyph center', () => {
    const arrowBlock = scss.match(/&__arrow\s*{([\s\S]*?)\n {2}}/);
    expect(arrowBlock).toBeTruthy();
    expect(arrowBlock?.[1]).toContain('transform-origin: center;');
    expect(arrowBlock?.[1]).toMatch(
      /svg\s*{\s*width:\s*100%;\s*height:\s*100%;/,
    );
  });

  it('keeps the native select transparent without removing it from interaction', () => {
    const nativeBlock = scss.match(/&__native\s*{([\s\S]*?)\n {2}}/);
    expect(nativeBlock).toBeTruthy();
    expect(nativeBlock?.[1]).toContain('position: absolute;');
    expect(nativeBlock?.[1]).toContain('opacity: 0;');
    expect(nativeBlock?.[1]).not.toContain('visibility: hidden;');
  });
});

describe('MlvSelect — native mode', () => {
  @Component({
    imports: [MlvSelect],
    template: ` <mlv-select id="fruit" native [options]="options" /> `,
  })
  class NativeHostComponent {
    readonly options = ['Apple', 'Banana'];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NativeHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('renders a native select populated from options when native is present', async () => {
    const fixture = TestBed.createComponent(NativeHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement | null;

    expect(nativeSelect).toBeTruthy();
    expect(
      Array.from(nativeSelect?.options ?? []).map((option) => option.text),
    ).toEqual(['Select...', 'Apple', 'Banana']);
  });
});

class FakeSelectBreakpointService {
  readonly down = signal(false);

  isDown(_breakpoint: MlvBreakpoint) {
    return this.down;
  }
}

@Component({
  imports: [MlvSelect, MlvSelectItemTemplate, MlvSelectSelectedTemplate],
  template: `
    <mlv-select
      id="native-fruit"
      label="Fruit"
      [native]="nativeMode()"
      [multiple]="multiple()"
      [options]="options"
      [(value)]="value"
    >
      <ng-template mlvSelectItemTemplate let-option>
        <span data-item-template>{{ option.label }}</span>
      </ng-template>
      <ng-template mlvSelectSelectedTemplate let-values>
        <span data-selected-template>{{ values.length }} selected</span>
      </ng-template>
    </mlv-select>
  `,
})
class NativeModesHostComponent {
  readonly nativeMode = signal<MlvSelectNativeMode>(false);
  readonly multiple = signal(false);
  readonly value = signal<string | readonly string[] | null>(null);
  readonly options: MlvSelectOption<string>[] = [
    { label: 'Apple', value: 'apple', group: 'Fruit' },
    { label: 'Banana', value: 'banana', group: 'Fruit' },
    { label: 'Carrot', value: 'carrot', group: 'Vegetable', disabled: true },
  ];
}

describe('MlvSelect — native mode API and synchronization', () => {
  let breakpoint: FakeSelectBreakpointService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NativeModesHostComponent],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MlvBreakpointService,
          useClass: FakeSelectBreakpointService,
        },
      ],
    }).compileComponents();

    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeSelectBreakpointService;
  });

  function render(
    nativeMode: MlvSelectNativeMode = false,
    multiple = false,
  ): ComponentFixture<NativeModesHostComponent> {
    const fixture = TestBed.createComponent(NativeModesHostComponent);
    fixture.componentInstance.nativeMode.set(nativeMode);
    fixture.componentInstance.multiple.set(multiple);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps the custom dropdown when native is false', () => {
    const fixture = render(false);

    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.mlv-select__trigger'),
    ).toBeTruthy();
  });

  it('uses native mode below md when native is auto', () => {
    const fixture = render('auto');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();

    breakpoint.down.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeTruthy();

    breakpoint.down.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('renders groups and disabled state from normalized options', () => {
    const fixture = render(true);
    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;

    expect(nativeSelect.querySelectorAll('optgroup')).toHaveLength(2);
    expect(
      Array.from(nativeSelect.querySelectorAll('optgroup')).map((group) =>
        group.getAttribute('label'),
      ),
    ).toEqual(['Fruit', 'Vegetable']);
    expect(nativeSelect.options[3].disabled).toBe(true);
  });

  it('updates the model from a native single-select change', () => {
    const fixture = render(true);
    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;

    nativeSelect.value = '1';
    nativeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('banana');
    expect(
      fixture.nativeElement.querySelector('[data-selected-template]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.mlv-select__value')?.textContent,
    ).toContain('banana');
  });

  it('reflects a multi-select model in native option selection', () => {
    const fixture = render(true, true);
    fixture.componentInstance.value.set(['apple', 'banana']);
    fixture.detectChanges();

    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) => option.text),
    ).toEqual(['Apple', 'Banana']);
  });

  // The cases below pin the native selection to the *selectedness* of the
  // option elements rather than to a template binding. `selected` is a DOM
  // property domino does not implement, so binding it logged an NG0303 on
  // every server render (issue #135); it is now written onto the options from
  // a single `afterRenderEffect`, with `[attr.selected]` carrying the same
  // state into the server payload.
  //
  // The attribute alone would not do. Per the HTML spec an option carries a
  // "dirtiness" flag, set the moment the user picks in the select — and by
  // jsdom's `select.value` setter, which is how this suite simulates a pick.
  // Once it is set, adding or removing the `selected` content attribute no
  // longer changes selectedness, so the attribute would keep tracking the
  // model while the rendered control quietly stopped following it. That is
  // what the "after the user has picked" cases exist to catch.
  //
  // The next two are behavioural pins, not discriminating ones: a pristine
  // option still tracks its `selected` attribute, so both stay green against
  // an attribute-only implementation. They characterise the contract; the
  // "after the user has picked" pair is what fails without the property write.
  it('selects the placeholder while a single native select has no value', async () => {
    const fixture = render(true);
    await fixture.whenStable();

    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(nativeSelect.selectedIndex).toBe(0);
    expect(nativeSelect.options[0].selected).toBe(true);
    expect(nativeSelect.options[0].text.trim()).toBe('Select...');
  });

  it('moves the native selection when the model changes programmatically', async () => {
    const fixture = render(true);
    fixture.componentInstance.value.set('banana');
    await fixture.whenStable();

    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) => option.text),
    ).toEqual(['Banana']);
  });

  it('moves the native selection on a model change after the user has picked', async () => {
    const fixture = render(true);
    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;

    // Two picks, so *both* real options are dirty before the model is written
    // from code. One is not enough to characterise the attribute: adding
    // `selected` to a still-clean sibling clears the others, so a single-select
    // that only ever moves onto a clean option survives on the attribute alone.
    nativeSelect.value = '1';
    nativeSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('banana');

    nativeSelect.value = '0';
    nativeSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('apple');

    fixture.componentInstance.value.set('banana');
    await fixture.whenStable();
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) => option.text),
    ).toEqual(['Banana']);

    // And back to nothing: the placeholder has to take the selection again, or
    // the control keeps showing a value the model no longer holds.
    fixture.componentInstance.value.set(null);
    await fixture.whenStable();
    expect(nativeSelect.options[0].selected).toBe(true);
  });

  it('moves the native multi-selection on a model change after the user has picked', async () => {
    const fixture = render(true, true);
    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;

    nativeSelect.value = '0';
    nativeSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toEqual(['apple']);

    fixture.componentInstance.value.set(['banana']);
    await fixture.whenStable();
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) => option.text),
    ).toEqual(['Banana']);
  });

  it('restores the native selection when auto mode re-creates the select', async () => {
    const fixture = render('auto');
    fixture.componentInstance.value.set('banana');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();

    breakpoint.down.set(true);
    await fixture.whenStable();

    // A fresh set of option elements, so the effect has to re-run off the
    // view-query signal rather than off a selection change — nothing about the
    // model moved here.
    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(
      Array.from(nativeSelect.selectedOptions).map((option) => option.text),
    ).toEqual(['Banana']);
  });

  it('carries the committed selection as an attribute, so a server render can serialise it', async () => {
    const fixture = render(true);
    fixture.componentInstance.value.set('banana');
    await fixture.whenStable();

    const nativeSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(
      Array.from(nativeSelect.options)
        .filter((option) => option.hasAttribute('selected'))
        .map((option) => option.text),
    ).toEqual(['Banana']);
  });
});

/**
 * The value-vs-options cross-checks — `_allValuesMatched` and
 * `_applyPendingValues` — used to be nested `selected × options` scans, re-run
 * on every option-list change. `resolvedOptions()` is the **accumulated**
 * lazily-paged list, so every page append re-ran the whole scan and the total
 * cost of a scroll session grew quadratically. Both now share one `valueIndex`
 * over the resolved option values.
 *
 * `defaultCompareWith` cannot be wrapped in a spy — `valueIndex` recognises it
 * *by reference*, so a wrapper would silently take the pairwise path and
 * measure nothing. The observable channel is instead a counting `value`
 * accessor on the options `toOption` produces: a scan that reaches through
 * `option.value` increments it, a scan over the values already extracted into
 * the index does not.
 *
 * (That the index itself takes its `Map` fast path for an identity comparator
 * — rather than a pairwise scan of the extracted values — is guarded at the
 * unit level, in `reconciliation.spec.ts`.)
 */
describe('MlvSelect — value-vs-options cost', () => {
  const PAGE = 500;
  const pages = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: PAGE }, (_, i) => `p${p}-${i}`),
  );

  /** Reads of any resolved option's `value`, across every consumer. */
  let valueReads = 0;

  const countingToOption = (item: string) => {
    const option = { label: item } as { label: string; value: string };
    Object.defineProperty(option, 'value', {
      get: () => {
        valueReads++;
        return item;
      },
      enumerable: true,
      configurable: true,
    });
    return option;
  };

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="perf"
      multiple
      loading
      [options]="options()"
      [toOption]="toOption"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
    readonly options = signal<string[]>(pages[0]);
    readonly value = signal<string[] | null>(null);
    readonly compareWith =
      signal<(a: string, b: string) => boolean>(defaultCompareWith);
    readonly toOption = countingToOption;
  }

  beforeEach(async () => {
    valueReads = 0;
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  /**
   * Commits `selected` values and returns the fixture. The last committed value
   * is deliberately **absent** from the options, so `_allValuesMatched` cannot
   * short-circuit on an early miss; the present values sit at the **end** of
   * page 0, so a pairwise `some()` cannot short-circuit near the front and
   * under-report either.
   */
  function commit(
    selected: number,
    compare = defaultCompareWith as (a: string, b: string) => boolean,
  ): ComponentFixture<HostComponent> {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.compareWith.set(compare);
    host.value.set([...pages[0].slice(PAGE - (selected - 1)), 'not-an-option']);
    fixture.detectChanges();
    return fixture;
  }

  /** `.value` reads caused by appending one more page of options. */
  function readsForAppend(
    fixture: ComponentFixture<HostComponent>,
    upToPage: number,
  ): number {
    valueReads = 0;
    fixture.componentInstance.options.set(pages.slice(0, upToPage + 1).flat());
    fixture.detectChanges();
    return valueReads;
  }

  it('costs nothing at all when nothing is selected', () => {
    // The regression an eagerly-built index causes, and the reason `valueIndex`
    // walks nothing until its first query: `_applyPendingValues` asks for the
    // index on **every** option-list change, and with no committed value it
    // then queries it zero times. `_allValuesMatched` is never evaluated either
    // (`hasValue()` short-circuits both `_awaitingValueLabel` and the adapter's
    // `eager` gate), so a page append must cost exactly nothing.
    //
    // A purely differential assertion cannot see this: the cost is constant in
    // the selection size, so it cancels out of every difference.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    valueReads = 0;
    fixture.componentInstance.options.set([...pages[0], ...pages[1]]);
    fixture.detectChanges();
    expect(valueReads).toBe(0);
  });

  it('costs at most one walk of the accumulated options per page append', () => {
    // The absolute companion to the differential test below. One walk builds
    // the index; every query after that is O(1). A nested scan would be ~50x
    // this at 50 committed values.
    const accumulated = 2 * PAGE;
    expect(readsForAppend(commit(1), 1)).toBeLessThanOrEqual(accumulated + 4);
    expect(readsForAppend(commit(50), 1)).toBeLessThanOrEqual(
      accumulated + 4 * 50,
    );
  });

  it('costs the same per page append whether 1 or 50 values are selected', () => {
    // Differential, so no magic constant is needed:
    //   fast path  reads(R) = c × options + O(R)   — options term independent of R
    //   nested     reads(R) = c × options + R × options
    const one = readsForAppend(commit(1), 1);
    const fifty = readsForAppend(commit(50), 1);
    expect(fifty - one).toBeLessThan(PAGE);
  });

  it('stays linear in the accumulated option count as pages arrive', () => {
    // The motivating scenario: 50 committed values, four pages appended one at
    // a time. Each append may re-walk the accumulated list a constant number of
    // times; it may not walk it once per committed value.
    const fixture = commit(50);
    for (let page = 1; page < pages.length; page++) {
      const accumulated = PAGE * (page + 1);
      expect(readsForAppend(fixture, page)).toBeLessThan(3 * accumulated);
    }
  });

  it('keeps the pairwise scan for a custom comparator', () => {
    // A consumer-supplied comparator must not be routed through a keyed
    // container — its equivalence relation is unknown. Comparator calls
    // therefore still scale with the committed selection.
    const calls = (selected: number) => {
      let count = 0;
      const custom = (a: string, b: string) => {
        count++;
        return a === b;
      };
      readsForAppend(commit(selected, custom), 1);
      return count;
    };
    expect(calls(50) - calls(1)).toBeGreaterThan(PAGE);
  });
});

/**
 * End-to-end proof that the identity fast path is exactly the comparator it
 * stands in for. `Set`/`Map` membership is SameValueZero, which agrees with
 * neither identity comparator: `===` and SameValueZero differ on `(NaN, NaN)`,
 * `Object.is` and SameValueZero on `(+0, -0)`. `valueIndex` bails to the
 * pairwise path on those, and these assertions read the result of that bail
 * through the control's public surface.
 *
 * `[loading]` pins `_ready()` false, so the loading variant
 * (`.mlv-select--loading`) appears exactly when `_allValuesMatched` is false —
 * which makes an internal computed observable without reaching into it.
 */
describe('MlvSelect — identity comparator edge values', () => {
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="edge"
      loading
      [options]="options()"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<number>);
    readonly options = signal<number[]>([]);
    readonly value = signal<number | number[] | null>(null);
    readonly compareWith =
      signal<(a: number, b: number) => boolean>(defaultCompareWith);
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  /** Whether `_allValuesMatched` came out false, read off the loading variant. */
  const awaitingLabel = () =>
    (
      fixture.nativeElement.querySelector('mlv-select') as HTMLElement
    ).classList.contains('mlv-select--loading');
  const committed = () =>
    fixture.componentInstance.select().selectionService.selectedValues()[0];

  function setup(
    options: number[],
    value: number,
    compare?: (a: number, b: number) => boolean,
  ): void {
    if (compare) fixture.componentInstance.compareWith.set(compare);
    fixture.componentInstance.options.set(options);
    fixture.componentInstance.value.set(value);
    fixture.detectChanges();
  }

  it('a committed NaN never matches a NaN option under the `===` default', () => {
    // `NaN === NaN` is false. A `Map` keyed on NaN would say the value matched
    // and drop the loading variant.
    setup([Number.NaN], Number.NaN);
    expect(awaitingLabel()).toBe(true);
    expect(Object.is(committed(), Number.NaN)).toBe(true);
  });

  it('a committed NaN DOES match a NaN option under Object.is', () => {
    setup([Number.NaN], Number.NaN, Object.is);
    expect(awaitingLabel()).toBe(false);
  });

  it('a committed -0 matches a +0 option under `===` — and takes its instance', () => {
    // `+0 === -0`, so the option matches; `_applyPendingValues` then replaces
    // the written `-0` with the option's own `+0`, exactly as the pairwise
    // `options.find(...)?.value ?? v` always did. Not a no-op — the sign flips.
    setup([0], -0);
    expect(awaitingLabel()).toBe(false);
    expect(Object.is(committed(), 0)).toBe(true);
    expect(Object.is(committed(), -0)).toBe(false);
  });

  it('a committed -0 does NOT match a +0 option under Object.is (hazard on the querying side)', () => {
    // The option list is hazard-free, so the index is keyed — but a queried -0
    // must still be answered pairwise, or SameValueZero would conflate it.
    setup([0], -0, Object.is);
    expect(awaitingLabel()).toBe(true);
    expect(Object.is(committed(), -0)).toBe(true);
  });

  it('a committed +0 does NOT match a -0 option under Object.is (hazard on the keyed side)', () => {
    setup([-0], 0, Object.is);
    expect(awaitingLabel()).toBe(true);
    expect(Object.is(committed(), 0)).toBe(true);
  });

  it('an empty option list leaves every committed value unmatched and unchanged', () => {
    setup([], 7);
    expect(awaitingLabel()).toBe(true);
    expect(committed()).toBe(7);
  });

  it('an empty selection is matched vacuously, whatever the options', () => {
    fixture.componentInstance.options.set([1, 2, 3]);
    fixture.detectChanges();
    expect(awaitingLabel()).toBe(false);
  });
});

/**
 * `_isNativeOptionSelected` is the sixth value-vs-options check and the worst
 * of them: it is a template **method**, called once per rendered native
 * `<option>` on *every* change-detection pass of the native branch — not only
 * when a signal changes. It resolves through `_selectedValueIndex`, a second
 * `valueIndex` keyed on `selectedValues()` + `compareWith()` (the option-side
 * `_optionValueIndex` invalidates on a different signal and cannot serve it).
 *
 * **The haystack is the selection, not the options.** This site calls
 * `compare(selected, value)` — transposed relative to the other five, which
 * call `compare(option.value, committedValue)`. `valueIndex` applies
 * `compare(indexedValue, queriedValue)`, so only indexing the selection
 * reproduces the original order. A `compareWith` is not required to be
 * symmetric, so the asymmetric-comparator test below pins that down; no
 * symmetric comparator anywhere in this suite would notice a flip.
 */
describe('MlvSelect — native option selection cost', () => {
  const V = 300;
  const R = 20;
  const PASSES = 5;
  const options = Array.from({ length: V }, (_, i) => `o${i}`);

  /** Counts element reads, the way `reconciliation.spec.ts` does. */
  function countingArray<T>(values: readonly T[]): {
    array: T[];
    reads: () => number;
  } {
    let reads = 0;
    const array: T[] = [];
    array.length = values.length;
    values.forEach((value, index) => {
      Object.defineProperty(array, String(index), {
        get: () => {
          reads++;
          return value;
        },
        enumerable: true,
        configurable: true,
      });
    });
    return { array, reads: () => reads };
  }

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="native-perf"
      multiple
      [native]="true"
      [label]="label()"
      [options]="options"
      [compareWith]="compareWith"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
    /** Changing this marks the OnPush select dirty without touching selection or options. */
    readonly label = signal('A');
    readonly options = options;
    readonly value = signal<string[] | null>(null);
    compareWith: (a: string, b: string) => boolean = defaultCompareWith;
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  const nativeSelect = () =>
    fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  const selectedTexts = () =>
    Array.from(nativeSelect().selectedOptions).map((option) => option.text);

  /** `PASSES` change-detection passes driven by an input unrelated to the selection. */
  function repaint(tag: string): void {
    for (let pass = 0; pass < PASSES; pass++) {
      fixture.componentInstance.label.set(`${tag}${pass}`);
      fixture.detectChanges();
    }
  }

  it('walks the selection once per selection change, not once per option per pass', () => {
    fixture.detectChanges();
    expect(nativeSelect().options.length).toBe(V);

    // Three distinct selections, each followed by PASSES repaints. Every
    // repaint re-runs all V per-option tests (the `selectedOptions` assertion
    // below is what proves the binding really re-ran and produced fresh
    // output), but the index is rebuilt once per selection — so each array is
    // walked exactly R times, never R × V × PASSES.
    for (const start of [0, 40, 100]) {
      const slice = options.slice(start, start + R);
      const counted = countingArray(slice);
      fixture.componentInstance
        .select()
        .selectionService.setValues(counted.array);
      fixture.detectChanges();
      repaint(`sel${start}-`);

      expect(selectedTexts()).toEqual(slice);
      // Exactly R, not "at most R": one walk to build the index and nothing
      // else. `_allValuesMatched` is the only other member that iterates
      // `selectedValues()`, and it is never evaluated in this fixture — an
      // array source is `ready()` immediately, so `_awaitingValueLabel`
      // short-circuits at `!_ready()`, and the adapter's `eager` gate is not
      // read for a non-`searchFn` source. If that precondition ever changes the
      // figure becomes 2 × R, still constant in V and PASSES, which is the
      // property this guards.
      expect(counted.reads()).toBe(R);
    }
  });

  it('keeps the pairwise scan, unchanged, for a custom comparator', () => {
    // Also the evidence that a repaint really re-runs all V bindings: the count
    // below is exact, and would be 0 if the view were never re-checked.
    let calls = 0;
    fixture.componentInstance.compareWith = (a: string, b: string) => {
      calls++;
      return a === b;
    };
    fixture.detectChanges();
    fixture.componentInstance.value.set(options.slice(0, R));
    fixture.detectChanges();
    expect(selectedTexts()).toEqual(options.slice(0, R));

    calls = 0;
    repaint('cmp');

    // Per pass: V per-option tests; each scans the R committed values until it
    // matches. The R selected options sit at indices 0..R-1, so they match at
    // position i (i + 1 comparisons); the other V - R scan all R.
    const perPass = (R * (R + 1)) / 2 + (V - R) * R;
    expect(calls).toBe(PASSES * perPass);
  });

  /** Numeric host: the SameValueZero hazard needs `NaN`, not strings. */
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="native-hazard"
      multiple
      [native]="true"
      [options]="options"
      [(value)]="value"
    />`,
  })
  class HazardHostComponent {
    readonly select = viewChild.required(MlvSelect<number>);
    readonly options = [Number.NaN, 1];
    readonly value = signal<number[] | null>(null);
  }

  it('never reports a committed NaN as a selected option under the `===` default', () => {
    // A bare `Set(selectedValues())` — SameValueZero — would say the NaN option
    // is selected. `===` says it is not, and `valueIndex` bails to the pairwise
    // scan to keep saying so.
    const hazard = TestBed.createComponent(HazardHostComponent);
    hazard.detectChanges();
    hazard.componentInstance.value.set([Number.NaN, 1]);
    hazard.detectChanges();

    const select = hazard.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(Array.from(select.selectedOptions).map((o) => o.text)).toEqual([
      '1',
    ]);
  });

  /** Case-insensitive host: swapping `compareWith` at runtime must re-render. */
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="native-swap"
      multiple
      [native]="true"
      [options]="options"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class SwapHostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
    readonly options = ['A', 'B', 'C'];
    readonly value = signal<string[] | null>(null);
    readonly compareWith =
      signal<(a: string, b: string) => boolean>(defaultCompareWith);
  }

  it('follows a `compareWith` swapped at runtime while the native branch renders', () => {
    const swap = TestBed.createComponent(SwapHostComponent);
    swap.detectChanges();
    swap.componentInstance.value.set(['b']);
    swap.detectChanges();

    const select = swap.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    // `===`: lowercase 'b' matches no option.
    expect(Array.from(select.selectedOptions)).toEqual([]);

    swap.componentInstance.compareWith.set(
      (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    );
    swap.detectChanges();

    expect(Array.from(select.selectedOptions).map((o) => o.text)).toEqual([
      'B',
    ]);
  });

  it('preserves the compare(selected, optionValue) argument order', () => {
    // Deliberately ASYMMETRIC: true only when the first argument is a committed
    // value and the second is an option value. `compare(a, b) !== compare(b, a)`
    // for every pair here, so indexing the option side instead of the selection
    // side — which transposes the arguments — makes every test return false and
    // nothing renders as selected. A symmetric comparator cannot see this.
    const asymmetric = (a: string, b: string) =>
      a.startsWith('sel:') && b.startsWith('opt:') && a.slice(4) === b.slice(4);
    expect(asymmetric('sel:b', 'opt:b')).toBe(true);
    expect(asymmetric('opt:b', 'sel:b')).toBe(false);

    fixture.componentInstance.compareWith = asymmetric;
    (fixture.componentInstance as { options: string[] }).options = [
      'opt:a',
      'opt:b',
      'opt:c',
    ];
    fixture.detectChanges();
    // Written as a `sel:` value; no option matches it in the `compare(option,
    // written)` direction, so `_applyPendingValues` leaves it exactly as
    // written — the selection really does hold the `sel:` form.
    fixture.componentInstance.value.set(['sel:b']);
    fixture.detectChanges();

    expect(
      fixture.componentInstance.select().selectionService.selectedValues(),
    ).toEqual(['sel:b']);
    expect(selectedTexts()).toEqual(['opt:b']);
  });
});
/**
 * Argument-order coverage for the **option-side** index. `_allValuesMatched`,
 * `_chipOptions` and `_applyPendingValues` all call
 * `compare(option.value, committedValue)`, and `valueIndex` applies
 * `compare(indexedValue, queriedValue)` — so the option list must be the
 * indexed side. Every other comparator in this suite (`===`, `Object.is`,
 * `(a, b) => a.id === b.id`) is **symmetric** and cannot see a transposition;
 * these two can, from both directions.
 *
 * A consumer's `compareWith` is an arbitrary predicate and is under no
 * obligation to be symmetric, so this is a real behaviour contract, not a
 * stylistic one.
 */
describe('MlvSelect — option-side comparator argument order', () => {
  /**
   * True only when the OPTION value is the first argument. Reflexive on option
   * values (so it survives `_applyPendingValues` rewriting the committed value
   * onto the option instance), but `optionFirst('opt:b', 'sel:b')` is `true`
   * while `optionFirst('sel:b', 'opt:b')` is `false` — the asymmetry a
   * transposition trips over.
   */
  const optionFirst = (a: string, b: string) =>
    a.startsWith('opt:') && a.slice(4) === b.slice(4);
  /** The transpose: true only in the order the sites must NOT use. */
  const selectionFirst = (a: string, b: string) => optionFirst(b, a);

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="order"
      loading
      [options]="options"
      [compareWith]="compareWith()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
    readonly options = ['opt:a', 'opt:b'];
    readonly value = signal<string | string[] | null>(null);
    readonly compareWith =
      signal<(a: string, b: string) => boolean>(optionFirst);
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  const awaitingLabel = () =>
    (
      fixture.nativeElement.querySelector('mlv-select') as HTMLElement
    ).classList.contains('mlv-select--loading');
  const committed = () =>
    fixture.componentInstance.select().selectionService.selectedValues();

  function setup(compare: (a: string, b: string) => boolean): void {
    fixture.componentInstance.compareWith.set(compare);
    fixture.detectChanges();
    fixture.componentInstance.value.set('sel:b');
    fixture.detectChanges();
  }

  it('matches when the option value is compare()`s FIRST argument', () => {
    setup(optionFirst);
    expect(committed()).toEqual(['opt:b']);
    expect(awaitingLabel()).toBe(false);
  });

  it('does not match when only the TRANSPOSED order would', () => {
    setup(selectionFirst);
    expect(committed()).toEqual(['sel:b']);
    expect(awaitingLabel()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stylesheet — compiled once; assertions read declarations by selector.
// ---------------------------------------------------------------------------

// `sass` is a Node-only dependency; loading it through `createRequire` keeps
// it out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

/**
 * Declarations of every emitted rule whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule and emits
 * shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function cssRule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head
      .trim()
      .split(/,\s*/)
      .map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

describe('MlvSelect stylesheet', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(dirname(fileURLToPath(import.meta.url)), 'select.scss'),
    ).css,
  );

  // A control with no value shows its `placeholder` as a rendered span where
  // an input shows it through `::placeholder`. Both are placeholder text and
  // read the same token — `--mlv-text-tertiary`, the placeholder/disabled step
  // of the text ramp that mlv-input, mlv-textarea and mlv-number-input use —
  // so a form that mixes the controls shows one placeholder grey, not two.
  it('paints the placeholder with the shared placeholder token', () => {
    expect(cssRule(css, '.mlv-select__placeholder')).toContain(
      'color: var(--mlv-text-tertiary)',
    );
  });
});

/**
 * `NaN` is the one value on which `===` (the default `compareWith`) and
 * SameValueZero (`Set` membership) disagree, and the dropdown panel used to
 * gate its check-mark on a `Set`. Nothing in `mlv-select` masked it: the
 * `options.resolve()` normalisation that hides the *object* half of #132
 * cannot collapse `NaN` onto its option either, so the panel ticked a row the
 * selection service reported unselected.
 */
describe('MlvSelect — NaN never renders a phantom check-mark (#132)', () => {
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select id="num" [options]="options" />`,
  })
  class HostComponent {
    options = [NaN, 1];
  }

  /** The same options, but with the one comparator that recognises `NaN`. */
  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="num-is"
      [options]="options"
      [compareWith]="cmp"
    />`,
  })
  class ObjectIsHostComponent {
    options = [NaN, 1];
    readonly cmp = Object.is;
  }

  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, ObjectIsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  it('ticks no row for a committed NaN, agreeing with isSelected', async () => {
    // `ngListbox.validate()` finds duplicates with `values.indexOf(val) !== idx`
    // and `indexOf` never matches NaN, so a listbox holding *one* NaN option is
    // always reported as holding a duplicate; it then logs the element with
    // `console.warn('… %o:', el)`, which Node's `%o` formatter cannot walk in
    // jsdom. Both halves are upstream and independent of the selection.
    // Only those two lines are dropped — anything else this library warns
    // about still reaches the real `console.warn` rather than hiding here.
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        (first.startsWith('Violations found on element:') ||
          first.startsWith('Duplicate option value'))
      ) {
        return;
      }
      (warn as (...rest: unknown[]) => void)(...args);
    };
    try {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const select = fixture.debugElement.query(By.directive(MlvSelect))
        .componentInstance as MlvSelect<number>;

      select.value.set(NaN);
      select.openDropdown();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Positive control: the panel is open with both rows rendered, so a zero
      // check-mark count below cannot come from an empty listbox.
      expect(overlayEl.querySelectorAll('[role="option"]').length).toBe(2);
      // Every other membership check in the stack says nothing is selected.
      expect(select.selectionService.isSelected(NaN)).toBe(false);

      expect(
        overlayEl.querySelectorAll('.mlv-dropdown-panel__item-check').length,
      ).toBe(0);
    } finally {
      console.warn = warn;
    }
  });

  it('still shows NaN in the trigger, which the tick and isSelected both deny', async () => {
    // The residual disagreement, pinned rather than papered over. `NaN` is
    // simply not a selectable value here: `===` is the default comparator and
    // `NaN === NaN` is false, so `isSelected` denies a value the service is
    // holding, and no row can tick. The trigger nonetheless renders it,
    // because `displayValue` maps `selectedValues()` through `toOption`
    // directly — it does not require the value to have matched an option, and
    // must not: a committed value with no option (`5` against `[1, 2]`) is a
    // *supported* state where `isSelected` is true and the trigger is the only
    // thing that can show it.
    //
    // Fixing this in the display would therefore mean special-casing NaN in
    // value rendering, which just moves the incoherence somewhere less
    // visible. Documented instead, in `.claude/projects/libs-dropdown.md`
    // § Check-mark identity.
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        (first.startsWith('Violations found on element:') ||
          first.startsWith('Duplicate option value'))
      ) {
        return;
      }
      (warn as (...rest: unknown[]) => void)(...args);
    };
    try {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const select = fixture.debugElement.query(By.directive(MlvSelect))
        .componentInstance as MlvSelect<number>;

      select.value.set(NaN);
      select.openDropdown();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // The service is holding the value…
      expect(select.hasValue()).toBe(true);
      expect(select.displayValue).toBe('NaN');
      expect(
        (
          fixture.nativeElement.querySelector(
            '.mlv-select__trigger',
          ) as HTMLElement
        ).textContent?.trim(),
      ).toBe('NaN');
      // …and denying that it is selected, because `===` cannot see it.
      expect(select.selectionService.isSelected(NaN)).toBe(false);
      expect(
        overlayEl.querySelectorAll('.mlv-dropdown-panel__item-check').length,
      ).toBe(0);
      expect(
        [...overlayEl.querySelectorAll<HTMLElement>('[role="option"]')].map(
          (row) => row.getAttribute('aria-selected'),
        ),
      ).toEqual(['false', 'false']);
    } finally {
      console.warn = warn;
    }
  });

  it('is not rescued by compareWith=Object.is — aria matches options with ===', async () => {
    // The obvious escape hatch, pinned as *not* working so the documentation
    // above cannot drift into recommending it. `Object.is(NaN, NaN)` is true,
    // so the selection service and the panel's check-mark would both accept
    // the value — but `@angular/aria` matches values to options with `===` in
    // three places it owns (`validate`, the option's `aria-selected`, and the
    // reconciliation `afterRenderEffect`), none of which take a comparator. So
    // the moment the listbox renders, aria filters the NaN out and re-emits;
    // `mlv-select` reads that as a genuine deselect (the option *is* visible,
    // so it is not filtered-out-committed) and drops the value. The trigger
    // falls back to the placeholder.
    //
    // Verified to behave identically before the #132 panel fix, so this is
    // upstream, not a consequence of normalising the panel's aria value.
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        (first.startsWith('Violations found on element:') ||
          first.startsWith('Duplicate option value'))
      ) {
        return;
      }
      (warn as (...rest: unknown[]) => void)(...args);
    };
    try {
      const fixture = TestBed.createComponent(ObjectIsHostComponent);
      fixture.detectChanges();
      const select = fixture.debugElement.query(By.directive(MlvSelect))
        .componentInstance as MlvSelect<number>;

      select.value.set(NaN);
      select.openDropdown();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(select.selectionService.selectedValues()).toEqual([]);
      expect(select.displayValue).toBe('');
      expect(
        overlayEl.querySelectorAll('.mlv-dropdown-panel__item-check').length,
      ).toBe(0);
    } finally {
      console.warn = warn;
    }
  });
});

/**
 * #150 — the dropdown takes the trigger's measured width as a **floor**, never
 * as an exact width, so an option longer than the trigger grows the panel
 * instead of being clipped (the reported case: a trigger sized to `tight`
 * rendering "comfortable" as "comforta").
 *
 * jsdom runs no layout, so "the panel grew" is asserted where the constraint is
 * actually expressed — the CDK overlay pane's own inline sizing. An exact
 * `width` pins the pane to the trigger's box (the bug); a `min-width` with no
 * `width` leaves the pane a `fit-content` flex item inside the flexible
 * bounding box (the fix), free to grow to its content.
 *
 * The same bounding box is the viewport clamp, so no `maxWidth` of ours is
 * needed: CDK sizes it to the space between the trigger and the viewport edge
 * and `.cdk-overlay-pane { max-width: 100% }` (CDK's own stylesheet) caps the
 * pane at that box.
 */
describe('MlvSelect — dropdown panel width (#150)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** Trigger box: 200px wide, 40px from the viewport's inline-start edge. */
  const TRIGGER_RECT = {
    x: 40,
    y: 100,
    left: 40,
    top: 100,
    right: 240,
    bottom: 132,
    width: 200,
    height: 32,
  };
  /** A label far wider than the 200px trigger. */
  const LONG_OPTION = 'comfortable — the density every control starts at';

  interface Tag {
    id: number;
    name: string;
  }

  /** A two-page source whose second page never resolves, so `loadingMore` sticks. */
  class PagedSource extends MlvDataSource<Tag> {
    private readonly _slice = signal<Tag[]>([]);
    readonly totalItems = signal(4);

    constructor(private readonly _all: Tag[]) {
      super();
      this._perPage.set(2);
      this.totalItems.set(_all.length);
      this._slice.set(_all.slice(0, 2));
      this._loading.set(false);
    }

    connect(): Signal<Tag[]> {
      return this._slice.asReadonly();
    }

    override setPage(page: number): void {
      super.setPage(page);
      // Never resolves: the point is the panel's `loadingMore` status row.
      this._loading.set(true);
    }
  }

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select
      id="width"
      [options]="options()"
      [toOption]="toOption"
      [searchable]="searchable()"
      [multiple]="multiple()"
      [loading]="loading()"
      [dropdownMinWidth]="dropdownMinWidth()"
      [dropdownMaxWidth]="dropdownMaxWidth()"
      [(value)]="value"
    />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string | Tag>);
    readonly dropdownMinWidth = signal<number | string | undefined>(undefined);
    readonly dropdownMaxWidth = signal<number | string | undefined>(undefined);
    readonly options = signal<MlvOptionsInput<string | Tag>>([
      'compact',
      LONG_OPTION,
      'spacious',
    ]);
    readonly searchable = signal(false);
    readonly multiple = signal(false);
    readonly loading = signal(false);
    readonly value = signal<string | Tag | (string | Tag)[] | null>(null);
    readonly toOption = (option: string | Tag) =>
      typeof option === 'string'
        ? { label: option, value: option }
        : { label: option.name, value: option };
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, rect: Record<string, number>): void {
    const full = { toJSON: () => rect, ...rect };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  /** jsdom reports `documentElement.clientWidth === 0`; CDK reads it as the viewport. */
  function stubViewport(): void {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);
    stubViewport();
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** Measures the trigger through the real `mlvResizeObserver` path, then opens. */
  async function open(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-select__trigger',
    ) as HTMLElement;
    // The overlay's origin is the popup container, not the trigger it wraps.
    stubRect(
      fixture.nativeElement.querySelector('mlv-popup-container') as Element,
      TRIGGER_RECT,
    );
    stubRect(trigger, TRIGGER_RECT);
    fixture.componentInstance
      .select()
      .updateTriggerWidth([
        { target: trigger } as unknown as ResizeObserverEntry,
      ]);
    fixture.componentInstance.select().openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const pane = () =>
    overlayContainer
      .getContainerElement()
      .querySelector('.cdk-overlay-pane') as HTMLElement;
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;
  const panelText = () =>
    overlayContainer.getContainerElement().textContent ?? '';

  it('floors the panel at the trigger width instead of pinning it', async () => {
    await open();

    // The option that does not fit the trigger is rendered in full…
    expect(panelText()).toContain(LONG_OPTION);
    // …because the pane may grow past the trigger: a floor, not a fixed box.
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('raises the floor to an explicit dropdownMinWidth', async () => {
    fixture.componentInstance.dropdownMinWidth.set('30rem');
    await open();

    // Both bounds survive as a CSS `max()`, so the units resolve in the
    // browser rather than being converted to px in TypeScript.
    expect(pane().style.minWidth).toBe('max(200px, 30rem)');
    expect(pane().style.width).toBe('');
  });

  it('never lets dropdownMinWidth shrink the panel below its trigger', async () => {
    // The input raises the floor; it does not replace it. A value under the
    // trigger width is the reading a consumer is most likely to get wrong, so
    // the trigger width stays in the `max()` and wins.
    fixture.componentInstance.dropdownMinWidth.set(80);
    await open();

    expect(pane().style.minWidth).toBe('max(200px, 80px)');
  });

  it('caps the panel at an explicit dropdownMaxWidth', async () => {
    fixture.componentInstance.dropdownMaxWidth.set('24rem');
    await open();

    // With flexible dimensions the cap lands on the bounding box, not the
    // pane: CDK clears `max-width` on the pane and applies the configured
    // value to the box the pane is laid out inside. That is the same
    // mechanism the viewport clamp uses, so the two compose.
    expect(boundingBox()?.style.maxWidth).toBe('24rem');
    // The floor is unaffected by the ceiling.
    expect(pane().style.minWidth).toBe('200px');
  });

  it('emits no max-width when none is set, leaving the viewport as the only cap', async () => {
    await open();

    expect(boundingBox()?.style.maxWidth).toBe('');
    expect(pane().style.maxWidth).toBe('');
  });

  it('keeps the floor with the in-panel search field (searchable)', async () => {
    fixture.componentInstance.searchable.set(true);
    await open();

    const searchInput = overlayContainer
      .getContainerElement()
      .querySelector('.mlv-select__search-input input');
    expect(!!searchInput).toBe(true);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('keeps the floor with check marks and the loading row', async () => {
    fixture.componentInstance.multiple.set(true);
    fixture.componentInstance.value.set([LONG_OPTION]);
    fixture.componentInstance.loading.set(true);
    await open();

    const container = overlayContainer.getContainerElement();
    expect(
      container.querySelectorAll('.mlv-dropdown-panel__item-check').length,
    ).toBe(1);
    expect(!!container.querySelector('.mlv-dropdown-panel__loading')).toBe(
      true,
    );
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('keeps the floor with the paging status row (loadingMore)', async () => {
    const source = new PagedSource([
      { id: 1, name: 'compact' },
      { id: 2, name: LONG_OPTION },
      { id: 3, name: 'spacious' },
      { id: 4, name: 'roomy' },
    ]);
    fixture.componentInstance.options.set(source);
    await open();
    source.setPage(2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      !!overlayContainer
        .getContainerElement()
        .querySelector('.mlv-dropdown-panel__loading-more'),
    ).toBe(true);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('grows toward inline-end and stays anchored at the start edge (LTR)', async () => {
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    // Pinned at the trigger's inline-start edge…
    expect(box?.style.left).toBe('40px');
    // …and bounded by the viewport's inline-end edge, which is what stops a
    // pane with no `width` (and CDK's own `max-width: 100%`) from running off.
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - 40}px`);
    expect(box?.style.alignItems).toBe('flex-start');
    expect(pane().style.width).toBe('');
    expect(pane().style.maxWidth).toBe('');
  });

  it('grows toward inline-end (leftward) under a global RTL flip', async () => {
    rtlService.setDirection('rtl');
    await open();

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    // Anchored at the trigger's start edge — its RIGHT edge in RTL — and
    // bounded by the viewport's inline-end (left) edge.
    expect(box?.style.right).toBe(`${VIEWPORT_WIDTH - TRIGGER_RECT.right}px`);
    expect(box?.style.width).toBe(`${TRIGGER_RECT.right}px`);
    expect(box?.style.alignItems).toBe('flex-start');
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });

  it('follows a [dir="rtl"] scope while the document stays LTR', async () => {
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('mlv-select') as HTMLElement
    ).setAttribute('dir', 'rtl');
    await open();

    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.right).toBe(`${VIEWPORT_WIDTH - TRIGGER_RECT.right}px`);
    expect(pane().style.minWidth).toBe('200px');
    expect(pane().style.width).toBe('');
  });
});

/**
 * #154 — the panel #150 freed to grow still had nowhere to grow into. Both
 * dropdown positions were `start`-aligned and differed only on the block axis,
 * so a trigger near the viewport's inline-end edge got a bounding box only as
 * wide as the sliver of room after it. The fix adds `end`-aligned fallbacks:
 * the panel anchors its inline-end edge to the trigger and grows back toward
 * inline-start.
 *
 * The assertions read the CDK bounding box, which is where "how far may this
 * panel grow" is actually expressed — `left`/`right` say which trigger edge the
 * panel is anchored to, `width` says how much room it was given. jsdom runs no
 * layout, so the origin, the viewport and the overlay pane are all given real
 * boxes: with a 0x0 pane `isCompletelyWithinViewport` compares `0 === 0` and
 * every candidate fits outright, so a spec that does not stub the pane pins
 * `positions[0]` and can never reach a fallback.
 */
describe('MlvSelect — dropdown inline-axis fallback (#154)', () => {
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  /** The panel's own box: wider than the room left beside an edge trigger. */
  const PANEL_WIDTH = 300;
  /**
   * A panel that fits on *either* side of {@link ROOMY_RECT}: 150px needs 150 of
   * the 984px after the trigger's start edge and 150 of the 240px before its end
   * edge. Both inline candidates fit outright, so nothing but list order can
   * decide between them.
   */
  const FITS_EITHER_SIDE_PANEL_WIDTH = 150;
  const PANEL_HEIGHT = 200;

  /** The width the pane stub reports; reset to {@link PANEL_WIDTH} per test. */
  let panelWidth = PANEL_WIDTH;

  const rect = (left: number, width: number) => ({
    x: left,
    y: 100,
    left,
    top: 100,
    right: left + width,
    bottom: 132,
    width,
    height: 32,
  });

  /** 60px trigger with only 20px of room after its physical right edge. */
  const RIGHT_EDGE_RECT = rect(944, 60);
  /** The mirror image: 60px trigger 20px from the physical left edge. */
  const LEFT_EDGE_RECT = rect(20, 60);
  /** Room on both sides — the case the preferred `start` pair must keep. */
  const ROOMY_RECT = rect(40, 200);

  @Component({
    imports: [MlvSelect],
    template: `<mlv-select id="fallback" [options]="['a', 'b']" />`,
  })
  class HostComponent {
    readonly select = viewChild.required(MlvSelect<string>);
  }

  let fixture: ComponentFixture<HostComponent>;
  let overlayContainer: OverlayContainer;
  let rtlService: MlvRtlService;

  const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  /** Replaces an element's zero-sized jsdom box with a real one. */
  function stubRect(element: Element, box: Record<string, number>): void {
    const full = { toJSON: () => box, ...box };
    element.getBoundingClientRect = () => full as unknown as DOMRect;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    rtlService = TestBed.inject(MlvRtlService);

    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: VIEWPORT_WIDTH,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: VIEWPORT_HEIGHT,
      configurable: true,
    });

    panelWidth = PANEL_WIDTH;

    // The pane does not exist until CDK attaches it, and CDK measures it inside
    // that same attach — so it is stubbed on the prototype rather than on the
    // instance. Elements carrying their own `getBoundingClientRect` (the origin
    // below) shadow this; everything else falls through to jsdom.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList?.contains('cdk-overlay-pane')) {
        const box = {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: panelWidth,
          bottom: PANEL_HEIGHT,
          width: panelWidth,
          height: PANEL_HEIGHT,
        };
        return { toJSON: () => box, ...box } as unknown as DOMRect;
      }
      return nativeGetBoundingClientRect.call(this);
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
    rtlService.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
    overlayContainer.ngOnDestroy();
  });

  /** Places the trigger at `box` and opens the dropdown. */
  async function openAt(box: Record<string, number>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-select__trigger',
    ) as HTMLElement;
    // The overlay's origin is the popup container, not the trigger it wraps.
    stubRect(
      fixture.nativeElement.querySelector('mlv-popup-container') as Element,
      box,
    );
    stubRect(trigger, box);
    fixture.componentInstance
      .select()
      .updateTriggerWidth([
        { target: trigger } as unknown as ResizeObserverEntry,
      ]);
    fixture.componentInstance.select().openDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * The bounding box's anchored inset, its width and its `align-items` together
   * identify the applied position pair. The *opposite* inset is deliberately
   * not asserted: CDK writes `auto` there, and jsdom's `cssstyle` rejects `auto`
   * on `left`/`right`, so it silently keeps the `0px` left by CDK's own reset.
   */
  const boundingBox = () =>
    overlayContainer
      .getContainerElement()
      .querySelector(
        '.cdk-overlay-connected-position-bounding-box',
      ) as HTMLElement | null;

  it('anchors the panel to the trigger inline-end edge when inline-end room runs out (LTR)', async () => {
    await openAt(RIGHT_EDGE_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    // The `end`-aligned fallback: the box hangs off the trigger's inline-end
    // (right) edge and spans back to the viewport's inline-start edge…
    expect(box?.style.right).toBe(
      `${VIEWPORT_WIDTH - RIGHT_EDGE_RECT.right}px`,
    );
    expect(box?.style.width).toBe(`${RIGHT_EDGE_RECT.right}px`);
    // …and the pane is laid out against that edge inside it.
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('keeps the preferred start-aligned position when there is inline-end room (LTR)', async () => {
    // The 300px panel does not fit before the trigger's end edge (240 − 300 is
    // off-screen), so the start entry wins on merit here rather than on order.
    // Ordering is guarded by the next test, where both candidates fit.
    await openAt(ROOMY_RECT);

    const box = boundingBox();
    expect(box?.style.left).toBe(`${ROOMY_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - ROOMY_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
  });

  it('prefers the start-aligned position on list order alone when both inline candidates fit', async () => {
    // The invariant the whole fix rests on: the `end` pair is a *fallback*, so a
    // trigger with room on both sides must keep the placement it has always had.
    // Every other case in this block is decided by geometry — only here do both
    // candidates fit outright (`start` needs 150 of the 984px after left=40,
    // `end` needs 150 of the 240px before right=240), so CDK's "first position
    // that fits wins" is the only thing separating them. Reorder
    // `DROPDOWN_POSITIONS` end-pair-first and this is the assertion that fails.
    panelWidth = FITS_EITHER_SIDE_PANEL_WIDTH;
    await openAt(ROOMY_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('ltr');
    expect(box?.style.left).toBe(`${ROOMY_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - ROOMY_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-start');
  });

  it('mirrors the fallback under a global RTL flip', async () => {
    rtlService.setDirection('rtl');
    // Inline-end is the physical LEFT edge in RTL, so it is a trigger hugging
    // the left of the viewport that has nowhere to grow.
    await openAt(LEFT_EDGE_RECT);

    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.left).toBe(`${LEFT_EDGE_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - LEFT_EDGE_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('mirrors the fallback under a [dir="rtl"] scope while the document stays LTR', async () => {
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('mlv-select') as HTMLElement
    ).setAttribute('dir', 'rtl');
    await openAt(LEFT_EDGE_RECT);

    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    const box = boundingBox();
    expect(box?.getAttribute('dir')).toBe('rtl');
    expect(box?.style.left).toBe(`${LEFT_EDGE_RECT.left}px`);
    expect(box?.style.width).toBe(`${VIEWPORT_WIDTH - LEFT_EDGE_RECT.left}px`);
    expect(box?.style.alignItems).toBe('flex-end');
  });

  it('keeps the preferred start-aligned position when there is inline-end room (RTL)', async () => {
    rtlService.setDirection('rtl');
    await openAt(RIGHT_EDGE_RECT);

    const box = boundingBox();
    // `start` in RTL is the trigger's physical right edge; the box spans back
    // toward the viewport's physical left edge.
    expect(box?.style.right).toBe(
      `${VIEWPORT_WIDTH - RIGHT_EDGE_RECT.right}px`,
    );
    expect(box?.style.width).toBe(`${RIGHT_EDGE_RECT.right}px`);
    expect(box?.style.alignItems).toBe('flex-start');
  });
});
