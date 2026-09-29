import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { Component } from '@angular/core';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTree } from './tree';
import type { MlvTreeNode } from './tree-node';

/**
 * #371: `mlv-tree` built its toggle, checkbox and loader names from English
 * literals ("Expand …", "Collapse …", "Select …", "Loading children") and had
 * no i18n slice. They now resolve from the optional `tree` slice, English
 * fallback per key.
 */
@Component({
  imports: [MlvTree],
  template: `<mlv-tree [nodes]="nodes" selectMode="multi" />`,
})
class TreeHost {
  /** `Archive` loads children that never arrive, so its spinner stays. */
  readonly nodes: MlvTreeNode<unknown>[] = [
    {
      id: 'docs',
      label: 'Documents',
      data: {},
      children: [{ id: 'cv', label: 'CV.pdf', data: {} }],
    },
    {
      id: 'lazy',
      label: 'Archive',
      data: {},
      loadChildren: () => new Promise<MlvTreeNode<unknown>[]>(() => undefined),
    },
  ];
}

/** The English pack with a `tree` slice of markers. */
const markerPack = {
  ...enLanguage,
  tree: {
    expandNode: 'OPEN <{label}>',
    collapseNode: 'SHUT <{label}>',
    loadingChildren: 'FETCHING',
    selectNode: 'PICK <{label}>',
  },
} as MlvLanguage;

/** An older pack with no `tree` slice. */
const legacyPack = (() => {
  const pack: Record<string, unknown> = { ...enLanguage };
  delete pack['tree'];
  return pack as unknown as MlvLanguage;
})();

describe('MlvTree — i18n of the built-in names (#371)', () => {
  let fixture: ComponentFixture<TreeHost>;

  const root = () => fixture.nativeElement as HTMLElement;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TreeHost],
      providers,
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(TreeHost);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The row whose own label reads `label`. */
  function row(label: string): HTMLElement {
    const match = Array.from(
      root().querySelectorAll<HTMLElement>('.mlv-tree__item'),
    ).find(
      (el) =>
        el.firstElementChild
          ?.querySelector('.mlv-tree__label')
          ?.textContent?.trim() === label,
    );
    if (!match) throw new Error(`no row labelled ${label}`);
    return match;
  }

  function toggleLabel(label: string): string | null {
    return (
      row(label)
        .firstElementChild?.querySelector('.mlv-tree__toggle')
        ?.getAttribute('aria-label') ?? null
    );
  }

  function checkboxLabel(label: string): string | null {
    return (
      row(label)
        .firstElementChild?.querySelector<HTMLInputElement>(
          '.mlv-tree__checkbox input[type="checkbox"]',
        )
        ?.getAttribute('aria-label') ?? null
    );
  }

  async function click(label: string): Promise<void> {
    const toggle =
      row(label).firstElementChild?.querySelector<HTMLElement>(
        '.mlv-tree__toggle',
      );
    if (!toggle) throw new Error(`${label} has no toggle`);
    toggle.click();
    await settle();
  }

  /** Every #371 string the tree renders: collapsed, expanded and loading. */
  async function strings(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {
      collapsed: toggleLabel('Documents'),
      select: checkboxLabel('Documents'),
    };
    await click('Documents');
    result['expanded'] = toggleLabel('Documents');
    await click('Documents');
    await click('Archive');
    result['loading'] =
      row('Archive')
        .querySelector('.mlv-tree__spinner mlv-loader')
        ?.getAttribute('aria-label') ?? null;
    return result;
  }

  const english = {
    collapsed: 'Expand Documents',
    select: 'Select Documents',
    expanded: 'Collapse Documents',
    loading: 'Loading children',
  };

  it('renders the English names under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(await strings()).toEqual(english);
  });

  it('names the toggle in English with no i18n provider at all', async () => {
    await render([]);
    expect(toggleLabel('Documents')).toBe('Expand Documents');
  });

  it('falls back to English for a pack without a tree slice', async () => {
    await withPack(legacyPack);
    expect(await strings()).toEqual(english);
  });

  it('reads every name from the active pack', async () => {
    await withPack(markerPack);
    expect(await strings()).toEqual({
      collapsed: 'OPEN <Documents>',
      select: 'PICK <Documents>',
      expanded: 'SHUT <Documents>',
      loading: 'FETCHING',
    });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await withPack(deLanguage);
    expect(toggleLabel('Documents')).toBe('Documents erweitern');
    expect(checkboxLabel('Documents')).toBe('Documents auswählen');

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    expect(toggleLabel('Documents')).toBe('Розгорнути Documents');
    expect(checkboxLabel('Documents')).toBe('Вибрати Documents');

    await click('Documents');
    expect(toggleLabel('Documents')).toBe('Згорнути Documents');
    await click('Archive');
    expect(
      row('Archive')
        .querySelector('.mlv-tree__spinner mlv-loader')
        ?.getAttribute('aria-label'),
    ).toBe('Завантаження дочірніх елементів');
  });

  it('has no axe violations with a localized pack', async () => {
    await withPack(deLanguage);
    await expectNoAxeViolations(root());
    await click('Documents');
    await click('Archive');
    await expectNoAxeViolations(root());
  });
});
