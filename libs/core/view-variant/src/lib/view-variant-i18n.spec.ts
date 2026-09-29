import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import {
  MlvViewVariantList,
  MlvViewVariantStatus,
  type MlvViewVariant,
} from '../index';

/**
 * #371: both view-variant components rendered every string in English — the
 * search field, the create buttons (the two-scope form interpolated the raw
 * `'team'` / `'personal'` union value), the group headings, the read-only
 * marker, the overflow menu and its items, the empty state, the error actions,
 * the status sentences and the status buttons. They now resolve from the
 * optional `viewVariant` slice, English fallback per key; `groupLabels` stays
 * an override.
 */

type ViewState = Readonly<{ search: string }>;

const capabilities = {
  clone: true,
  update: true,
  rename: true,
  delete: true,
  share: true,
};

const variants: readonly MlvViewVariant<ViewState>[] = [
  {
    id: 'system',
    name: 'Risk',
    scope: 'system',
    state: { search: 'risk' },
    locked: true,
    capabilities: {
      clone: true,
      update: false,
      rename: false,
      delete: false,
      share: false,
    },
  },
  {
    id: 'team',
    name: 'Renewals',
    scope: 'team',
    state: { search: 'renewal' },
    capabilities,
  },
  {
    id: 'personal',
    name: 'Mine',
    scope: 'personal',
    state: { search: 'mine' },
    capabilities,
  },
];

/** The English pack with a `viewVariant` slice of markers. */
const markerPack = {
  ...enLanguage,
  viewVariant: {
    searchViews: 'FIND',
    newView: 'CREATE',
    newTeamView: 'CREATE-TEAM',
    newPersonalView: 'CREATE-MINE',
    retry: 'AGAIN',
    dismiss: 'HIDE',
    systemViews: 'SYS',
    teamViews: 'TEAM',
    personalViews: 'OWN',
    readOnly: 'LOCKED',
    moreActions: 'MORE <{name}>',
    variantActions: 'ACTIONS <{name}>',
    rename: 'RENAME',
    share: 'SHARE',
    delete: 'DELETE',
    noMatches: 'NONE',
    duplicateView: 'DUPLICATE',
    resetChanges: 'UNDO',
    updateView: 'UPDATE',
    saveAsNew: 'SAVE-NEW',
    reset: 'RESET',
    readOnlySystemView: 'SYS-READ-ONLY',
    duplicateToSave: 'DUPLICATE-TO-SAVE',
    unsavedChanges: 'DIRTY',
    unsavedView: 'UNSAVED',
  },
} as MlvLanguage;

/** An older pack with no `viewVariant` slice. */
const legacyPack = (() => {
  const pack: Record<string, unknown> = { ...enLanguage };
  delete pack['viewVariant'];
  return pack as unknown as MlvLanguage;
})();

async function configure(
  providers: (Provider | EnvironmentProviders)[],
  pack?: MlvLanguage,
): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [MlvViewVariantList, MlvViewVariantStatus],
    providers,
  }).compileComponents();
  if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
}

function packProviders(pack: MlvLanguage): (Provider | EnvironmentProviders)[] {
  return [provideMlvI18n(async () => ({ default: pack }))];
}

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('MlvViewVariantList — i18n (#371)', () => {
  let fixture: ComponentFixture<MlvViewVariantList<ViewState>>;
  let host: HTMLElement;
  let overlay: HTMLElement;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(MlvViewVariantList<ViewState>);
    host = fixture.nativeElement as HTMLElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    fixture.componentRef.setInput('variants', variants);
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('errorMessage', 'Could not load');
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  /** Opens `name`'s overflow menu, reads it, and closes it again. */
  async function menu(name: string): Promise<Record<string, unknown>> {
    const row = Array.from(
      host.querySelectorAll<HTMLElement>('.mlv-view-variant-list__item'),
    ).find(
      (item) =>
        text(item.querySelector('.mlv-view-variant-list__name')) === name,
    );
    const trigger = row?.querySelector<HTMLButtonElement>(
      '.mlv-view-variant-list__more',
    );
    if (!trigger) throw new Error(`${name} has no overflow trigger`);
    const triggerLabel = trigger.getAttribute('aria-label');
    trigger.click();
    await settle();
    const panel = overlay.querySelector('[role="menu"]');
    const result = {
      trigger: triggerLabel,
      menu: panel?.getAttribute('aria-label') ?? null,
      items: Array.from(panel?.querySelectorAll('[role="menuitem"]') ?? []).map(
        (item) => text(item),
      ),
    };
    trigger.click();
    await settle();
    overlay
      .querySelector<HTMLElement>('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await settle();
    return result;
  }

  /** Every #371 string the list renders. */
  async function strings(): Promise<Record<string, unknown>> {
    const search = host.querySelector<HTMLInputElement>(
      '.mlv-view-variant-list__toolbar input',
    );
    const result: Record<string, unknown> = {
      placeholder: search?.getAttribute('placeholder') ?? null,
      searchName: search?.getAttribute('aria-label') ?? null,
      create: Array.from(
        host.querySelectorAll('.mlv-view-variant-list__create'),
      ).map(text),
      errorActions: Array.from(
        host.querySelectorAll('.mlv-view-variant-list__error-actions button'),
      ).map(text),
      groups: Array.from(
        host.querySelectorAll('.mlv-view-variant-list__group'),
      ).map((group) => [
        group.getAttribute('aria-label'),
        text(group.querySelector('.mlv-view-variant-list__group-title')),
      ]),
      readOnly: text(
        host.querySelector('.mlv-view-variant-list__visually-hidden'),
      ),
      menu: await menu('Mine'),
    };
    fixture.componentRef.setInput('createScopes', ['team', 'personal']);
    fixture.componentRef.setInput('query', 'zzz');
    await settle();
    result['createPerScope'] = Array.from(
      host.querySelectorAll('.mlv-view-variant-list__create'),
    ).map(text);
    result['empty'] = text(host.querySelector('.mlv-view-variant-list__empty'));
    fixture.componentRef.setInput('createScopes', ['personal']);
    fixture.componentRef.setInput('query', '');
    await settle();
    return result;
  }

  const english = {
    placeholder: 'Search views',
    searchName: 'Search views',
    create: ['New view'],
    errorActions: ['Retry', 'Dismiss'],
    groups: [
      ['System', 'System'],
      ['Team', 'Team'],
      ['My views', 'My views'],
    ],
    readOnly: 'Read-only',
    menu: {
      trigger: 'More actions for Mine',
      menu: 'Actions for Mine',
      items: ['Rename', 'Share', 'Delete'],
    },
    createPerScope: ['New team view', 'New personal view'],
    empty: 'No views match your search.',
  };

  it('renders the English strings under the testing pack', async () => {
    await configure([provideMlvI18nTesting()]);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('renders the English strings with no i18n provider', async () => {
    await configure([]);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('falls back to English for a pack without a viewVariant slice', async () => {
    await configure(packProviders(legacyPack), legacyPack);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('reads every string from the active pack', async () => {
    await configure(packProviders(markerPack), markerPack);
    await create();
    expect(await strings()).toEqual({
      placeholder: 'FIND',
      searchName: 'FIND',
      create: ['CREATE'],
      errorActions: ['AGAIN', 'HIDE'],
      groups: [
        ['SYS', 'SYS'],
        ['TEAM', 'TEAM'],
        ['OWN', 'OWN'],
      ],
      readOnly: 'LOCKED',
      menu: {
        trigger: 'MORE <Mine>',
        menu: 'ACTIONS <Mine>',
        items: ['RENAME', 'SHARE', 'DELETE'],
      },
      createPerScope: ['CREATE-TEAM', 'CREATE-MINE'],
      empty: 'NONE',
    });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await configure(packProviders(deLanguage), deLanguage);
    await create();
    const german = await strings();
    expect(german['groups']).toEqual([
      ['System', 'System'],
      ['Team', 'Team'],
      ['Meine Ansichten', 'Meine Ansichten'],
    ]);
    expect(german['placeholder']).toBe('Ansichten durchsuchen');
    expect(german['createPerScope']).toEqual([
      'Neue Teamansicht',
      'Neue persönliche Ansicht',
    ]);
    expect(german['menu']).toEqual({
      trigger: 'Weitere Aktionen für Mine',
      menu: 'Aktionen für Mine',
      items: ['Umbenennen', 'Teilen', 'Löschen'],
    });

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    const ukrainian = await strings();
    expect(ukrainian['groups']).toEqual([
      ['Системні', 'Системні'],
      ['Командні', 'Командні'],
      ['Мої подання', 'Мої подання'],
    ]);
    expect(ukrainian['errorActions']).toEqual(['Повторити', 'Закрити']);
    expect(ukrainian['empty']).toBe(
      'Жодне подання не відповідає вашому пошуку.',
    );
  });

  it('keeps groupLabels as an override over the pack', async () => {
    await configure(packProviders(deLanguage), deLanguage);
    await create();
    fixture.componentRef.setInput('groupLabels', {
      system: 'Built-in',
      team: 'Shared',
      personal: 'Private',
    });
    await settle();
    expect(
      Array.from(
        host.querySelectorAll('.mlv-view-variant-list__group-title'),
      ).map(text),
    ).toEqual(['Built-in', 'Shared', 'Private']);
  });

  it('has no axe violations with a localized pack', async () => {
    await configure(packProviders(deLanguage), deLanguage);
    await create();
    await expectNoAxeViolations(host);
  });
});

describe('MlvViewVariantStatus — i18n (#371)', () => {
  let fixture: ComponentFixture<MlvViewVariantStatus<ViewState>>;
  let host: HTMLElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function show(
    variant: MlvViewVariant<ViewState> | null,
    dirty: boolean,
    errorMessage: string | null = null,
  ): Promise<{ message: string; buttons: string[] }> {
    fixture.componentRef.setInput('variant', variant);
    fixture.componentRef.setInput('dirty', dirty);
    fixture.componentRef.setInput('errorMessage', errorMessage);
    await settle();
    return {
      message: text(host.querySelector('.mlv-view-variant-status__message')),
      buttons: Array.from(host.querySelectorAll('button')).map(text),
    };
  }

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(MlvViewVariantStatus<ViewState>);
    host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('canCreate', true);
    await settle();
  }

  /** Every mode's sentence and buttons, plus the error actions. */
  async function strings(): Promise<Record<string, unknown>> {
    return {
      lockedClean: await show(variants[0], false),
      lockedDirty: await show(variants[0], true),
      editableDirty: await show(variants[2], true),
      unsaved: await show(null, false),
      error: await show(variants[2], false, 'Save failed'),
    };
  }

  const english = {
    lockedClean: {
      message: 'This system view is read-only',
      buttons: ['Duplicate view'],
    },
    lockedDirty: {
      message: 'Duplicate it to save your changes',
      buttons: ['Reset changes', 'Duplicate view'],
    },
    editableDirty: {
      message: 'You have unsaved view changes',
      buttons: ['Reset changes', 'Update view', 'Save as new'],
    },
    unsaved: {
      message: 'This is an unsaved view',
      buttons: ['Reset', 'Save as new'],
    },
    error: { message: '', buttons: ['Retry', 'Dismiss'] },
  };

  it('renders the English strings under the testing pack', async () => {
    await configure([provideMlvI18nTesting()]);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('renders the English strings with no i18n provider', async () => {
    await configure([]);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('falls back to English for a pack without a viewVariant slice', async () => {
    await configure(packProviders(legacyPack), legacyPack);
    await create();
    expect(await strings()).toEqual(english);
  });

  it('reads every string from the active pack', async () => {
    await configure(packProviders(markerPack), markerPack);
    await create();
    expect(await strings()).toEqual({
      lockedClean: { message: 'SYS-READ-ONLY', buttons: ['DUPLICATE'] },
      lockedDirty: {
        message: 'DUPLICATE-TO-SAVE',
        buttons: ['UNDO', 'DUPLICATE'],
      },
      editableDirty: {
        message: 'DIRTY',
        buttons: ['UNDO', 'UPDATE', 'SAVE-NEW'],
      },
      unsaved: { message: 'UNSAVED', buttons: ['RESET', 'SAVE-NEW'] },
      error: { message: '', buttons: ['AGAIN', 'HIDE'] },
    });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await configure(packProviders(deLanguage), deLanguage);
    await create();
    expect(await show(variants[2], true)).toEqual({
      message: 'Sie haben ungespeicherte Änderungen an der Ansicht',
      buttons: [
        'Änderungen zurücksetzen',
        'Ansicht aktualisieren',
        'Als neue Ansicht speichern',
      ],
    });

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    expect(await show(variants[2], true)).toEqual({
      message: 'У поданні є незбережені зміни',
      buttons: ['Скинути зміни', 'Оновити подання', 'Зберегти як нове'],
    });
    expect(await show(null, false)).toEqual({
      message: 'Це незбережене подання',
      buttons: ['Скинути', 'Зберегти як нове'],
    });
  });

  it('has no axe violations with a localized pack', async () => {
    await configure(packProviders(deLanguage), deLanguage);
    await create();
    await show(variants[0], true);
    await expectNoAxeViolations(host);
    await show(variants[2], false, 'Save failed');
    await expectNoAxeViolations(host);
  });
});
