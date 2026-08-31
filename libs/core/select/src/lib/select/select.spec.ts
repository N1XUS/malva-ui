import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Signal } from '@angular/core';
import { Component, signal, viewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import axe from 'axe-core';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvPopup } from '@malva-ui/core/popup';
import type { MlvPopupMobileMode } from '@malva-ui/core/popup';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
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
    const results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        // The isolated TestBed document intentionally has no application-level
        // main landmark; that responsibility belongs to the consuming shell.
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
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
    // The overlay's outer `mlv-popup` wraps its content in an `mlv-scrollbar`
    // left in auto mode (the dropdown panel's own scrollbar is pinned to
    // `[viewportTabIndex]="-1"` and never takes a role). That popup scrollbar
    // re-reads whether its content is tabbable on an animation frame and gives
    // up its transient `role="group"` once the options exist. Let that land
    // before counting roles inside the overlay.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
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
  template: `<mlv-select clearable [options]="['Apple', 'Banana']" />`,
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

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map(({ id }) => id)).not.toContain(
      'nested-interactive',
    );

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
});
