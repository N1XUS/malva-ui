import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Project } from 'ts-morph';
import type {
  ApiEntry,
  ApiMember,
  ApiMethod,
  ApiSymbol,
} from '../src/app/shared/api-viewer/api.types';
import {
  createApiProject,
  extractEntry,
  findRepoRoot,
  listDocumentedPages,
  resolveLib,
  type ResolvedLib,
} from './api-extractor';

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

function requireLib(name: string): ResolvedLib {
  const lib = resolveLib(repoRoot, name);
  if (!lib) throw new Error(`Expected a library for page "${name}"`);
  return lib;
}

function symbol(entry: ApiEntry, name: string): ApiSymbol {
  const found = entry.symbols.find((s) => s.name === name);
  if (!found) throw new Error(`Symbol "${name}" not found in "${entry.name}"`);
  return found;
}

function member(members: ApiMember[], name: string): ApiMember {
  const found = members.find((m) => m.name === name);
  if (!found) throw new Error(`Member "${name}" not found`);
  return found;
}

function method(sym: ApiSymbol, name: string): ApiMethod {
  const found = sym.methods.find((m) => m.name === name);
  if (!found) throw new Error(`Method "${name}" not found on "${sym.name}"`);
  return found;
}

describe('api-extractor', () => {
  let project: Project;
  let button: ApiEntry;
  let checkbox: ApiEntry;
  let dialog: ApiEntry;
  let tabs: ApiEntry;

  beforeAll(() => {
    project = createApiProject(repoRoot);
    button = extractEntry(project, 'button', requireLib('button').indexPath);
    checkbox = extractEntry(
      project,
      'checkbox',
      requireLib('checkbox').indexPath,
    );
    dialog = extractEntry(project, 'dialog', requireLib('dialog').indexPath);
    tabs = extractEntry(project, 'tabs', requireLib('tabs').indexPath);
  }, 120_000);

  describe('page → library mapping', () => {
    it('maps identity pages and intentional page aliases', () => {
      expect(resolveLib(repoRoot, 'button')?.dir).toBe('button');
      expect(resolveLib(repoRoot, 'form-field')?.dir).toBe('form-utils');
      expect(resolveLib(repoRoot, 'form-field')?.family).toBe('core');
      expect(resolveLib(repoRoot, 'button-group')?.dir).toBe('button');
      expect(resolveLib(repoRoot, 'button-split')?.dir).toBe('button');
      expect(resolveLib(repoRoot, 'button-toggle')?.dir).toBe('button');
    });

    it('resolves non-core families from the manifest', () => {
      expect(resolveLib(repoRoot, 'density')?.family).toBe('cdk');
      expect(resolveLib(repoRoot, 'animated-presence')?.dir).toBe('utils');
      expect(resolveLib(repoRoot, 'internationalization')?.family).toBe('i18n');
    });

    it('returns null for pages with no matching library', () => {
      expect(resolveLib(repoRoot, 'theming')).toBeNull();
      expect(resolveLib(repoRoot, 'home')).toBeNull();
    });

    it('lists API pages from the manifest, excluding guide-only pages', () => {
      const pages = listDocumentedPages(repoRoot);
      expect(pages).toContain('button');
      expect(pages).toContain('editor');
      expect(pages).toContain('form-field');
      expect(pages).toContain('animated-presence');
      expect(pages).not.toContain('home');
      expect(pages).not.toContain('theming');
    });

    it('resolves editor to the standalone editor package root', () => {
      expect(resolveLib(repoRoot, 'editor')).toMatchObject({
        family: 'editor',
        dir: '',
      });
    });
  });

  describe('component extraction (button)', () => {
    it('classifies the component and reads its selector', () => {
      const component = symbol(button, 'MlvButton');
      expect(component.kind).toBe('component');
      expect(component.selector).toBe('button[mlvButton], a[mlvButton]');
    });

    it('surfaces a coerced boolean input as boolean/false', () => {
      const disabled = member(symbol(button, 'MlvButton').inputs, 'disabled');
      expect(disabled.type).toBe('boolean');
      expect(disabled.default).toBe('false');
      expect(disabled.required).toBeFalsy();
      expect(disabled.inherited).toBeFalsy();
    });

    it('preserves a type-alias reference in the input type text', () => {
      const variant = member(symbol(button, 'MlvButton').inputs, 'variant');
      expect(variant.type).toBe('MlvButtonVariant | undefined');
      expect(variant.default).toBe('undefined');

      const alias = symbol(button, 'MlvButtonVariant');
      expect(alias.kind).toBe('type');
      expect(alias.typeText).toContain("'primary'");
    });

    it('excludes internal members and the removed size input', () => {
      const component = symbol(button, 'MlvButton');
      const names = component.inputs.map((i) => i.name);
      expect(names).toEqual([
        'variant',
        'shape',
        'disabled',
        'loading',
        'selected',
      ]);
      expect(names).not.toContain('size');
      expect(names.every((n) => !n.startsWith('_'))).toBe(true);
    });
  });

  describe('public properties (tabs)', () => {
    it('surfaces public computed/signal state as properties, not inputs', () => {
      const component = symbol(tabs, 'MlvTabGroup');
      const propNames = component.properties.map((p) => p.name);
      // Public computed signals are captured as properties…
      expect(propNames).toContain('visibleTabs');
      const visible = member(component.properties, 'visibleTabs');
      expect(visible.type).toContain('Signal');
      // …and are NOT double-counted as inputs.
      expect(component.inputs.map((i) => i.name)).not.toContain('visibleTabs');
    });

    it('excludes view/content queries, protected, and underscore members', () => {
      const component = symbol(tabs, 'MlvTabGroup');
      const propNames = component.properties.map((p) => p.name);
      expect(propNames).not.toContain('tabListRef'); // viewChild query
      expect(propNames).not.toContain('indicatorRef'); // viewChild query
      expect(propNames).not.toContain('selectedTab'); // protected
      expect(propNames.every((n) => !n.startsWith('_'))).toBe(true);
    });
  });

  describe('inheritance & models (checkbox)', () => {
    it('walks the base class to include inherited signal-control inputs', () => {
      const component = symbol(checkbox, 'MlvCheckbox');
      const disabled = member(component.inputs, 'disabled');
      expect(disabled.inherited).toBe(true);
      expect(disabled.inheritedFrom).toBe('MlvSignalFormUiControlBase');
      expect(disabled.type).toBe('boolean');

      const state = member(component.inputs, 'state');
      expect(state.inherited).toBe(true);
      expect(state.type).toBe('MlvFormState');
    });

    it('expands a model() into an input plus a <name>Change output', () => {
      const component = symbol(checkbox, 'MlvCheckbox');
      const checked = member(component.inputs, 'checked');
      expect(checked.type).toBe('boolean');
      expect(checked.inherited).toBeFalsy();

      const checkedChange = member(component.outputs, 'checkedChange');
      expect(checkedChange.type).toBe('boolean');
    });

    it('excludes underscore-prefixed / @internal members', () => {
      const component = symbol(checkbox, 'MlvCheckbox');
      const names = [...component.inputs, ...component.outputs].map(
        (m) => m.name,
      );
      expect(names).not.toContain('_ariaLabel');
      expect(names.every((n) => !n.startsWith('_'))).toBe(true);
    });
  });

  describe('services, tokens & generics (dialog)', () => {
    it('classifies a service and captures its polymorphic open method with generics preserved', () => {
      const service = symbol(dialog, 'MlvDialogService');
      expect(service.kind).toBe('service');
      const open = method(service, 'open');
      expect(open.signature).toContain('<R = unknown, D = unknown>');
      expect(open.signature).toContain('MlvDialogContent<R, D>');
      expect(open.signature).toContain('MlvDialogRef<R, D>');
      expect(open.inherited).toBeFalsy();
    });

    it('captures injection tokens with their generic type argument', () => {
      const token = symbol(dialog, 'DIALOG_SIZE_PRESETS');
      expect(token.kind).toBe('token');
      expect(token.typeText).toBe('InjectionToken<MlvDialogSizePresets>');
    });

    it('captures a token re-exported by annotated alias, not construction', () => {
      // `DIALOG_DATA` is CDK's token re-exported under the same name, so its
      // initializer is an identifier — only the type annotation identifies it.
      const token = symbol(dialog, 'DIALOG_DATA');
      expect(token.kind).toBe('token');
      expect(token.typeText).toBe('InjectionToken<unknown>');
    });

    it('surfaces typed dialog data on the returned reference', () => {
      const ref = symbol(dialog, 'MlvDialogRef');
      expect(member(ref.properties, 'data').type).toBe('D');
    });

    it('preserves generics in a type alias', () => {
      const presets = symbol(dialog, 'MlvDialogSizePresets');
      expect(presets.kind).toBe('type');
      expect(presets.typeText).toBe('Record<string, MlvDialogSizeConfig>');
    });
  });
});
