import { ApplicationInitStatus, ApplicationRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import axe from 'axe-core';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { By } from '@angular/platform-browser';
import { MlvDataTable } from '@malva-ui/core/data-table';
import { SettingsAccessShowcaseComponent } from './settings-access';
import {
  API_KEYS,
  BOUNCED_INVITE_EMAILS,
  CURRENT_SESSION_ID,
  DEFAULTS,
  DELETE_DEMO_KEY_ID,
  MEMBERS,
  REVOKE_FAILS_SESSION_ID,
  ROTATION_FAILS_KEY_ID,
  SESSIONS,
  SOLE_OWNER_MEMBER_ID,
  STEP_UP_CODE,
  STEP_UP_LOCKOUT_MS,
  STEP_UP_MAX_ATTEMPTS,
  TAKEN_SLUGS,
  WORKSPACE,
} from './settings-access.data';

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Rendered {
  readonly fixture: ComponentFixture<SettingsAccessShowcaseComponent>;
  readonly component: SettingsAccessShowcaseComponent;
  readonly root: HTMLElement;
}

/** Seeded `runShowcaseOperation` delay for save / rotate / invite, plus slack. */
const SLOW_DELAY = 500;

/** Seeded first-load skeleton delay for a tab's collection, plus slack. */
const COLLECTION_DELAY = 300;

/** `MlvDialogRef` leave-animation fallback (jsdom fires no `animationend`). */
const DIALOG_LEAVE = 300;

/** The dock's just-saved window before it settles back to clean. */
const JUST_SAVED = 6100;

async function settle(rendered: Rendered): Promise<void> {
  rendered.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  rendered.fixture.detectChanges();
}

/**
 * Advances the seeded `setTimeout` delays the showcase runs on. Change
 * detection here is zoneless, so `whenStable()` never waits for a raw timer —
 * every async step has to be driven forward explicitly.
 */
async function advance(rendered: Rendered, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await settle(rendered);
}

/**
 * Viewport the suite pretends to run at. Above the `lg` breakpoint (1200px) the
 * settings rail is an in-flow sidebar rather than an offcanvas drawer, which is
 * the layout every assertion below is written against.
 */
const VIEWPORT_WIDTH = 1440;

/** Answers `(min-width:)` / `(max-width:)` against {@link VIEWPORT_WIDTH}. */
function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const min = /\(min-width:\s*([\d.]+)px\)/.exec(query);
      const max = /\(max-width:\s*([\d.]+)px\)/.exec(query);
      const matches =
        (!min || VIEWPORT_WIDTH >= Number(min[1])) &&
        (!max || VIEWPORT_WIDTH <= Number(max[1]));
      return {
        media: query,
        matches,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    },
  });
}

async function render(): Promise<Rendered> {
  stubMatchMedia();

  await TestBed.configureTestingModule({
    imports: [SettingsAccessShowcaseComponent],
    providers: [
      provideAnimationsAsync('noop'),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const fixture = TestBed.createComponent(SettingsAccessShowcaseComponent);
  const rendered: Rendered = {
    fixture,
    component: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
  await settle(rendered);
  return rendered;
}

/* -------------------------------------------------------------------------- */
/* DOM helpers — the page ships no `data-*` hooks, so these use its BEM        */
/* classes, ARIA names and visible copy.                                      */
/* -------------------------------------------------------------------------- */

function all(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

function byText(root: ParentNode, selector: string, text: string): HTMLElement {
  const match = all(root, selector).find(
    (el) => el.textContent?.replace(/\s+/g, ' ').trim() === text,
  );
  if (!match) throw new Error(`No ${selector} reading "${text}"`);
  return match;
}

function containingText(
  root: ParentNode,
  selector: string,
  text: string,
): HTMLElement {
  const match = all(root, selector).find((el) =>
    el.textContent?.includes(text),
  );
  if (!match) throw new Error(`No ${selector} containing "${text}"`);
  return match;
}

/** One sidebar row, matched on its visible label. */
function navRow(rendered: Rendered, label: string): HTMLElement {
  const match = all(rendered.root, '.settings-access-showcase__nav-item').find(
    (row) => row.getAttribute('aria-label')?.startsWith(label),
  );
  if (!match) throw new Error(`No sidebar row "${label}"`);
  return match;
}

/** The badge a sidebar row currently renders, or `null` when it has none. */
function navBadge(rendered: Rendered, label: string): HTMLElement | null {
  return navRow(rendered, label).querySelector('.mlv-sidebar-item__badge');
}

/**
 * One roster row. The roster is an `mlv-data-table`, so a row is the `<tr>` the
 * table renders — the only element that spans every projected cell (identity,
 * role control, two-factor badge and the row menu).
 */
function memberRow(rendered: Rendered, name: string): HTMLElement {
  return containingText(rendered.root, '.mlv-data-table__row--data', name);
}

/** Every roster row the table currently renders, in render order. */
function memberRows(rendered: Rendered): HTMLElement[] {
  return all(rendered.root, '.mlv-data-table__row--data');
}

/** Visible column headers of the roster table, in render order. */
function rosterHeaders(rendered: Rendered): string[] {
  return all(rendered.root, '.mlv-data-table__head th').map((th) =>
    (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** The `MlvDataTable` instance backing the roster. */
function rosterTable(
  rendered: Rendered,
): MlvDataTable<Record<string, unknown>> {
  return rendered.fixture.debugElement.query(By.directive(MlvDataTable))
    .componentInstance as MlvDataTable<Record<string, unknown>>;
}

/** Opens one `mlv-select` and picks the option reading `label`. */
async function pickOption(
  rendered: Rendered,
  select: HTMLElement,
  label: string,
): Promise<void> {
  select.querySelector<HTMLElement>('.mlv-select__trigger')?.click();
  await settle(rendered);
  byText(overlay(), '[role="option"]', label).click();
  await settle(rendered);
}

/** One tab in the section's tab strip, matched on its label text. */
function tab(rendered: Rendered, label: string): HTMLElement {
  const match = all(rendered.root, '[role="tab"]').find((el) =>
    el.textContent?.includes(label),
  );
  if (!match) throw new Error(`No tab "${label}"`);
  return match;
}

/** Every staged-change card in the aside, in render order. */
function records(rendered: Rendered): HTMLElement[] {
  return all(rendered.root, '.settings-access-showcase__change');
}

function recordText(record: HTMLElement, part: string): string {
  return (
    record
      .querySelector(`.settings-access-showcase__change-${part}`)
      ?.textContent?.trim() ?? ''
  );
}

/** A button in the page dock, matched on its label. */
function dockButton(rendered: Rendered, label: string): HTMLButtonElement {
  const match = all(
    rendered.root,
    '.settings-access-showcase__dock-end button',
  ).find((button) => button.textContent?.trim() === label);
  if (!match) throw new Error(`No dock button "${label}"`);
  return match as HTMLButtonElement;
}

/** Copy the dock's start slot is currently narrating. */
function dockNarration(rendered: Rendered): string {
  return (
    rendered.root
      .querySelector('.settings-access-showcase__dock-start')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

/** Sets a text control by driving the native `input` its `mlv-input` owns. */
function typeInto(host: ParentNode, value: string): void {
  const input = host.querySelector('input');
  if (!input) throw new Error('No native input inside the control');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The field wrapper the template gives every id-addressable control. */
function field(rendered: Rendered, id: string): HTMLElement {
  const host = rendered.root.querySelector<HTMLElement>(`[id="field-${id}"]`);
  if (!host) throw new Error(`No field wrapper for "${id}"`);
  return host;
}

/** The native checkbox behind an `mlv-switch`, matched on its label text. */
function switchInput(root: ParentNode, label: string): HTMLInputElement {
  const host = all(root, 'mlv-switch').find(
    (el) =>
      el.querySelector('.mlv-switch__label-text')?.textContent?.trim() ===
      label,
  );
  if (!host) throw new Error(`No switch labelled "${label}"`);
  const input = host.querySelector<HTMLInputElement>('input[role="switch"]');
  if (!input) throw new Error(`Switch "${label}" has no native input`);
  return input;
}

/** The CDK overlay container, where every dialog and drawer is portalled. */
function overlay(): HTMLElement {
  const container = document.querySelector<HTMLElement>(
    '.cdk-overlay-container',
  );
  if (!container) throw new Error('No CDK overlay container');
  return container;
}

/** A button inside an open overlay, matched on its label. */
function overlayButton(label: string): HTMLButtonElement {
  return byText(overlay(), 'button', label) as HTMLButtonElement;
}

/** Answers the `MlvDialogService.confirm()` dialog and waits out its close. */
async function answerConfirm(
  rendered: Rendered,
  answer: 'confirm' | 'cancel',
): Promise<void> {
  const button = overlay().querySelector<HTMLButtonElement>(
    `.mlv-confirm-dialog__${answer}`,
  );
  if (!button) throw new Error('No confirm dialog is open');
  button.click();
  await advance(rendered, DIALOG_LEAVE);
}

/** Types a code into an open `mlv-pin-input`, one cell at a time. */
async function typePin(
  rendered: Rendered,
  root: ParentNode,
  code: string,
): Promise<void> {
  for (let index = 0; index < code.length; index += 1) {
    const cell = all(root, 'mlv-pin-input .mlv-pin-input__cell')[index];
    if (!cell) throw new Error(`Pin input has no cell ${index}`);
    typeInto(cell, code[index]);
    await settle(rendered);
  }
}

/** Chip labels rendered by the tokenizer inside one id-addressable field. */
function tokenLabels(rendered: Rendered, id: string): string[] {
  return all(field(rendered, id), 'mlv-token .mlv-chip__label').map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function labelsOf(rendered: Rendered): string[] {
  return rendered.component.staged().map((change) => change.label);
}

/* -------------------------------------------------------------------------- */

describe('SettingsAccessShowcaseComponent', () => {
  beforeAll(() => {
    // jsdom ships no IntersectionObserver; `MlvDrawerSectionsService` builds one
    // eagerly to name its section navigator. This double mirrors the one thing
    // the real observer guarantees — a first delivery per observed target, the
    // topmost one reported as fully intersecting — so the navigator button has
    // the accessible name it would have in a browser.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private _seen = 0;
        constructor(private readonly _callback: IntersectionObserverCallback) {}
        observe(target: Element): void {
          const first = this._seen === 0;
          this._seen += 1;
          // Deliver out of band, exactly as the platform does: the service
          // observes from inside an `effect()` and reads its own signal in the
          // callback, so a synchronous delivery would make the effect depend on
          // the signal it writes.
          queueMicrotask(() =>
            this._callback(
              [
                {
                  target,
                  isIntersecting: first,
                  intersectionRatio: first ? 1 : 0,
                } as IntersectionObserverEntry,
              ],
              this as unknown as IntersectionObserver,
            ),
          );
        }
        unobserve(): void {
          /* no-op */
        }
        disconnect(): void {
          this._seen = 0;
        }
        takeRecords(): [] {
          return [];
        }
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  /* ---------------------------------------------------------------------- */
  /* §3 — the staged-change spine                                           */
  /* ---------------------------------------------------------------------- */

  it('opens on Profile with nothing staged and an empty change review', async () => {
    const rendered = await render();

    expect(rendered.component.activeSection()).toBe('profile');
    expect(rendered.root.querySelector('h1')?.textContent).toContain('Profile');
    expect(rendered.component.stagedCount()).toBe(0);
    expect(records(rendered)).toHaveLength(0);
    expect(
      rendered.root.querySelector('mlv-empty-state')?.textContent,
    ).toContain('Nothing staged');
    expect(dockNarration(rendered)).toContain('All changes saved');
    expect(dockButton(rendered, 'Save Profile').disabled).toBe(true);
    expect(dockButton(rendered, 'Revert').disabled).toBe(true);
  });

  it('trails the section as plain ancestors, never as disabled crumbs', async () => {
    const rendered = await render();

    // "Settings" and "Personal" have no route in this showcase, but they are
    // ancestors, not switched-off destinations. Marking them `disabled` told
    // assistive technology something false and dropped them to 1.42:1.
    const crumbs = all(rendered.root, '.mlv-breadcrumb__link');
    expect(crumbs.map((el) => el.textContent?.trim())).toEqual([
      'Settings',
      'Personal',
      'Profile',
    ]);
    expect(
      crumbs.filter((el) =>
        el.classList.contains('mlv-breadcrumb__link--disabled'),
      ),
    ).toHaveLength(0);
    expect(
      crumbs
        .filter((el) => el.classList.contains('mlv-breadcrumb__link--plain'))
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Settings', 'Personal']);
    expect(crumbs[2].getAttribute('aria-current')).toBe('page');
  });

  it('stages exactly one record with its label, values and consequence', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    await settle(rendered);

    expect(rendered.component.stagedCount()).toBe(1);
    const [record] = rendered.component.staged();
    expect(record.id).toBe('ws.name');
    expect(record.sectionId).toBe('general');
    expect(record.label).toBe('Workspace name');
    expect(record.oldValue).toBe(DEFAULTS['ws.name']);
    expect(record.newValue).toBe('Northwind Labs EU');
    expect(record.consequence).toBe(
      `Renames the workspace for all ${MEMBERS.length} members.`,
    );
    expect(record.severity).toBe('caution');
    expect(record.needsStepUp).toBe(false);

    const [card] = records(rendered);
    expect(recordText(card, 'label')).toBe('Workspace name');
    expect(recordText(card, 'old')).toBe(DEFAULTS['ws.name']);
    expect(recordText(card, 'new')).toBe('Northwind Labs EU');
    expect(recordText(card, 'consequence')).toBe(
      `Renames the workspace for all ${MEMBERS.length} members.`,
    );
    expect(dockNarration(rendered)).toContain('1 unsaved in General');
  });

  it('drops the record when the field is edited back to its baseline', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    await settle(rendered);
    expect(records(rendered)).toHaveLength(1);

    // Trailing whitespace still normalises back to the baseline.
    typeInto(field(rendered, 'ws.name'), `${DEFAULTS['ws.name']}  `);
    await settle(rendered);

    expect(rendered.component.stagedCount()).toBe(0);
    expect(records(rendered)).toHaveLength(0);
    expect(
      rendered.root.querySelector('mlv-empty-state')?.textContent,
    ).toContain('Nothing staged');
    expect(rendered.component.dockState()).toBe('clean');
  });

  it('reverts one record from its own Revert button', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    typeInto(field(rendered, 'ws.billingEmail'), 'accounts@northwind.com');
    await settle(rendered);
    expect(rendered.component.stagedCount()).toBe(2);

    rendered.root
      .querySelector<HTMLButtonElement>('[aria-label="Revert Workspace name"]')
      ?.click();
    await settle(rendered);

    expect(labelsOf(rendered)).toEqual(['Billing email']);
    expect(field(rendered, 'ws.name').querySelector('input')?.value).toBe(
      DEFAULTS['ws.name'],
    );
  });

  it('scopes the dock Revert to the current section only', async () => {
    vi.useFakeTimers();
    const rendered = await render();

    typeInto(field(rendered, 'profile.title'), 'Head of Everything');
    await settle(rendered);

    navRow(rendered, 'General').click();
    await answerConfirm(rendered, 'confirm');
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    typeInto(field(rendered, 'ws.billingEmail'), 'accounts@northwind.com');
    await settle(rendered);
    expect(rendered.component.stagedCount()).toBe(3);

    dockButton(rendered, 'Revert').click();
    await settle(rendered);
    // Two changes in the section, so the revert is guarded.
    expect(overlay().textContent).toContain('Revert 2 changes?');
    await answerConfirm(rendered, 'confirm');

    expect(labelsOf(rendered)).toEqual(['Job title']);
    expect(rendered.component.sectionStaged()).toHaveLength(0);
    expect(rendered.component.otherStagedCount()).toBe(1);
  });

  it('keeps every staged change across a section and a tab switch', async () => {
    vi.useFakeTimers();
    const rendered = await render();

    typeInto(field(rendered, 'profile.title'), 'Head of Everything');
    await settle(rendered);

    navRow(rendered, 'General').click();
    await answerConfirm(rendered, 'confirm');
    await advance(rendered, COLLECTION_DELAY);
    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    await settle(rendered);

    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);
    switchInput(rendered.root, 'Enforce single sign-on').click();
    await settle(rendered);

    // A tab switch inside the dirty section never re-seeds the draft either.
    tab(rendered, 'Sessions').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Policies').click();
    await advance(rendered, COLLECTION_DELAY);

    expect(labelsOf(rendered)).toEqual([
      'Job title',
      'Workspace name',
      'Enforce single sign-on',
    ]);
    expect(switchInput(rendered.root, 'Enforce single sign-on').checked).toBe(
      true,
    );

    // Walking back re-renders the still-edited values from the same draft.
    navRow(rendered, 'Profile').click();
    await advance(rendered, COLLECTION_DELAY);
    expect(field(rendered, 'profile.title').querySelector('input')?.value).toBe(
      'Head of Everything',
    );
    expect(rendered.component.stagedCount()).toBe(3);

    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);
    expect(field(rendered, 'ws.name').querySelector('input')?.value).toBe(
      'Northwind Labs EU',
    );
    expect(rendered.component.stagedCount()).toBe(3);
  });

  it('lets the staged count override a resting sidebar badge', async () => {
    vi.useFakeTimers();
    const rendered = await render();

    // Members rests at "3 invitations waiting".
    expect(navBadge(rendered, 'Members & roles')?.textContent?.trim()).toBe(
      '3',
    );
    expect(
      rendered.component.badgeToneFor({
        id: 'members',
        label: 'Members & roles',
        restingBadge: '3',
        restingTone: 'info',
        tooltip: null,
      }),
    ).toBe('info');

    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Roles').click();
    await settle(rendered);
    switchInput(
      rendered.root,
      'Allow members to change their own role',
    ).click();
    await settle(rendered);

    expect(navBadge(rendered, 'Members & roles')?.textContent?.trim()).toBe(
      '1',
    );
    const item = {
      id: 'members' as const,
      label: 'Members & roles',
      restingBadge: '3',
      restingTone: 'info' as const,
      tooltip: null,
    };
    expect(rendered.component.badgeFor(item)).toBe('1');
    expect(rendered.component.badgeToneFor(item)).toBe('warning');
    expect(rendered.component.badgePulseFor(item)).toBe(true);
  });

  /* ---------------------------------------------------------------------- */
  /* §4a — save success                                                     */
  /* ---------------------------------------------------------------------- */

  it('walks the dock from dirty to saving to saved and replaces the baseline', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    const activityBefore = rendered.component.activity().length;
    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    await settle(rendered);
    expect(rendered.component.dockState()).toBe('dirty');

    const saving = rendered.component.saveSection();
    await settle(rendered);
    expect(rendered.component.dockState()).toBe('saving');
    expect(dockNarration(rendered)).toContain('Saving 1 change');
    expect(rendered.component.statusLabel()).toBe('Saving');

    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await saving;
    await settle(rendered);

    expect(rendered.component.dockState()).toBe('just-saved');
    expect(dockNarration(rendered)).toContain('Saved 1 change');
    expect(rendered.component.stagedCount()).toBe(0);
    expect(records(rendered)).toHaveLength(0);
    expect(rendered.component.activity()).toHaveLength(activityBefore + 1);
    expect(rendered.component.activity()[0].action).toBe(
      'Saved 1 change in General',
    );

    // The baseline moved: editing back to the old value stages a record again.
    typeInto(field(rendered, 'ws.name'), DEFAULTS['ws.name'] as string);
    await settle(rendered);
    expect(rendered.component.staged()[0].oldValue).toBe('Northwind Labs EU');
  });

  it('settles the dock back to clean once the just-saved window closes', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    await settle(rendered);
    const saving = rendered.component.saveSection();
    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await saving;
    await settle(rendered);
    expect(rendered.component.statusLabel()).toBe('Saved');

    await advance(rendered, JUST_SAVED);
    expect(rendered.component.dockState()).toBe('clean');
    expect(rendered.component.statusLabel()).toBe('Up to date');
    expect(dockNarration(rendered)).toContain('All changes saved');
  });

  /* ---------------------------------------------------------------------- */
  /* §4a′ — seeded server rejection                                         */
  /* ---------------------------------------------------------------------- */

  it('applies the rest and keeps the rejected slug staged and erroring', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    const [taken] = TAKEN_SLUGS;
    typeInto(field(rendered, 'ws.slug'), taken);
    typeInto(field(rendered, 'ws.name'), 'Northwind Labs EU');
    typeInto(field(rendered, 'ws.billingEmail'), 'accounts@northwind.com');
    await settle(rendered);
    expect(rendered.component.stagedCount()).toBe(3);

    const saving = rendered.component.saveSection();
    await vi.advanceTimersByTimeAsync(SLOW_DELAY * 2);
    await saving;
    await settle(rendered);

    expect(labelsOf(rendered)).toEqual(['Workspace address']);
    expect(rendered.component.rejectedFieldId()).toBe('ws.slug');
    expect(rendered.component.rejectedMessage()).toBe(
      `${taken} is already taken by another workspace. Try northwind-labs-eu.`,
    );
    expect(rendered.component.fieldState('ws.slug')).toBe('error');
    // The typed value is kept, never rolled back.
    expect(field(rendered, 'ws.slug').querySelector('input')?.value).toBe(
      taken,
    );

    expect(rendered.component.dockState()).toBe('partially-failed');
    expect(dockNarration(rendered)).toContain(
      '2 of 3 saved · 1 needs attention',
    );
    expect(dockButton(rendered, 'Try again')).toBeTruthy();

    const alert = containingText(
      rendered.root,
      'mlv-alert',
      'could not be saved',
    );
    expect(alert.getAttribute('role')).toBe('alert');
    expect(records(rendered)[0].textContent).toContain(
      'Rejected by the server',
    );
  });

  it('discards the rejected field and returns the dock to clean', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.slug'), TAKEN_SLUGS[0]);
    await settle(rendered);
    const saving = rendered.component.saveSection();
    await vi.advanceTimersByTimeAsync(SLOW_DELAY * 2);
    await saving;
    await settle(rendered);
    expect(rendered.component.dockState()).toBe('partially-failed');

    dockButton(rendered, 'Discard the rest').click();
    await settle(rendered);

    expect(rendered.component.stagedCount()).toBe(0);
    expect(rendered.component.rejectedFieldId()).toBeNull();
    expect(rendered.component.dockState()).toBe('clean');
    expect(field(rendered, 'ws.slug').querySelector('input')?.value).toBe(
      DEFAULTS['ws.slug'],
    );
  });

  /* ---------------------------------------------------------------------- */
  /* §4b — invitations                                                      */
  /* ---------------------------------------------------------------------- */

  it('bounces the seeded address, keeps the dialog open and holds the token', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Invitations').click();
    await settle(rendered);

    const before = rendered.component.invitations().length;
    byText(rendered.root, 'button', 'Invite people').click();
    await advance(rendered, DIALOG_LEAVE);

    const [bounced] = BOUNCED_INVITE_EMAILS;
    const fresh = 'nadia.rahman@northwind.com';
    rendered.component.inviteEmails.set([
      { label: fresh, value: fresh },
      { label: bounced, value: bounced },
    ]);
    await settle(rendered);

    // §4b steps 7 and 9: the seeded bounce address has to be sendable, or the
    // bounce path is unreachable from a clean page.
    expect(rendered.component.inviteClassification().valid).toEqual([
      fresh,
      bounced,
    ]);
    expect(rendered.component.canInvite()).toBe(true);

    const sending = rendered.component.sendInvitations();
    await settle(rendered);
    // Both rows are appended optimistically before any request resolves.
    expect(rendered.component.invitations()).toHaveLength(before + 2);
    expect(rendered.component.invitations()[0].state).toBe('sending');

    await vi.advanceTimersByTimeAsync(SLOW_DELAY * 3);
    await sending;
    await settle(rendered);

    expect(rendered.component.inviteOpen()).toBe(true);
    expect(rendered.component.inviteBounced()).toEqual([bounced]);
    expect(rendered.component.inviteEmails().map((t) => t.value)).toEqual([
      bounced,
    ]);
    // Contract §4b step 9 and the §8.2 copy deck: once an address bounces the
    // footer offers a retry, not a fresh send.
    expect(rendered.component.inviteSubmitLabel()).toBe('Retry 1 invitation');

    const states = rendered.component
      .invitations()
      .filter((invitation) => invitation.invitedBy === 'Dana Whitfield')
      .slice(0, 2)
      .map((invitation) => invitation.state);
    expect(states).toEqual(expect.arrayContaining(['pending', 'bounced']));
    expect(overlay().textContent).toContain('bounced');
  });

  /* ---------------------------------------------------------------------- */
  /* §4c / §5.4b — the sole owner                                           */
  /* ---------------------------------------------------------------------- */

  it('blocks the sole owner from changing their own role', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    const owner = MEMBERS.find((member) => member.id === SOLE_OWNER_MEMBER_ID);
    if (!owner) throw new Error('Fixtures have no sole owner');
    expect(rendered.component.isSoleOwner(SOLE_OWNER_MEMBER_ID)).toBe(true);

    const row = memberRow(rendered, owner.name);
    // The role control is blocked and says so visually through `[state]`.
    const select = row.querySelector<HTMLElement>('mlv-select');
    expect(select?.className).toContain('mlv-select--warning');
    expect(
      row
        .querySelector('mlv-select .mlv-select__trigger')
        ?.getAttribute('aria-disabled'),
    ).toBe('true');
    // The 68-character reason no longer fits a table cell as an inline
    // `[message]`; it is the info button's tooltip instead.
    const why = row.querySelector('[aria-label="Why this cannot change"]');
    expect(why?.getAttribute('mlvTooltip')).toBe(
      'You are the only owner. Transfer ownership before you change your role.',
    );

    // Belt and braces: the model refuses the write even when called directly.
    rendered.component.stageMemberRole(SOLE_OWNER_MEMBER_ID, 'admin');
    await settle(rendered);
    expect(rendered.component.stagedCount()).toBe(0);
    expect(rendered.component.roleOf(SOLE_OWNER_MEMBER_ID)).toBe('owner');

    // A teammate is not blocked, and the record carries the move consequence.
    const teammate = MEMBERS.find(
      (member) => member.id !== SOLE_OWNER_MEMBER_ID && member.role === 'admin',
    );
    if (!teammate) throw new Error('Fixtures have no second admin');
    rendered.component.stageMemberRole(teammate.id, 'analyst');
    await settle(rendered);
    expect(rendered.component.staged()[0].consequence).toBe(
      `${teammate.name} moves from Admin to Analyst across ${teammate.projects.length} projects.`,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* The roster data table                                                  */
  /* ---------------------------------------------------------------------- */

  it('renders the roster as a data table with its projected cells', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    expect(
      rendered.root.querySelector(
        'mlv-data-table.settings-access-showcase__roster',
      ),
    ).toBeTruthy();
    // No hand-rolled list survives, and no second search / role / two-factor
    // control competes with the table's own toolbar.
    expect(
      rendered.root.querySelector('.settings-access-showcase__roster-toolbar'),
    ).toBeNull();
    expect(
      rendered.root.querySelectorAll('mlv-data-table mlv-search-field'),
    ).toHaveLength(0);

    const headers = rosterHeaders(rendered);
    expect(headers).toContain('Member');
    expect(headers).toContain('Role');
    expect(headers).toContain('Two-factor');
    expect(headers).toContain('Actions');

    const teammate = MEMBERS[1];
    const row = memberRow(rendered, teammate.name);
    // Every rich cell is a projected template, not a stringified value.
    expect(row.querySelector('mlv-avatar')).toBeTruthy();
    expect(
      row
        .querySelector('.settings-access-showcase__member-name')
        ?.textContent?.trim(),
    ).toBe(teammate.name);
    expect(row.querySelector('mlv-select')).toBeTruthy();
    expect(
      row.querySelector('.settings-access-showcase__member-role mlv-select'),
    ).toBeTruthy();
    expect(
      containingText(row, 'mlv-badge', teammate.twoFactor ? 'On' : 'Off'),
    ).toBeTruthy();
    expect(
      row.querySelector(`[aria-label="Actions for ${teammate.name}"]`),
    ).toBeTruthy();
  });

  it('stages a role from the table role cell and marks the row unsaved', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    const teammate = MEMBERS.find((member) => member.role === 'member');
    if (!teammate) throw new Error('Fixtures have no plain member');

    const select = memberRow(
      rendered,
      teammate.name,
    ).querySelector<HTMLElement>('mlv-select');
    if (!select) throw new Error('The role cell projected no select');
    await pickOption(rendered, select, 'Analyst');

    expect(rendered.component.roleOf(teammate.id)).toBe('analyst');
    expect(rendered.component.stagedCount()).toBe(1);
    expect(records(rendered)).toHaveLength(1);
    expect(rendered.component.dockState()).toBe('dirty');
    // The unsaved marker is rendered by the same projected cell.
    expect(
      memberRow(rendered, teammate.name)
        .querySelector('.settings-access-showcase__member-role mlv-badge')
        ?.textContent?.trim(),
    ).toBe('Unsaved');
  });

  it('filters the roster through the table, on the staged role', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    const analysts = MEMBERS.filter((member) => member.role === 'analyst');
    rosterTable(rendered).activeFilters.set([
      { key: 'role', operator: 'equals', value: 'analyst' },
    ]);
    await settle(rendered);
    expect(memberRows(rendered)).toHaveLength(analysts.length);

    // A staged role moves its row under the table's filter, exactly as the
    // hand-rolled draft-aware filter used to.
    const promoted = MEMBERS.find((member) => member.role === 'member');
    if (!promoted) throw new Error('Fixtures have no plain member');
    rendered.component.stageMemberRole(promoted.id, 'analyst');
    await settle(rendered);
    expect(memberRows(rendered)).toHaveLength(analysts.length + 1);
    expect(memberRow(rendered, promoted.name)).toBeTruthy();
  });

  it('searches the roster through the table and offers its no-data template', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    const teammate = MEMBERS[1];
    const search = rendered.root.querySelector<HTMLElement>(
      '.settings-access-showcase__search',
    );
    if (!search) throw new Error('The header renders no roster search');

    typeInto(search, teammate.email);
    await advance(rendered, 200);
    expect(memberRows(rendered)).toHaveLength(1);
    expect(memberRows(rendered)[0].textContent).toContain(teammate.name);

    typeInto(search, 'zzzz');
    await advance(rendered, 200);
    expect(memberRows(rendered)).toHaveLength(0);
    const empty = rendered.root.querySelector('mlv-data-table mlv-empty-state');
    expect(empty?.textContent).toContain('No members match "zzzz"');

    byText(rendered.root, 'button', 'Clear search').click();
    await advance(rendered, 200);
    expect(rendered.component.rosterQuery()).toBe('');
    expect(memberRows(rendered).length).toBeGreaterThan(1);
  });

  /* ---------------------------------------------------------------------- */
  /* §4e — sessions                                                         */
  /* ---------------------------------------------------------------------- */

  it('removes a revoked session optimistically and offers an inline undo', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Sessions').click();
    await advance(rendered, COLLECTION_DELAY);

    const target = SESSIONS.find(
      (session) => !session.isCurrent && !session.revokeFails,
    );
    if (!target) throw new Error('Fixtures have no revocable session');

    const revoking = rendered.component.revokeSession(target);
    await settle(rendered);

    expect(rendered.component.sessions().some((s) => s.id === target.id)).toBe(
      false,
    );
    expect(rendered.component.sessionAlert()?.tone).toBe('info');
    expect(byText(rendered.root, 'button', 'Undo')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await revoking;
    await settle(rendered);
    expect(rendered.component.sessions().some((s) => s.id === target.id)).toBe(
      false,
    );

    rendered.component.undoRevoke();
    await settle(rendered);
    expect(
      rendered.component
        .sessions()
        .map((s) => s.id)
        .indexOf(target.id),
    ).toBe(SESSIONS.findIndex((s) => s.id === target.id));
    expect(rendered.component.sessionAlert()).toBeNull();
  });

  it('puts the seeded failing session back with a danger alert', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Sessions').click();
    await advance(rendered, COLLECTION_DELAY);

    const target = SESSIONS.find((s) => s.id === REVOKE_FAILS_SESSION_ID);
    if (!target) throw new Error('Fixtures have no failing session');

    const revoking = rendered.component.revokeSession(target);
    await settle(rendered);
    expect(rendered.component.sessions().some((s) => s.id === target.id)).toBe(
      false,
    );

    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await revoking;
    await settle(rendered);

    expect(rendered.component.sessions()).toHaveLength(SESSIONS.length);
    expect(
      rendered.component.sessions().findIndex((s) => s.id === target.id),
    ).toBe(SESSIONS.findIndex((s) => s.id === target.id));
    expect(rendered.component.sessionAlert()?.tone).toBe('danger');
    expect(rendered.component.sessionAlert()?.text).toBe(
      'That session could not be signed out. It may already have expired.',
    );
  });

  it('never lets the current session be revoked', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Sessions').click();
    await advance(rendered, COLLECTION_DELAY);

    const current = SESSIONS.find((s) => s.id === CURRENT_SESSION_ID);
    if (!current) throw new Error('Fixtures have no current session');

    const row = containingText(
      rendered.root,
      '.settings-access-showcase__session',
      current.ip,
    );
    expect(row.textContent).toContain('This device');
    const revoke = byText(row, 'button', 'Revoke') as HTMLButtonElement;
    expect(revoke.disabled).toBe(true);

    await rendered.component.revokeSession(current);
    await settle(rendered);
    expect(rendered.component.sessions()).toHaveLength(SESSIONS.length);
  });

  /* ---------------------------------------------------------------------- */
  /* §4f — API key rotation behind a step-up                                */
  /* ---------------------------------------------------------------------- */

  it('counts wrong step-up codes down and locks out after the last one', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'API access').click();
    await advance(rendered, COLLECTION_DELAY);

    const key = API_KEYS.find((entry) => entry.id === DELETE_DEMO_KEY_ID);
    if (!key) throw new Error('Fixtures have no second key');
    rendered.component.requestRotate(key);
    await advance(rendered, DIALOG_LEAVE);
    expect(rendered.component.stepUpAttempts()).toBe(STEP_UP_MAX_ATTEMPTS);

    for (let attempt = 1; attempt < STEP_UP_MAX_ATTEMPTS; attempt += 1) {
      await rendered.component.verifyStepUp('000000');
      await settle(rendered);
      const left = STEP_UP_MAX_ATTEMPTS - attempt;
      expect(rendered.component.stepUpAttempts()).toBe(left);
      expect(rendered.component.stepUpState()).toBe('error');
      expect(rendered.component.stepUpHint()).toBe(
        `That code is not right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
      );
      expect(rendered.component.lockedOut()).toBe(false);
    }

    await rendered.component.verifyStepUp('000000');
    await settle(rendered);
    expect(rendered.component.lockedOut()).toBe(true);
    expect(rendered.component.stepUpHint()).toBe('Too many wrong codes.');
    expect(overlay().textContent).toContain('Locked for 30 seconds');
    expect(rendered.component.stepUpOpen()).toBe(true);

    // A code entered while locked out is ignored entirely.
    await rendered.component.verifyStepUp(STEP_UP_CODE);
    await settle(rendered);
    expect(rendered.component.stepUpOpen()).toBe(true);

    await advance(rendered, STEP_UP_LOCKOUT_MS + 1000);
    expect(rendered.component.lockedOut()).toBe(false);
    expect(rendered.component.stepUpAttempts()).toBe(STEP_UP_MAX_ATTEMPTS);
  });

  it('rotates the seeded key only on the second attempt', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'API access').click();
    await advance(rendered, COLLECTION_DELAY);

    const key = API_KEYS.find((entry) => entry.id === ROTATION_FAILS_KEY_ID);
    if (!key) throw new Error('Fixtures have no rotation-failing key');

    byText(
      containingText(rendered.root, 'mlv-card', key.name),
      'button',
      'Rotate',
    ).click();
    await advance(rendered, DIALOG_LEAVE);
    expect(rendered.component.stepUpOpen()).toBe(true);
    expect(overlay().textContent).toContain(`Rotating ${key.name}`);

    await typePin(rendered, overlay(), STEP_UP_CODE);
    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await advance(rendered, DIALOG_LEAVE);

    expect(rendered.component.stepUpOpen()).toBe(false);
    expect(rendered.component.keyErrors()[key.id]).toBe(
      'Rotation failed. The old secret is still live.',
    );
    expect(rendered.component.revealedSecrets()[key.id]).toBeUndefined();

    // Second attempt: the fixture flag is spent, so it succeeds.
    byText(
      containingText(rendered.root, 'mlv-card', key.name),
      'button',
      'Rotate',
    ).click();
    await advance(rendered, DIALOG_LEAVE);
    await typePin(rendered, overlay(), STEP_UP_CODE);
    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await advance(rendered, DIALOG_LEAVE);

    expect(rendered.component.keyErrors()[key.id]).toBeUndefined();
    expect(rendered.component.revealedSecrets()[key.id]).toBeTruthy();
    expect(
      rendered.component.apiKeys().find((entry) => entry.id === key.id)?.prefix,
    ).not.toBe(key.prefix);
    expect(rendered.component.activity()[0].action).toBe(
      `Rotated the ${key.name} key`,
    );
    expect(
      containingText(rendered.root, 'mlv-card', key.name).textContent,
    ).toContain('You will not see it again.');
  });

  /* ---------------------------------------------------------------------- */
  /* §4g — lowering two-factor enforcement                                  */
  /* ---------------------------------------------------------------------- */

  it('intercepts the two-factor switch before it flips', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);

    // Raise it first (no step-up) and save, so lowering is a real lowering.
    switchInput(rendered.root, 'Require two-factor authentication').click();
    await settle(rendered);
    expect(rendered.component.staged()[0].consequence).toBe(
      `${rendered.component.without2faCount()} members would be locked out until they enrol.`,
    );
    const saving = rendered.component.saveSection();
    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await saving;
    await settle(rendered);
    expect(rendered.component.bool('sec.require2fa')).toBe(true);

    // Lowering opens the blast-radius dialog and changes nothing yet.
    switchInput(rendered.root, 'Require two-factor authentication').click();
    await advance(rendered, DIALOG_LEAVE);
    expect(rendered.component.twoFactorOpen()).toBe(true);
    expect(rendered.component.bool('sec.require2fa')).toBe(true);
    expect(rendered.component.stagedCount()).toBe(0);
    // §4g step 2: the control must still read "on" while the dialog decides.
    const toggle = switchInput(
      rendered.root,
      'Require two-factor authentication',
    );
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.checked).toBe(true);
    expect(overlayButton('Turn it off').disabled).toBe(true);

    // A wrong code keeps the action locked.
    await typePin(rendered, overlay(), '000000');
    expect(rendered.component.twoFactorVerified()).toBe(false);
    expect(rendered.component.twoFactorMessage()).toBe(
      'That code is not right.',
    );
    expect(overlayButton('Turn it off').disabled).toBe(true);

    await typePin(rendered, overlay(), STEP_UP_CODE);
    expect(rendered.component.twoFactorVerified()).toBe(true);
    overlayButton('Turn it off').click();
    await advance(rendered, DIALOG_LEAVE);

    expect(rendered.component.twoFactorOpen()).toBe(false);
    expect(rendered.component.bool('sec.require2fa')).toBe(false);
    const [record] = rendered.component.staged();
    expect(record.id).toBe('sec.require2fa');
    expect(record.severity).toBe('blocking');
    expect(record.consequence).toBe(
      `Removes the two-factor requirement for all ${MEMBERS.length} members.`,
    );
    // Staged, never saved.
    expect(rendered.component.dockState()).toBe('dirty');
    expect(
      containingText(rendered.root, 'mlv-alert', 'Removes the two-factor'),
    ).toBeTruthy();
  });

  it('leaves two-factor untouched when the blast-radius dialog is cancelled', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);

    switchInput(rendered.root, 'Require two-factor authentication').click();
    await settle(rendered);
    const saving = rendered.component.saveSection();
    await vi.advanceTimersByTimeAsync(SLOW_DELAY);
    await saving;
    await settle(rendered);

    switchInput(rendered.root, 'Require two-factor authentication').click();
    await advance(rendered, DIALOG_LEAVE);
    overlayButton('Cancel').click();
    await advance(rendered, DIALOG_LEAVE);

    expect(rendered.component.twoFactorOpen()).toBe(false);
    expect(rendered.component.bool('sec.require2fa')).toBe(true);
    expect(rendered.component.stagedCount()).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /* §5 — states that are not the happy path                                */
  /* ---------------------------------------------------------------------- */

  it('disables Save and names the reason while a field is invalid', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'General').click();
    await advance(rendered, COLLECTION_DELAY);

    typeInto(field(rendered, 'ws.slug'), 'Not A Slug');
    await settle(rendered);

    expect(rendered.component.fieldState('ws.slug')).toBe('error');
    expect(rendered.component.saveBlockedReason()).toBe(
      'Fix Workspace address before saving.',
    );
    const save = dockButton(rendered, 'Save General');
    expect(save.disabled).toBe(true);

    await rendered.component.saveSection();
    await settle(rendered);
    expect(rendered.component.preflightBlocked()).toBe(true);
    expect(rendered.component.stagedCount()).toBe(1);
    expect(rendered.component.dockState()).toBe('dirty');
  });

  it('turns the Danger zone read-only for a non-owner viewer', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Danger zone').click();
    await advance(rendered, COLLECTION_DELAY);

    expect(rendered.component.isOwner()).toBe(true);
    expect(
      all(rendered.root, '.settings-access-showcase__danger-card button').every(
        (button) => !(button as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
    expect(rendered.component.statusLabel()).toBe('Up to date');

    switchInput(rendered.root, 'View as admin').click();
    await settle(rendered);

    expect(rendered.component.viewerRole()).toBe('admin');
    expect(rendered.component.statusLabel()).toBe('Read only');
    const buttons = all(
      rendered.root,
      '.settings-access-showcase__danger-card button',
    ) as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(
      containingText(rendered.root, 'mlv-alert', 'Owner only').textContent,
    ).toContain(`${WORKSPACE.name}`);

    // A disabled button is not the only explanation, and the guard holds.
    rendered.component.openTransfer();
    rendered.component.openDelete();
    await settle(rendered);
    expect(rendered.component.transferOpen()).toBe(false);
    expect(rendered.component.deleteOpen()).toBe(false);
  });

  /* ---------------------------------------------------------------------- */
  /* §6.6 — tokenizer fields                                                */
  /* ---------------------------------------------------------------------- */

  it('renders the seeded Security tokens and stages nothing on load', async () => {
    vi.useFakeTimers();
    const rendered = await render();

    navRow(rendered, 'Security').click();
    await advance(rendered, COLLECTION_DELAY);

    expect(tokenLabels(rendered, 'sec.allowedDomains')).toEqual(
      DEFAULTS['sec.allowedDomains'],
    );
    expect(tokenLabels(rendered, 'sec.alertRecipients')).toEqual(
      DEFAULTS['sec.alertRecipients'],
    );

    // The tokenizers bind `value` only — the legacy `tokens` alias must not
    // write its empty default back and stage a phantom edit.
    expect(rendered.component.stagedCount()).toBe(0);
    expect(records(rendered)).toHaveLength(0);
    expect(dockButton(rendered, 'Save Security').disabled).toBe(true);
  });

  /* ---------------------------------------------------------------------- */
  /* §6.7 — axe                                                             */
  /* ---------------------------------------------------------------------- */

  const runAxe = (root: Element) =>
    axe.run(root, { rules: { 'color-contrast': { enabled: false } } });

  it('keeps the default section axe-clean', async () => {
    const rendered = await render();
    expect((await runAxe(rendered.root)).violations).toEqual([]);
  });

  it('keeps each tabbed section axe-clean', async () => {
    vi.useFakeTimers();
    const rendered = await render();

    const states: readonly (readonly [string, string])[] = [
      ['Notifications', 'Delivery'],
      ['Members & roles', 'Members'],
      ['Security', 'Policies'],
      ['API access', 'Keys'],
    ];

    for (const [section, tabLabel] of states) {
      navRow(rendered, section).click();
      await advance(rendered, COLLECTION_DELAY);
      tab(rendered, tabLabel).click();
      await advance(rendered, COLLECTION_DELAY);
      vi.useRealTimers();
      const result = await runAxe(rendered.root);
      expect(result.violations, `${section} / ${tabLabel}`).toEqual([]);
      vi.useFakeTimers();
    }
  });

  it('keeps the roster axe-clean with the member drawer open', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);

    const teammate = MEMBERS.find((m) => m.id !== SOLE_OWNER_MEMBER_ID);
    if (!teammate) throw new Error('Fixtures have no teammate');
    memberRow(rendered, teammate.name)
      .querySelector<HTMLButtonElement>(
        '.settings-access-showcase__member-name',
      )
      ?.click();
    await advance(rendered, DIALOG_LEAVE);

    expect(rendered.component.memberDrawerOpen()).toBe(true);
    expect(
      overlay().querySelector('mlv-drawer')?.getAttribute('aria-label') ??
        document
          .querySelector('[aria-label^="Access for"]')
          ?.getAttribute('aria-label'),
    ).toContain(teammate.name);

    vi.useRealTimers();
    expect((await runAxe(document.body)).violations).toEqual([]);
  });

  it('keeps the invite dialog axe-clean', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'Members & roles').click();
    await advance(rendered, COLLECTION_DELAY);
    tab(rendered, 'Invitations').click();
    await settle(rendered);

    byText(rendered.root, 'button', 'Invite people').click();
    await advance(rendered, DIALOG_LEAVE);
    expect(rendered.component.inviteOpen()).toBe(true);

    vi.useRealTimers();
    expect((await runAxe(document.body)).violations).toEqual([]);
  });

  it('keeps the step-up dialog axe-clean', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    navRow(rendered, 'API access').click();
    await advance(rendered, COLLECTION_DELAY);

    const key = API_KEYS[0];
    byText(
      containingText(rendered.root, 'mlv-card', key.name),
      'button',
      'Rotate',
    ).click();
    await advance(rendered, DIALOG_LEAVE);
    expect(rendered.component.stepUpOpen()).toBe(true);

    vi.useRealTimers();
    expect((await runAxe(document.body)).violations).toEqual([]);
  });
});
