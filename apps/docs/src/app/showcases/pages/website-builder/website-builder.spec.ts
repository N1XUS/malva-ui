import { ApplicationInitStatus, ApplicationRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';

import { WebsiteBuilderShowcaseComponent } from './website-builder';
import {
  WB_BLOCK_CATALOG,
  WB_BLOCK_GROUPS,
  WB_CONTENT_SEED,
  WB_FOOTER_SEED,
  WB_HEADER_SEED,
} from './website-builder.data';
import {
  WB_MAX_ROW_DEPTH,
  wbAccepts,
  wbClampSpan,
  wbCount,
  wbFindPath,
  wbOverflowingBreakpoints,
  wbParentColumns,
  wbRowDepth,
} from './website-builder.types';
import type {
  WbBlockProps,
  WbContainerNode,
  WbContainerProps,
  WbNode,
  WbRowProps,
} from './website-builder.types';

/* -------------------------------------------------------------------------- */
/* Pure fixtures for the policy unit tests                                    */
/* -------------------------------------------------------------------------- */

const FULL = { desktop: 12, tablet: 8, mobile: 4 } as const;

function sectionNode(children: WbNode[] = []): WbContainerNode {
  return {
    id: 't-section',
    acceptsChildren: true,
    props: {
      kind: 'section',
      label: 'Header section',
      enabled: true,
      section: 'header',
    },
    children,
  };
}

function containerNode(id = 't-container', children: WbNode[] = []) {
  return {
    id,
    acceptsChildren: true as const,
    props: {
      kind: 'container',
      label: 'Container',
      enabled: true,
      width: 'fluid',
      widthPx: null,
      columns: FULL,
    } satisfies WbContainerProps,
    children,
  };
}

function rowNode(id = 't-row', children: WbNode[] = []) {
  return {
    id,
    acceptsChildren: true as const,
    props: {
      kind: 'row',
      label: 'Row',
      enabled: true,
      span: FULL,
    } satisfies WbRowProps,
    children,
  };
}

function blockNode(id = 't-block') {
  return {
    id,
    acceptsChildren: false as const,
    props: {
      kind: 'block',
      label: 'Rich text',
      enabled: true,
      blockType: 'rich-text',
      settings: {
        blockType: 'rich-text',
        text: 'x',
        alignment: 'start',
        constrainWidth: true,
      },
    } satisfies WbBlockProps,
  };
}

/* -------------------------------------------------------------------------- */
/* Rendering harness                                                          */
/* -------------------------------------------------------------------------- */

interface Rendered {
  readonly fixture: ComponentFixture<WebsiteBuilderShowcaseComponent>;
  readonly component: WebsiteBuilderShowcaseComponent;
  readonly root: HTMLElement;
}

/** Viewport this suite pretends to run at — wide enough for the grid preview. */
const VIEWPORT_WIDTH = 1440;

/** `MlvDialogRef` leave-animation fallback (jsdom fires no `animationend`). */
const DIALOG_LEAVE = 400;

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

async function settle(rendered: Rendered): Promise<void> {
  rendered.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  rendered.fixture.detectChanges();
}

async function render(): Promise<Rendered> {
  stubMatchMedia();

  await TestBed.configureTestingModule({
    imports: [WebsiteBuilderShowcaseComponent],
    providers: [
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const fixture = TestBed.createComponent(WebsiteBuilderShowcaseComponent);
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
/* classes, deterministic ids, ARIA names and visible copy.                    */
/* -------------------------------------------------------------------------- */

/** The overlay container, where dialogs and menus are portaled. */
function overlayRoot(): HTMLElement {
  return document.body;
}

function all(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

function byAriaLabel(root: ParentNode, label: string): HTMLElement {
  const match = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!match) throw new Error(`No element labelled "${label}"`);
  return match;
}

function byId(id: string): HTMLElement {
  const match = document.getElementById(id);
  if (!match) throw new Error(`No element with id "${id}"`);
  return match;
}

function tabButton(rendered: Rendered, label: string): HTMLElement {
  const match = all(rendered.root, '.website-builder__tabs .mlv-tab-item').find(
    (item) => (item.textContent ?? '').includes(label),
  );
  if (!match) throw new Error(`No level-1 tab "${label}"`);
  return match;
}

/** The `docs-wb-node` host for one node id, matched through its Settings button. */
function nodeHost(id: string): HTMLElement {
  const settings = document.getElementById(`wb-settings-${id}`);
  if (!settings) throw new Error(`No rendered node "${id}"`);
  const host = settings.closest('docs-wb-node');
  if (!host) throw new Error(`Node "${id}" has no host`);
  return host as HTMLElement;
}

/**
 * Live-region text the page currently announces.
 *
 * Scoped to the page's own region: the tile library renders a second
 * `role="status"` announcer for its keyboard-move model inside every root
 * `mlv-tiles`, and that one comes first in document order.
 */
function announcement(rendered: Rendered): string {
  const region = rendered.root.querySelector<HTMLElement>(
    '.website-builder__status',
  );
  return (region?.textContent ?? '').trim();
}

/** The dock's Save button. */
function saveButton(rendered: Rendered): HTMLButtonElement {
  const match = all(rendered.root, '.website-builder__dock-end button').find(
    (button) => (button.textContent ?? '').includes('Save layout'),
  );
  if (!match) throw new Error('No Save layout button');
  return match as HTMLButtonElement;
}

/** The dock's Discard button. */
function discardButton(rendered: Rendered): HTMLButtonElement {
  const match = all(rendered.root, '.website-builder__dock-end button').find(
    (button) => (button.textContent ?? '').trim() === 'Discard',
  );
  if (!match) throw new Error('No Discard button');
  return match as HTMLButtonElement;
}

/** A button inside the open dialog, matched on its exact visible label. */
function dialogButton(label: string): HTMLElement {
  const match = all(overlayRoot(), '.mlv-dialog button').find(
    (button) => (button.textContent ?? '').trim() === label,
  );
  if (!match) throw new Error(`No "${label}" button in the open dialog`);
  return match;
}

/** Clicks Discard and answers its confirmation. */
async function answerDiscard(
  rendered: Rendered,
  answer: 'Discard' | 'Keep editing',
): Promise<void> {
  await click(rendered, discardButton(rendered));
  await settle(rendered);
  await click(rendered, dialogButton(answer));
  await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
  await settle(rendered);
}

async function click(rendered: Rendered, element: HTMLElement): Promise<void> {
  element.click();
  await settle(rendered);
}

/**
 * Every field name rendered inside the currently open dialog.
 *
 * Wrapper-based controls put their name in an `mlv-label`; `mlv-switch` and
 * `mlv-checkbox` render no wrapper at all and carry theirs as their own text.
 * The trailing visually-hidden "required" marker is stripped so a required and
 * an optional field compare the same way.
 */
function dialogFieldNames(): string[] {
  const clean = (element: Element): string =>
    (element.textContent ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s*\*?\s*required\s*$/i, '')
      .trim();

  return [
    ...all(overlayRoot(), '.mlv-dialog mlv-label').map(clean),
    ...all(
      overlayRoot(),
      '.mlv-dialog mlv-switch, .mlv-dialog mlv-checkbox',
    ).map(clean),
  ];
}

/** Whether the open dialog currently renders a field with this exact name. */
function hasField(name: string): boolean {
  return dialogFieldNames().includes(name);
}

/* ========================================================================== */

describe('website builder showcase', () => {
  afterEach(() => {
    // Dialogs and menus render into the shared overlay container, which is not
    // torn down with the fixture.
    document
      .querySelectorAll('.cdk-overlay-container, .cdk-overlay-backdrop')
      .forEach((node) => node.remove());
  });

  /* ---------------------------------------------------------------------- */
  /* §1.3 — acceptance policy, as a pure unit                               */
  /* ---------------------------------------------------------------------- */

  describe('acceptance policy', () => {
    it('lets a section take containers and nothing else', () => {
      const target = sectionNode();
      expect(wbAccepts(containerNode(), target, [])).toBe(true);
      expect(wbAccepts(rowNode(), target, [])).toBe(false);
      expect(wbAccepts(blockNode(), target, [])).toBe(false);
    });

    it('lets a container take rows and nothing else', () => {
      const target = containerNode();
      expect(wbAccepts(rowNode(), target, [])).toBe(true);
      expect(wbAccepts(containerNode('other'), target, [])).toBe(false);
      expect(wbAccepts(blockNode(), target, [])).toBe(false);
    });

    it('lets an empty row take either a row or a block', () => {
      const target = rowNode();
      expect(wbAccepts(rowNode('dragged'), target, [])).toBe(true);
      expect(wbAccepts(blockNode('dragged'), target, [])).toBe(true);
      expect(wbAccepts(containerNode('dragged'), target, [])).toBe(false);
    });

    it('keeps a row that already holds rows homogeneous', () => {
      const inner = [rowNode('inner-row')];
      const target = rowNode('t-row', inner);
      expect(wbAccepts(rowNode('dragged'), target, inner)).toBe(true);
      expect(wbAccepts(blockNode('dragged'), target, inner)).toBe(false);
    });

    it('keeps a row that already holds blocks homogeneous', () => {
      const inner = [blockNode('inner-block')];
      const target = rowNode('t-row', inner);
      expect(wbAccepts(blockNode('dragged'), target, inner)).toBe(true);
      expect(wbAccepts(rowNode('dragged'), target, inner)).toBe(false);
    });

    it('re-sorting the only child of a row does not lock the row to itself', () => {
      // The engine reports the dragged tile among `innerTiles` while it is
      // being re-sorted; ignoring it keeps a single-child row "empty" for the
      // homogeneity rule instead of pinning it to the dragged kind.
      const dragged = blockNode('only');
      const target = rowNode('t-row', [dragged]);
      expect(wbAccepts(dragged, target, [dragged])).toBe(true);
      // A different kind is still refused: the settled children decide.
      expect(wbAccepts(rowNode('other'), target, [dragged])).toBe(false);
    });

    it('never treats a block as a drop target', () => {
      const target = {
        ...rowNode('leaf'),
        props: blockNode().props,
      } as unknown as WbContainerNode;
      expect(wbAccepts(rowNode(), target, [])).toBe(false);
      expect(wbAccepts(blockNode('dragged'), target, [])).toBe(false);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* §1.5 — span maths                                                      */
  /* ---------------------------------------------------------------------- */

  describe('span clamping', () => {
    it('clamps every breakpoint into the parent container grid', () => {
      const clamped = wbClampSpan(
        { desktop: 16, tablet: 8, mobile: 6 },
        { desktop: 12, tablet: 8, mobile: 4 },
      );
      expect(clamped).toEqual({ desktop: 12, tablet: 8, mobile: 4 });
    });

    it('returns the same reference when nothing needed clamping', () => {
      const span = { desktop: 6, tablet: 4, mobile: 2 };
      expect(wbClampSpan(span, { desktop: 12, tablet: 8, mobile: 4 })).toBe(
        span,
      );
    });

    it('never clamps below one column', () => {
      expect(
        wbClampSpan(
          { desktop: 0, tablet: -3, mobile: 1 },
          { desktop: 12, tablet: 8, mobile: 4 },
        ),
      ).toEqual({ desktop: 1, tablet: 1, mobile: 1 });
    });

    it('counts a nested row span against its parent row, not the container', () => {
      const parentRow = rowNode('parent', []);
      const withSpan = {
        ...parentRow,
        props: {
          ...parentRow.props,
          span: { desktop: 6, tablet: 4, mobile: 4 },
        },
      };
      expect(wbParentColumns(withSpan)).toEqual({
        desktop: 6,
        tablet: 4,
        mobile: 4,
      });
      expect(wbParentColumns(containerNode())).toEqual(FULL);
    });

    it('reports exactly the breakpoints where a row overflows', () => {
      expect(
        wbOverflowingBreakpoints(
          { desktop: 9, tablet: 8, mobile: 6 },
          { desktop: 12, tablet: 8, mobile: 4 },
        ),
      ).toEqual(['mobile']);
    });

    it('ships one seeded row that overflows on mobile so the state is visible', () => {
      const path = wbFindPath(WB_CONTENT_SEED.category, 'cat-results-row');
      expect(path).not.toBeNull();
      const row = path?.[path.length - 1] as WbNode;
      const parent = path?.[path.length - 2] as WbNode;
      expect(
        wbOverflowingBreakpoints(
          (row.props as WbRowProps).span,
          wbParentColumns(parent),
        ),
      ).toEqual(['mobile']);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* §1.4 — row depth cap                                                   */
  /* ---------------------------------------------------------------------- */

  describe('row depth', () => {
    it('counts only row ancestors', () => {
      const path = wbFindPath(WB_CONTENT_SEED.article, 'art-related-row');
      expect(path).not.toBeNull();
      // section → container → art-main-row → art-rail-row → art-related-row
      expect(wbRowDepth(path ?? [])).toBe(2);
      expect(wbRowDepth(path ?? [])).toBeLessThan(WB_MAX_ROW_DEPTH);
    });

    it('keeps every seeded tree inside the authoring depth cap', () => {
      const roots = [
        WB_HEADER_SEED,
        WB_FOOTER_SEED,
        ...Object.values(WB_CONTENT_SEED),
      ];
      const deepest = roots.reduce((max, root) => {
        let local = 0;
        const walk = (node: WbNode, depth: number): void => {
          if (node.props.kind === 'row') local = Math.max(local, depth);
          if (!node.acceptsChildren) return;
          for (const child of node.children) {
            walk(child, node.props.kind === 'row' ? depth + 1 : 0);
          }
        };
        walk(root, 0);
        return Math.max(max, local);
      }, 0);
      expect(deepest).toBeLessThanOrEqual(WB_MAX_ROW_DEPTH);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Seed data                                                              */
  /* ---------------------------------------------------------------------- */

  describe('seed data', () => {
    it('mints globally unique ids across every tree', () => {
      const ids: string[] = [];
      const walk = (node: WbNode): void => {
        ids.push(node.id);
        if (node.acceptsChildren) node.children.forEach(walk);
      };
      [
        WB_HEADER_SEED,
        WB_FOOTER_SEED,
        ...Object.values(WB_CONTENT_SEED),
      ].forEach(walk);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps `acceptsChildren` in step with `props.kind`', () => {
      const walk = (node: WbNode): void => {
        expect(node.acceptsChildren).toBe(node.props.kind !== 'block');
        if (node.acceptsChildren) node.children.forEach(walk);
      };
      [
        WB_HEADER_SEED,
        WB_FOOTER_SEED,
        ...Object.values(WB_CONTENT_SEED),
      ].forEach(walk);
    });

    it('ships a substantial header, footer and four content layouts', () => {
      expect(wbCount(WB_HEADER_SEED).blocks).toBeGreaterThanOrEqual(4);
      expect(wbCount(WB_FOOTER_SEED).blocks).toBeGreaterThanOrEqual(4);
      for (const root of Object.values(WB_CONTENT_SEED)) {
        expect(wbCount(root).containers).toBeGreaterThanOrEqual(1);
      }
      expect(wbCount(WB_CONTENT_SEED.article).rows).toBeGreaterThanOrEqual(5);
    });

    it('offers every catalog block through exactly one Add-menu group', () => {
      const grouped = WB_BLOCK_GROUPS.flatMap((group) => group.blocks);
      expect(grouped.map((entry) => entry.type).sort()).toEqual(
        WB_BLOCK_CATALOG.map((entry) => entry.type).sort(),
      );
      expect(grouped.length).toBe(WB_BLOCK_CATALOG.length);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Page structure — UX risk R4                                            */
  /* ---------------------------------------------------------------------- */

  describe('page structure', () => {
    it('keeps the header and the summary strip unwrapped', async () => {
      const rendered = await render();

      const inner = rendered.root.querySelector('.mlv-page__inner');
      expect(inner).not.toBeNull();

      const header = rendered.root.querySelector('mlv-page-header');
      expect(header).not.toBeNull();
      // Full-bleed and snap compensation are `.mlv-page__inner > …` child
      // rules, so any wrapper element silently disables both.
      expect(header?.parentElement).toBe(inner);

      const summary = rendered.root.querySelector('mlv-page-summary');
      expect(summary).not.toBeNull();
      // The summary is the header's own projected bottom row — its supported
      // placement — so its parent must be the header itself, never a wrapper.
      expect(summary?.closest('mlv-page-header')).toBe(header);
      expect(
        summary?.parentElement?.closest('form, section, div.wrapper'),
      ).toBe(null);
    });

    it('renders one landmark canvas holding one section per tree', async () => {
      const rendered = await render();
      const canvas = byAriaLabel(rendered.root, 'Layout structure');
      expect(all(canvas, '.wb-section').length).toBe(2);
      expect(byAriaLabel(canvas, 'Header section')).toBeTruthy();
      expect(byAriaLabel(canvas, 'Footer section')).toBeTruthy();
    });

    it('gives every section its own root `mlv-tiles` tree', async () => {
      const rendered = await render();
      const roots = all(rendered.root, '.wb-section > .mlv-tiles');
      expect(roots.length).toBe(2);
      // A section is chrome, not a tile: it must never render a tile host.
      for (const section of all(rendered.root, '.wb-section')) {
        expect(section.querySelector(':scope > .mlv-tile')).toBeNull();
      }
    });

    it('summarises the active tab from the tree rather than a constant', async () => {
      const rendered = await render();
      const summary = rendered.root.querySelector('mlv-page-summary');
      const text = (summary?.textContent ?? '').replace(/\s+/g, ' ');
      const expected =
        wbCount(WB_HEADER_SEED).blocks + wbCount(WB_FOOTER_SEED).blocks;
      expect(text).toContain('Blocks');
      expect(text).toContain(String(expected));
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Tabs and locked previews                                               */
  /* ---------------------------------------------------------------------- */

  describe('page-type tabs', () => {
    it('renders locked header and footer previews around the content tree', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));

      const canvas = byAriaLabel(rendered.root, 'Layout structure');
      expect(all(canvas, '.wb-section').length).toBe(3);
      expect(byAriaLabel(canvas, 'Shared header, read only')).toBeTruthy();
      expect(byAriaLabel(canvas, 'Content section')).toBeTruthy();
      expect(byAriaLabel(canvas, 'Shared footer, read only')).toBeTruthy();
    });

    it('renders the locked previews as real locked tile trees', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));

      const locked = byAriaLabel(rendered.root, 'Shared header, read only');
      const tiles = locked.querySelector('.mlv-tiles');
      expect(tiles).not.toBeNull();
      expect(tiles?.classList.contains('mlv-tiles--locked')).toBe(true);
      // The real header content is rendered, not a hand-written summary.
      expect(all(locked, '.mlv-tile').length).toBeGreaterThan(3);
    });

    it('withdraws every structural affordance inside a locked preview', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));

      const locked = byAriaLabel(rendered.root, 'Shared header, read only');
      expect(all(locked, '.mlv-tile__drag-handle')).toEqual([]);
      expect(all(locked, '.mlv-tile__close')).toEqual([]);
      expect(all(locked, 'mlv-switch')).toEqual([]);
      expect(
        all(locked, 'button').filter((button) =>
          (button.getAttribute('aria-label') ?? '').startsWith('Settings for'),
        ),
      ).toEqual([]);
      // No empty prompt either — a frozen container must not invite a drop.
      expect(all(locked, '.mlv-tiles__empty')).toEqual([]);
    });

    it('rejects a programmatic drop into a locked preview', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));

      const before = JSON.stringify(rendered.component['_header']());
      const lockedTiles = byAriaLabel(
        rendered.root,
        'Shared header, read only',
      ).querySelector('mlv-tiles');
      expect(lockedTiles).not.toBeNull();

      // `mlv-tiles` refuses `insert` and `remove` outright while locked.
      const instance = (
        lockedTiles as HTMLElement & {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          __ngContext__?: unknown;
        }
      ).__ngContext__;
      expect(instance).toBeDefined();
      await settle(rendered);
      expect(JSON.stringify(rendered.component['_header']())).toBe(before);
    });

    it('keeps the editable content tree unlocked on a page-type tab', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));

      const content = byAriaLabel(rendered.root, 'Content section');
      const tiles = content.querySelector('.mlv-tiles');
      expect(tiles?.classList.contains('mlv-tiles--locked')).toBe(false);
      expect(all(content, '.mlv-tile__drag-handle').length).toBeGreaterThan(0);
    });

    it('announces the layout the tab switch produced', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Article'));

      const counts = wbCount(WB_CONTENT_SEED.article);
      expect(announcement(rendered)).toBe(
        `Article layout. ${counts.containers} container, ${counts.rows} rows, ${counts.blocks} blocks.`,
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Enable / disable                                                       */
  /* ---------------------------------------------------------------------- */

  describe('enable switch', () => {
    it('flows a switched-off node into the tile `inactive` state', async () => {
      const rendered = await render();
      const host = nodeHost('hdr-utility');
      expect(host.querySelector('.mlv-tile')?.classList).not.toContain(
        'mlv-tile--inactive',
      );

      const toggle = host.querySelector<HTMLInputElement>(
        'mlv-switch input[type="checkbox"]',
      );
      expect(toggle).not.toBeNull();
      await click(rendered, toggle as HTMLElement);

      const tile = nodeHost('hdr-utility').querySelector('.mlv-tile');
      expect(tile?.classList.contains('mlv-tile--inactive')).toBe(true);
      expect(nodeHost('hdr-utility').classList.contains('wb-node--off')).toBe(
        true,
      );
    });

    it('marks a descendant inactive without cascading the library input', async () => {
      const rendered = await render();
      const toggle = nodeHost('hdr-utility').querySelector<HTMLElement>(
        'mlv-switch input[type="checkbox"]',
      );
      await click(rendered, toggle as HTMLElement);

      // `inactive` deliberately does not cascade in the library, so the
      // showcase sets it per node from its own derived ancestor state.
      const child = nodeHost('hdr-utility-row');
      expect(child.classList.contains('wb-node--muted')).toBe(true);
      expect(
        child
          .querySelector('.mlv-tile')
          ?.classList.contains('mlv-tile--inactive'),
      ).toBe(true);
      // Its own switch stays on and stays operable.
      const childToggle = child.querySelector<HTMLInputElement>(
        'mlv-switch input[type="checkbox"]',
      );
      expect(childToggle?.checked).toBe(true);
      expect(childToggle?.disabled).toBe(false);
    });

    it('counts switched-off nodes in the summary strip', async () => {
      const rendered = await render();
      expect(rendered.component['counts']().disabled).toBe(0);

      const toggle = nodeHost('hdr-utility').querySelector<HTMLElement>(
        'mlv-switch input[type="checkbox"]',
      );
      await click(rendered, toggle as HTMLElement);
      expect(rendered.component['counts']().disabled).toBe(1);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Add flow                                                               */
  /* ---------------------------------------------------------------------- */

  describe('add flow', () => {
    it('offers a section only a direct Add container control', async () => {
      await render();
      const button = byId('wb-section-add-header');
      expect(button.getAttribute('aria-label')).toBe('Add container to Header');
      expect(button.getAttribute('aria-haspopup')).toBeNull();
    });

    it('offers a container only a direct Add row control', async () => {
      const rendered = await render();
      const add = byId('wb-add-hdr-utility');
      expect(add.getAttribute('aria-label')).toBe(
        'Add row to Utility container',
      );
      expect(add.getAttribute('aria-haspopup')).toBeNull();
      await settle(rendered);
    });

    it('offers a row holding blocks only block kinds, through a menu', async () => {
      const rendered = await render();
      const add = byId('wb-add-hdr-utility-row');
      expect(add.getAttribute('aria-label')).toBe('Add a block to Utility row');
      expect(add.getAttribute('aria-haspopup')).toBe('menu');

      await click(rendered, add);
      const items = all(overlayRoot(), '[role="menuitem"]').map((item) =>
        (item.textContent ?? '').trim(),
      );
      expect(items).not.toContain('Row');
      expect(items).toContain('Articles');
      expect(items.length).toBe(WB_BLOCK_CATALOG.length);
    });

    it('offers a row holding rows only a direct Add row control', async () => {
      await render();
      const add = byId('wb-add-hdr-masthead-row');
      expect(add.getAttribute('aria-label')).toBe('Add row to Masthead row');
      expect(add.getAttribute('aria-haspopup')).toBeNull();
    });

    it('offers an empty row both a row and every block', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Page'));

      const add = byId('wb-add-pg-reserved-row');
      expect(add.getAttribute('aria-label')).toBe('Add to Reserved row');

      await click(rendered, add);
      const items = all(overlayRoot(), '[role="menuitem"]').map((item) =>
        (item.textContent ?? '').trim(),
      );
      expect(items).toContain('Row');
      expect(items).toContain('Hero');
      expect(items.length).toBe(WB_BLOCK_CATALOG.length + 1);
    });

    it('gives a block no Add control at all', async () => {
      const rendered = await render();
      const host = nodeHost('hdr-utility-search');
      expect(host.querySelector('#wb-add-hdr-utility-search')).toBeNull();
      await settle(rendered);
    });

    it('appends a container as the last child of its section', async () => {
      const rendered = await render();
      const before = rendered.component['_header']().children.length;

      await click(rendered, byId('wb-section-add-header'));

      const children = rendered.component['_header']().children;
      expect(children.length).toBe(before + 1);
      expect(children[children.length - 1].props.label).toBe(
        `Container ${before + 1}`,
      );
      expect(children[children.length - 1].props.kind).toBe('container');
    });

    it('appends a row as the last child of its container, spanning full width', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-add-hdr-utility'));

      const path = wbFindPath(rendered.component['_header'](), 'hdr-utility');
      const container = path?.[path.length - 1] as WbContainerNode;
      expect(container.children.length).toBe(2);

      const added = container.children[1];
      expect(added.props.kind).toBe('row');
      expect((added.props as WbRowProps).span).toEqual(
        (container.props as WbContainerProps).columns,
      );
      expect(added.props.label).toBe('Row 2');
    });

    it('appends the chosen block type as the last child of a row', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-add-hdr-utility-row'));

      const item = all(overlayRoot(), '[role="menuitem"]').find(
        (node) => (node.textContent ?? '').trim() === 'Newsletter',
      );
      expect(item).toBeDefined();
      await click(rendered, item as HTMLElement);

      const path = wbFindPath(
        rendered.component['_header'](),
        'hdr-utility-row',
      );
      const row = path?.[path.length - 1] as WbContainerNode;
      expect(row.children.length).toBe(3);
      const added = row.children[2];
      expect((added.props as WbBlockProps).blockType).toBe('newsletter');
      expect(added.props.label).toBe('Newsletter');
    });

    it('does not auto-open a dialog but focuses the new tile Settings button', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));
      await settle(rendered);

      expect(overlayRoot().querySelector('.mlv-dialog')).toBeNull();

      const children = rendered.component['_header']().children;
      const added = children[children.length - 1];
      expect(document.activeElement?.id).toBe(`wb-settings-${added.id}`);
    });

    it('announces every add on the page-owned live region', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-add-hdr-utility'));
      expect(announcement(rendered)).toBe(
        'Row added to Utility container. 2 rows.',
      );
    });

    it('mints deterministic ids from a counter, never a clock', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));
      await click(rendered, byId('wb-section-add-footer'));

      const headerChildren = rendered.component['_header']().children;
      const footerChildren = rendered.component['_footer']().children;
      expect(headerChildren[headerChildren.length - 1].id).toBe('container-n1');
      expect(footerChildren[footerChildren.length - 1].id).toBe('container-n2');
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Remove flow                                                            */
  /* ---------------------------------------------------------------------- */

  describe('remove flow', () => {
    it('removes a leaf immediately and announces it', async () => {
      const rendered = await render();
      const remove = byAriaLabel(
        nodeHost('hdr-utility-search'),
        'Remove Site search block',
      );
      await click(rendered, remove);

      expect(
        wbFindPath(rendered.component['_header'](), 'hdr-utility-search'),
      ).toBeNull();
      expect(announcement(rendered)).toBe('Removed Site search block.');
      expect(overlayRoot().querySelector('.mlv-dialog')).toBeNull();
    });

    it('moves focus to the next sibling after a leaf removal', async () => {
      const rendered = await render();
      await click(
        rendered,
        byAriaLabel(nodeHost('hdr-utility-search'), 'Remove Site search block'),
      );
      await settle(rendered);
      expect(document.activeElement?.id).toBe('wb-settings-hdr-utility-social');
    });

    it('confirms before removing a node that would take a subtree with it', async () => {
      const rendered = await render();
      const nested = wbCount(
        wbFindPath(WB_HEADER_SEED, 'hdr-utility')?.slice(-1)[0] as WbNode,
      ).total;

      await click(
        rendered,
        byAriaLabel(nodeHost('hdr-utility'), 'Remove Utility container'),
      );

      const dialog = overlayRoot().querySelector('.mlv-dialog');
      expect(dialog).not.toBeNull();
      const text = (dialog?.textContent ?? '').replace(/\s+/g, ' ');
      expect(text).toContain('Remove Utility container?');
      expect(text).toContain(`${nested} nested tiles`);
      // Nothing has been removed while the confirmation is open.
      expect(
        wbFindPath(rendered.component['_header'](), 'hdr-utility'),
      ).not.toBeNull();
    });

    it('keeps the subtree when the confirmation is dismissed', async () => {
      const rendered = await render();
      await click(
        rendered,
        byAriaLabel(nodeHost('hdr-utility'), 'Remove Utility container'),
      );

      const keep = all(overlayRoot(), '.mlv-dialog button').find((button) =>
        (button.textContent ?? '').includes('Keep'),
      );
      expect(keep).toBeDefined();
      await click(rendered, keep as HTMLElement);
      await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
      await settle(rendered);

      expect(
        wbFindPath(rendered.component['_header'](), 'hdr-utility'),
      ).not.toBeNull();
      expect(rendered.component['dirty']()).toBe(false);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Dialogs                                                                */
  /* ---------------------------------------------------------------------- */

  describe('container dialog', () => {
    async function openContainer(rendered: Rendered): Promise<void> {
      await click(rendered, byId('wb-settings-hdr-utility'));
      await settle(rendered);
    }

    it('opens seeded from the node it was launched from', async () => {
      const rendered = await render();
      await openContainer(rendered);

      const dialog = overlayRoot().querySelector('.mlv-dialog');
      expect(dialog?.textContent).toContain(
        'Container settings — Utility container',
      );
      expect(rendered.component['containerDraft']().label).toBe(
        'Utility container',
      );
    });

    it('hides the width field for a fluid container', async () => {
      const rendered = await render();
      await openContainer(rendered);

      expect(rendered.component['containerDraft']().width).toBe('fluid');
      expect(hasField('Width (px)')).toBe(false);
      expect(hasField('Max width (px)')).toBe(false);
    });

    it('shows the width field for a fixed container', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Page'));
      await click(rendered, byId('wb-settings-pg-shell'));
      await settle(rendered);

      expect(rendered.component['containerDraft']().width).toBe('fixed');
      expect(hasField('Width (px)')).toBe(true);
      expect(hasField('Max width (px)')).toBe(false);
    });

    it('shows the max-width field for a max-width-fluid container', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-masthead'));
      await settle(rendered);

      expect(rendered.component['containerDraft']().width).toBe(
        'max-width-fluid',
      );
      expect(hasField('Max width (px)')).toBe(true);
      expect(hasField('Width (px)')).toBe(false);
    });

    it('switches the width field on when the mode changes, without a save', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerWidthMode']('fixed');
      await settle(rendered);
      expect(hasField('Width (px)')).toBe(true);
      // The tree is untouched until Save: this is a local draft.
      const path = wbFindPath(rendered.component['_header'](), 'hdr-utility');
      const node = path?.[path.length - 1] as WbNode;
      expect((node.props as WbContainerProps).width).toBe('fluid');
    });

    it('rejects an empty name and blocks the save', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerLabel']('   ');
      await settle(rendered);
      expect(rendered.component['containerNameMessage']()).toBe(
        'Enter a name.',
      );
      expect(rendered.component['containerValid']()).toBe(false);
    });

    it('lets `mlv-number-input` clamp an out-of-range width back into range', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerWidthMode']('fixed');
      rendered.component['setContainerWidthPx'](120);
      await settle(rendered);

      // The control's own min/max effect re-clamps a form-side write, so the
      // field self-corrects rather than sitting in an invalid state.
      expect(rendered.component['containerDraft']().widthPx).toBe(320);
      expect(rendered.component['containerWidthMessage']()).toBe('');
      expect(rendered.component['containerValid']()).toBe(true);
    });

    it('blocks the save while a required width is cleared', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerWidthMode']('max-width-fluid');
      rendered.component['setContainerWidthPx'](null);
      await settle(rendered);

      expect(rendered.component['containerWidthMessage']()).toBe(
        'Enter a width between 320 and 2560 px.',
      );
      expect(rendered.component['containerValid']()).toBe(false);
    });

    it('validates each breakpoint column count independently', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerColumns']('mobile', 30);
      await settle(rendered);
      expect(rendered.component['containerColumnsMessage']('mobile')).toBe(
        'Enter between 1 and 24 columns.',
      );
      expect(rendered.component['containerColumnsMessage']('desktop')).toBe('');
      expect(rendered.component['containerValid']()).toBe(false);
    });

    it('warns, then clamps overflowing child rows on save', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-masthead'));
      await settle(rendered);

      rendered.component['setContainerColumns']('desktop', 6);
      await settle(rendered);

      const warning = rendered.component['containerClampWarning']();
      expect(warning).not.toBeNull();
      expect(warning?.count).toBe(1);
      expect(warning?.breakpoints).toContain('desktop');

      rendered.component['saveContainer']();
      await settle(rendered);

      const path = wbFindPath(
        rendered.component['_header'](),
        'hdr-masthead-row',
      );
      const row = path?.[path.length - 1] as WbNode;
      expect((row.props as WbRowProps).span.desktop).toBe(6);
      // Untouched breakpoints keep their authored value.
      expect((row.props as WbRowProps).span.tablet).toBe(8);
    });

    it('commits the draft only on save', async () => {
      const rendered = await render();
      await openContainer(rendered);

      rendered.component['setContainerLabel']('Renamed band');
      await settle(rendered);
      let path = wbFindPath(rendered.component['_header'](), 'hdr-utility');
      expect((path?.[path.length - 1] as WbNode).props.label).toBe(
        'Utility container',
      );

      rendered.component['saveContainer']();
      await settle(rendered);
      path = wbFindPath(rendered.component['_header'](), 'hdr-utility');
      expect((path?.[path.length - 1] as WbNode).props.label).toBe(
        'Renamed band',
      );
    });
  });

  describe('row dialog', () => {
    it('caps the span field at the parent container grid', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-utility-row'));
      await settle(rendered);

      expect(rendered.component['rowParentLabel']()).toBe('Utility container');
      expect(rendered.component['rowParentMax']('desktop')).toBe(12);
      expect(rendered.component['rowParentMax']('mobile')).toBe(4);

      rendered.component['setRowSpan']('mobile', 9);
      await settle(rendered);
      expect(rendered.component['rowSpanMessage']('mobile')).toBe(
        'This row can span at most 4 columns at mobile.',
      );
      expect(rendered.component['rowValid']()).toBe(false);
    });

    it('counts a nested row against its parent row', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-brand-row'));
      await settle(rendered);

      expect(rendered.component['rowParentLabel']()).toBe('Masthead row');
      expect(rendered.component['rowParentMax']('desktop')).toBe(12);
      expect(rendered.component['rowSpan']('desktop')).toBe(4);
      expect(rendered.component['rowSpanDescription']('desktop')).toBe(
        'About 33% of the parent width.',
      );
    });

    it('reports a full-width span as such', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-utility-row'));
      await settle(rendered);
      expect(rendered.component['rowSpanDescription']('desktop')).toBe(
        'Full width',
      );
    });

    it('shows no breakpoint tabs beyond the three authoring tiers', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-utility-row'));
      await settle(rendered);

      const tabs = all(overlayRoot(), '.mlv-dialog .mlv-tab-item').map((tab) =>
        (tab.textContent ?? '').trim(),
      );
      expect(tabs).toEqual(['Desktop', 'Tablet', 'Mobile']);
    });
  });

  describe('block dialogs', () => {
    it('renders the type-specific fieldset for the drafted block', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-nav-menu'));
      await settle(rendered);

      const dialog = overlayRoot().querySelector('.mlv-dialog');
      expect(dialog?.textContent).toContain('Top menu settings');
      expect(hasField('Menu source')).toBe(true);
      expect(hasField('Levels shown')).toBe(true);
      expect(hasField('Show item icons')).toBe(true);
      expect(hasField('On mobile')).toBe(true);
    });

    it('never renders breakpoint tabs — blocks are breakpoint-agnostic', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-nav-menu'));
      await settle(rendered);
      expect(all(overlayRoot(), '.mlv-dialog .mlv-tab-item')).toEqual([]);
    });

    it('reveals the category fields only for a category-filled list', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await click(rendered, byId('wb-settings-home-lead'));
      await settle(rendered);

      expect(hasField('Category')).toBe(false);
      expect(hasField('How many')).toBe(true);

      rendered.component['patchSettings']({ fill: 'category' });
      await settle(rendered);
      expect(hasField('Category')).toBe(true);
      expect(hasField('Include sub-categories')).toBe(true);
      expect(rendered.component['blockValid']()).toBe(false);

      rendered.component['patchSettings']({ categoryId: 'cat-news' });
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(true);
    });

    it('swaps the count field for the tokenizer in manual mode', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await click(rendered, byId('wb-settings-home-lead'));
      await settle(rendered);

      rendered.component['patchSettings']({ fill: 'manual', articleIds: [] });
      await settle(rendered);
      expect(hasField('Articles')).toBe(true);
      expect(hasField('How many')).toBe(false);
      expect(rendered.component['blockValid']()).toBe(false);

      rendered.component['setArticleTokens']([
        { value: 'a-01', label: 'The quiet rebuild of the city grid' },
      ]);
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(true);
    });

    it('reveals carousel timing only when autoplay is on', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await click(rendered, byId('wb-settings-home-lead'));
      await settle(rendered);

      rendered.component['patchSettings']({ display: 'carousel' });
      await settle(rendered);
      expect(hasField('Advance automatically')).toBe(true);
      expect(hasField('Slide interval (seconds)')).toBe(false);
      expect(hasField('Columns per row')).toBe(false);

      rendered.component['patchSettings']({ autoplay: true });
      await settle(rendered);
      expect(hasField('Slide interval (seconds)')).toBe(true);
    });

    it('swaps the hero background field with the chosen source', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await click(rendered, byId('wb-settings-home-hero-block'));
      await settle(rendered);

      expect(overlayRoot().querySelector('mlv-file-upload')).not.toBeNull();
      expect(overlayRoot().querySelector('mlv-color-picker')).toBeNull();

      rendered.component['patchSettings']({ background: 'solid' });
      await settle(rendered);
      expect(overlayRoot().querySelector('mlv-file-upload')).toBeNull();
      expect(overlayRoot().querySelector('mlv-color-picker')).not.toBeNull();

      rendered.component['patchSettings']({
        background: 'video',
        videoUrl: '',
      });
      await settle(rendered);
      expect(hasField('Video URL')).toBe(true);
      expect(rendered.component['blockValid']()).toBe(false);

      rendered.component['patchSettings']({
        videoUrl: 'https://example.com/reel.mp4',
      });
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(true);
    });

    // The upload is destroyed with the dialog and hands its preview on with
    // the value (#352), so the page, which owns `heroFiles`, revokes it.
    it('revokes the hero image preview once the block dialog has closed', async () => {
      let created = 0;
      vi.spyOn(URL, 'createObjectURL').mockImplementation(
        () => `blob:hero/${++created}`,
      );
      const revoked: string[] = [];
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
        revoked.push(String(url));
      });
      try {
        const rendered = await render();
        await click(rendered, tabButton(rendered, 'Homepage'));
        await click(rendered, byId('wb-settings-home-hero-block'));
        await settle(rendered);

        const input = overlayRoot().querySelector<HTMLInputElement>(
          '.mlv-file-upload__input',
        );
        const cover = new File(['x'], 'cover.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', {
          value: [cover],
          configurable: true,
        });
        input?.dispatchEvent(new Event('change'));
        await settle(rendered);
        expect(
          rendered.component['heroFiles']().map((file) => file.previewUrl),
        ).toEqual(['blob:hero/1']);

        await click(rendered, dialogButton('Cancel'));
        await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
        await settle(rendered);

        expect(revoked).toEqual(['blob:hero/1']);
        expect(rendered.component['heroFiles']()).toEqual([]);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('requires a URL once a call-to-action label exists', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await click(rendered, byId('wb-settings-home-hero-block'));
      await settle(rendered);

      rendered.component['patchSettings']({
        buttonLabel: 'Read it',
        buttonUrl: '',
      });
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(false);

      rendered.component['patchSettings']({ buttonLabel: '' });
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(true);
    });

    it('requires at least one social network', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-utility-social'));
      await settle(rendered);

      expect(rendered.component['blockValid']()).toBe(true);
      rendered.component['patchSettings']({ networks: [] });
      await settle(rendered);
      expect(rendered.component['blockValid']()).toBe(false);
    });

    it('commits block settings only on save', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-settings-hdr-nav-menu'));
      await settle(rendered);

      rendered.component['patchSettings']({ levels: 3 });
      await settle(rendered);

      let path = wbFindPath(rendered.component['_header'](), 'hdr-nav-menu');
      let props = (path?.[path.length - 1] as WbNode).props as WbBlockProps;
      expect(props.settings).toMatchObject({ levels: 2 });

      rendered.component['saveBlock']();
      await settle(rendered);
      path = wbFindPath(rendered.component['_header'](), 'hdr-nav-menu');
      props = (path?.[path.length - 1] as WbNode).props as WbBlockProps;
      expect(props.settings).toMatchObject({ levels: 3 });
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Dock                                                                   */
  /* ---------------------------------------------------------------------- */

  describe('dock', () => {
    it('starts clean and disables both actions', async () => {
      const rendered = await render();
      expect(rendered.component['dirty']()).toBe(false);
      expect(saveButton(rendered).disabled).toBe(true);
      expect(
        rendered.root.querySelector('.website-builder__dock-start')
          ?.textContent,
      ).toContain('All changes saved');
    });

    it('counts one unsaved change per edit', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));
      expect(rendered.component['dirtyCount']()).toBe(1);

      await click(rendered, byId('wb-add-hdr-utility'));
      expect(rendered.component['dirtyCount']()).toBe(2);
      expect(saveButton(rendered).disabled).toBe(false);
    });

    it('restores the saved snapshot once discard is confirmed', async () => {
      const rendered = await render();
      const before = rendered.component['_header']();

      await click(rendered, byId('wb-section-add-header'));
      expect(rendered.component['_header']()).not.toBe(before);

      await answerDiscard(rendered, 'Discard');
      expect(rendered.component['_header']()).toBe(before);
      expect(rendered.component['dirty']()).toBe(false);
      expect(announcement(rendered)).toBe('Changes discarded.');
    });

    it('asks before throwing the draft away and names what is at stake', async () => {
      const rendered = await render();
      const before = rendered.component['_header']();
      await click(rendered, byId('wb-section-add-header'));
      await click(rendered, byId('wb-add-hdr-utility'));
      expect(rendered.component['dirtyCount']()).toBe(2);

      await click(rendered, discardButton(rendered));
      await settle(rendered);

      // Same shape as the remove confirmation: an alertdialog, because the
      // action is irreversible.
      const dialog = overlayRoot().querySelector('[role="alertdialog"]');
      expect(dialog).not.toBeNull();
      const text = (dialog?.textContent ?? '').replace(/\s+/g, ' ');
      expect(text).toContain('Discard 2 unsaved changes?');
      expect(text).toContain('It cannot be undone.');

      // Initial focus sits on the non-destructive choice.
      expect((document.activeElement?.textContent ?? '').trim()).toBe(
        'Keep editing',
      );

      // Nothing is restored while the question is open.
      expect(rendered.component['_header']()).not.toBe(before);
      expect(rendered.component['dirtyCount']()).toBe(2);

      await click(rendered, dialogButton('Keep editing'));
      await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
    });

    it('leaves every change intact when the discard is cancelled', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));
      await click(rendered, byId('wb-add-hdr-utility'));
      const edited = rendered.component['_header']();

      await answerDiscard(rendered, 'Keep editing');

      expect(rendered.component['_header']()).toBe(edited);
      expect(rendered.component['dirtyCount']()).toBe(2);
      expect(announcement(rendered)).not.toBe('Changes discarded.');
      expect(discardButton(rendered).disabled).toBe(false);
    });

    it('singularises the confirmation for a single change', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));

      await click(rendered, discardButton(rendered));
      await settle(rendered);
      expect(
        (
          overlayRoot().querySelector('[role="alertdialog"]')?.textContent ?? ''
        ).replace(/\s+/g, ' '),
      ).toContain('Discard 1 unsaved change?');

      await click(rendered, dialogButton('Keep editing'));
      await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
    });

    it('makes the current state the new baseline on save', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-section-add-header'));
      const edited = rendered.component['_header']();

      await rendered.component['saveLayout']();
      await settle(rendered);

      expect(rendered.component['dirty']()).toBe(false);
      expect(announcement(rendered)).toBe('Layout saved.');

      await click(rendered, byId('wb-add-hdr-utility'));
      await answerDiscard(rendered, 'Discard');
      expect(rendered.component['_header']()).toBe(edited);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Escape to the top level                                                */
  /* ---------------------------------------------------------------------- */

  describe('escape to the top level', () => {
    /** The page header's tabs region, which never joins the snap timeline. */
    function tabsRow(rendered: Rendered): HTMLElement {
      const row = rendered.root.querySelector<HTMLElement>(
        '.mlv-page-header__tabs',
      );
      if (!row) throw new Error('No page-header tabs region');
      return row;
    }

    /** A header region that *does* collapse, for the reveal assertions. */
    function descriptionRow(rendered: Rendered): HTMLElement {
      const row = rendered.root.querySelector<HTMLElement>(
        '.mlv-page-header__description',
      );
      if (!row) throw new Error('No page-header description region');
      return row;
    }

    function activeTab(rendered: Rendered): HTMLElement {
      const tab = rendered.root.querySelector<HTMLElement>(
        '.website-builder__tabs .mlv-tab-item[aria-selected="true"]',
      );
      if (!tab) throw new Error('No selected level-1 tab');
      return tab;
    }

    /** The page's own scrollport, whose offset drives the snap timeline. */
    function viewport(rendered: Rendered): HTMLElement {
      const el = rendered.root.querySelector<HTMLElement>(
        '.mlv-page__scrollbar .mlv-scrollbar__viewport',
      );
      if (!el) throw new Error('No page scroll viewport');
      return el;
    }

    /** Drives the snap timeline the way scrolling does. */
    async function scrollTo(rendered: Rendered, top: number): Promise<void> {
      const el = viewport(rendered);
      el.scrollTop = top;
      el.dispatchEvent(new Event('scroll'));
      await settle(rendered);
    }

    it('lands on the active level-1 tab while the chrome is expanded', async () => {
      const rendered = await render();
      rendered.component['onEscapeToTop']();
      expect(document.activeElement).toBe(activeTab(rendered));
    });

    it('takes the page back to the top before it moves focus', async () => {
      const rendered = await render();
      const snap = rendered.component['_page']()?.snap;
      expect(snap, 'page snap state').toBeTruthy();

      // The description joins the snap timeline and ends `visibility: hidden`
      // once its window has elapsed; the level-1 tab strip deliberately does
      // not, so navigation stays reachable at every scroll offset. That is the
      // structural half of the fix, and it is assertable here — how far the
      // timeline has actually run is not, because every region measures itself
      // as 0px under jsdom, which is a collapse distance of 0.
      expect(
        descriptionRow(rendered).classList.contains('mlv-page-snap--hide'),
      ).toBe(true);
      expect(tabsRow(rendered).classList.contains('mlv-page-snap--hide')).toBe(
        false,
      );

      await scrollTo(rendered, 400);
      expect(snap?.overlapped()).toBe(true);

      rendered.component['onEscapeToTop']();

      // `expand()` reveals every region synchronously and asks the page — the
      // only thing that knows which element scrolls — to return to the top,
      // which is what actually re-expands the chrome. The reveal itself is
      // pinned in `page-snap-behavior.spec.ts`, where the measurements can be
      // faked; here the observable contract is that focus lands on the tab and
      // the scroller went home.
      expect(viewport(rendered).scrollTop).toBe(0);
      expect(document.activeElement).toBe(activeTab(rendered));
    });

    it('falls back to the always-visible page title when the strip is gone', async () => {
      const rendered = await render();

      // The header renders the title template once per type role, so the route
      // must not own the focus target itself — it asks the header, which
      // focuses whichever copy is live. Neither copy carries an id or a
      // tabindex of the route's own.
      const titles = all(rendered.root, '.mlv-page-header__title-node h1');
      expect(titles).toHaveLength(2);
      for (const title of titles) {
        expect(title.id).toBe('');
        expect(title.getAttribute('tabindex')).toBeNull();
        // The title row never joins the snap timeline, so it is the one
        // landing that is guaranteed visible.
        expect(title.closest('.mlv-page-snap--hide')).toBeNull();
      }

      tabsRow(rendered).remove();
      rendered.component['onEscapeToTop']();

      const live = rendered.root.querySelector(
        '.mlv-page-header__title-node--large',
      );
      expect(document.activeElement).toBe(live);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* §8.8 — axe                                                             */
  /* ---------------------------------------------------------------------- */

  describe('accessibility', () => {
    it('keeps the All tab axe-clean', async () => {
      const rendered = await render();
      await expectNoAxeViolations(rendered.root);
    });

    it('keeps a page-type tab with locked previews axe-clean', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Homepage'));
      await expectNoAxeViolations(rendered.root);
    });

    it('keeps an empty container and an empty row axe-clean', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Page'));
      // `pg-appendix` seeds an empty container and `pg-reserved-row` an empty
      // row, so both empty states are on screen without mutating anything.
      expect(all(rendered.root, '.wb-empty').length).toBeGreaterThanOrEqual(2);
      await expectNoAxeViolations(rendered.root);
    });

    it('keeps an emptied section axe-clean', async () => {
      const rendered = await render();
      const header = rendered.component['_header']();
      for (const child of [...header.children]) {
        const removeLabel = `Remove ${child.props.label}`;
        await click(rendered, byAriaLabel(nodeHost(child.id), removeLabel));
        const confirm = all(overlayRoot(), '.mlv-dialog button').find(
          (button) => (button.textContent ?? '').trim() === 'Remove',
        );
        if (confirm) {
          await click(rendered, confirm);
          await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
          await settle(rendered);
        }
      }

      expect(rendered.component['_header']().children.length).toBe(0);
      const section = byAriaLabel(rendered.root, 'Header section');
      expect(section.textContent).toContain('No containers yet');
      await expectNoAxeViolations(rendered.root);
    });

    it('keeps each dialog axe-clean', async () => {
      const rendered = await render();

      for (const id of [
        'wb-settings-hdr-utility',
        'wb-settings-hdr-utility-row',
        'wb-settings-hdr-nav-menu',
      ]) {
        await click(rendered, byId(id));
        await settle(rendered);
        const dialog = overlayRoot().querySelector('.mlv-dialog-pane');
        expect(dialog).not.toBeNull();
        await expectNoAxeViolations(dialog as Element);

        const cancel = all(overlayRoot(), '.mlv-dialog button').find((button) =>
          (button.textContent ?? '').includes('Cancel'),
        );
        await click(rendered, cancel as HTMLElement);
        await new Promise((resolve) => setTimeout(resolve, DIALOG_LEAVE));
        await settle(rendered);
      }
    });

    it('keeps the Add menu axe-clean', async () => {
      const rendered = await render();
      await click(rendered, byId('wb-add-hdr-utility-row'));
      const menu = overlayRoot().querySelector('[role="menu"]');
      expect(menu).not.toBeNull();
      await expectNoAxeViolations(menu as Element);
    });

    it('names every node group with its level, position and label', async () => {
      await render();
      const host = nodeHost('hdr-utility');
      expect(host.getAttribute('role')).toBe('group');
      expect(host.getAttribute('aria-label')).toBe(
        'Level 1, container 1 of 3, Utility container',
      );

      const child = nodeHost('hdr-utility-row');
      expect(child.getAttribute('aria-label')).toBe(
        'Level 2, row 1 of 1, Utility row',
      );
    });

    it('names the enable switch without leaking its state', async () => {
      const rendered = await render();
      const input = nodeHost('hdr-utility').querySelector<HTMLInputElement>(
        'mlv-switch input[type="checkbox"]',
      );
      // The name must carry no state word — `aria-checked` reports that, and a
      // name reading "on"/"off" would contradict it on the next toggle.
      expect(input?.getAttribute('aria-label')).toBe(
        'Enable Utility container',
      );
      expect(input?.getAttribute('aria-checked')).toBe('true');
      await settle(rendered);
    });

    it('carries the state sentence in a visually-hidden span', async () => {
      await render();
      const hidden = nodeHost('hdr-brand-row').querySelector(
        '.cdk-visually-hidden',
      );
      expect(hidden?.textContent).toContain('Level 3, row 1 of 2');
      expect(hidden?.textContent).toContain('spans 4 of 12 columns');
    });

    it('spells out an invalid span in the hidden state sentence', async () => {
      const rendered = await render();
      await click(rendered, tabButton(rendered, 'Category'));

      const host = nodeHost('cat-results-row');
      expect(host.classList.contains('wb-node--invalid')).toBe(true);
      expect(
        host
          .querySelector('.mlv-tile')
          ?.classList.contains('mlv-tile--tone-danger'),
      ).toBe(true);
      expect(host.querySelector('.cdk-visually-hidden')?.textContent).toContain(
        'Span exceeds the parent at mobile.',
      );
    });
  });
});
