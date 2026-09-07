import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { parse } from 'postcss';
import { compile } from 'sass';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTile } from './tile';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTileHeader } from '../tile-header';
import { MlvTileActions } from '../tile-actions';
import { MlvTileTrailingActions } from '../tile-trailing-actions';
import type {
  MlvTileNodeWithChildren,
  MlvTilesAccepts,
} from '../tile-tree.types';
import { MlvTiles } from '../tiles/tiles';

interface DragTestProps {
  readonly title: string;
}

const dragTestRoot: MlvTileNodeWithChildren<DragTestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page' },
  children: [
    {
      id: 'hero',
      acceptsChildren: false,
      props: { title: 'Hero' },
    },
  ],
};

@Component({
  imports: [MlvTile, MlvTileHeader],
  template: `
    <mlv-tile>
      <ng-template mlvTileHeader>Deployment status</ng-template>
      Ready
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileHeaderTestHost {}

@Component({
  imports: [MlvTile, MlvTileHeader, MlvTileActions],
  template: `
    <mlv-tile mlvDensity="airy" draggable closable>
      <ng-template mlvTileHeader>Hero section</ng-template>
      <ng-template mlvTileActions>
        <button type="button" (click)="actionClicks.update((n) => n + 1)">
          Edit
        </button>
      </ng-template>
      Published content
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileActionsTestHost {
  readonly actionClicks = signal(0);
}

@Component({
  imports: [MlvTile, MlvTileHeader],
  template: `
    <mlv-tile closable>
      <ng-template mlvTileHeader>Release notes</ng-template>
      Published content
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileClosableTestHost {}

@Component({
  imports: [MlvTile, MlvTileHeader],
  template: `
    <mlv-tile mlvDensity="tight">
      <ng-template mlvTileHeader>Tight</ng-template>
    </mlv-tile>
    <mlv-tile mlvDensity="compact">
      <ng-template mlvTileHeader>Compact</ng-template>
    </mlv-tile>
    <mlv-tile mlvDensity="comfortable">
      <ng-template mlvTileHeader>Comfortable</ng-template>
    </mlv-tile>
    <mlv-tile mlvDensity="spacious">
      <ng-template mlvTileHeader>Spacious</ng-template>
    </mlv-tile>
    <mlv-tile mlvDensity="airy">
      <ng-template mlvTileHeader>Airy</ng-template>
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileDensityTestHost {}

@Component({
  imports: [MlvTile, MlvTileHeader, MlvTileActions, MlvTileTrailingActions],
  template: `
    <mlv-tile draggable>
      <ng-template mlvTileHeader>Title</ng-template>
      <ng-template mlvTileActions><button>Edit</button></ng-template>
      <ng-template mlvTileTrailingActions><button>Remove</button></ng-template>
      Body
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileTrailingActionsTestHost {}

@Component({
  imports: [MlvTiles, MlvTile],
  template: `
    <mlv-tiles [(tree)]="tree">
      <mlv-tile [tile]="tree().children[0]" [dragDisabled]="disabled()">
        Hero
      </mlv-tile>
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileDragTestHost {
  readonly tree = signal(dragTestRoot);
  readonly disabled = signal(false);
}

@Component({
  imports: [MlvTile, MlvTileActions],
  template: `
    <mlv-tile data-tile-id="header" draggable>
      Header
      <mlv-tile data-tile-id="launch" draggable>
        <ng-template mlvTileActions>
          <button type="button">Edit Launch</button>
        </ng-template>
        Launch
      </mlv-tile>
      <mlv-tile data-tile-id="introduction" draggable> Introduction </mlv-tile>
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NestedHandleTestHost {}

const lockedTestRoot: MlvTileNodeWithChildren<DragTestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page' },
  children: [
    {
      id: 'header',
      acceptsChildren: true,
      props: { title: 'Header' },
      children: [
        {
          id: 'logo',
          acceptsChildren: false,
          props: { title: 'Logo' },
        },
      ],
    },
    {
      id: 'body',
      acceptsChildren: false,
      props: { title: 'Body' },
    },
  ],
};

@Component({
  imports: [MlvTiles, MlvTile],
  template: `
    <mlv-tiles [(tree)]="tree" [accepts]="acceptAll">
      <mlv-tile [tile]="tree().children[0]" [locked]="headerLocked()" closable>
        Header
        <mlv-tiles>
          <mlv-tile [tile]="headerChild()" [locked]="childLocked()" closable>
            Logo
          </mlv-tile>
        </mlv-tiles>
      </mlv-tile>
      <mlv-tile
        [tile]="tree().children[1]"
        [inactive]="bodyInactive()"
        closable
      >
        Body
      </mlv-tile>
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileLockedTestHost {
  readonly tree = signal(lockedTestRoot);
  readonly headerLocked = signal(true);
  readonly childLocked = signal(false);
  readonly bodyInactive = signal(false);
  readonly headerChild = computed(
    () =>
      (this.tree().children[0] as MlvTileNodeWithChildren<DragTestProps>)
        .children[0],
  );
  readonly acceptAll: MlvTilesAccepts<DragTestProps> = () => true;
}

function tiles(
  fixture: ComponentFixture<unknown>,
): readonly MlvTile<DragTestProps>[] {
  return fixture.debugElement
    .queryAll(By.directive(MlvTile))
    .map((debug) => debug.componentInstance as MlvTile<DragTestProps>);
}

function tileByLabel(
  fixture: ComponentFixture<unknown>,
  id: string,
): MlvTile<DragTestProps> {
  const match = tiles(fixture).find((tile) => tile.tile()?.id === id);
  if (!match) throw new Error(`Expected tile ${id}`);
  return match;
}

function tileElement(
  fixture: ComponentFixture<unknown>,
  id: string,
): HTMLElement {
  const match = fixture.nativeElement.querySelector(
    `mlv-tile[data-mlv-tile-id="${id}"]`,
  ) as HTMLElement | null;
  if (!match) throw new Error(`Expected tile element ${id}`);
  return match;
}

function compiledTileCss(): string {
  // The stylesheet ships inside `@layer mlv.components`. Flattening it keeps
  // the rules where these assertions walk for them — at the root of the
  // parsed stylesheet — and matches what the jsdom specs read.
  return stripCssLayersFromText(
    compile(
      fileURLToPath(new URL(['.', 'tile.scss'].join('/'), import.meta.url)),
    ).css,
  );
}

function selectorsWithDeclaration(
  css: string,
  property: string,
  value: string,
): readonly string[] {
  const selectors: string[] = [];
  parse(css).walkRules((rule) => {
    const hasDeclaration = rule.nodes.some(
      (node) =>
        node.type === 'decl' && node.prop === property && node.value === value,
    );
    if (hasDeclaration) selectors.push(...rule.selectors);
  });
  return selectors;
}

function matchedElements(
  rootElement: HTMLElement,
  selectors: readonly string[],
  pseudoState: ':hover' | ':focus-within' | ':focus-visible',
  stateClass: string,
): readonly HTMLElement[] {
  const matches = new Set<HTMLElement>();
  for (const selector of selectors) {
    if (!selector.includes(pseudoState)) continue;
    const testSelector = selector.replaceAll(pseudoState, `.${stateClass}`);
    rootElement
      .querySelectorAll<HTMLElement>(testSelector)
      .forEach((element) => matches.add(element));
  }
  return [...matches];
}

describe('MlvTile', () => {
  let component: MlvTile;
  let fixture: ComponentFixture<MlvTile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTile, TileHeaderTestHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies all explicit density classes without a size class', async () => {
    const host = TestBed.createComponent(TileDensityTestHost);
    await host.whenStable();

    const tiles = Array.from(host.nativeElement.querySelectorAll('mlv-tile'));

    expect(tiles.map((tile) => tile.classList.value)).toEqual([
      expect.stringContaining('mlv-tile--tight'),
      expect.stringContaining('mlv-tile--compact'),
      expect.stringContaining('mlv-tile--comfortable'),
      expect.stringContaining('mlv-tile--spacious'),
      expect.stringContaining('mlv-tile--airy'),
    ]);
    for (const tile of tiles) {
      expect(tile.className).not.toContain('mlv-tile--size-');
    }
  });

  it('keeps a standalone drag grip visual and out of the accessibility tree', () => {
    fixture.componentRef.setInput('draggable', true);
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLElement;
    expect(handle).toBeTruthy();
    expect(handle.tagName).toBe('SPAN');
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    expect(handle.hasAttribute('aria-label')).toBe(false);
    expect(handle.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(handle.tabIndex).toBe(-1);
  });

  it('keeps disabled standalone drag affordance readable but unregistered', () => {
    fixture.componentRef.setInput('draggable', true);
    fixture.componentRef.setInput('dragDisabled', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain(
      'mlv-tile--drag-disabled',
    );
    expect(
      fixture.nativeElement.querySelector('.mlv-tile__drag-handle'),
    ).toBeTruthy();
    const handle = fixture.nativeElement.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLElement;
    expect(handle.tagName).toBe('SPAN');
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    expect(handle.hasAttribute('disabled')).toBe(false);
    expect(handle.hasAttribute('aria-disabled')).toBe(false);
    expect(
      fixture.nativeElement.hasAttribute('data-mlv-tile-drag-disabled'),
    ).toBe(false);
  });

  it('does not register a standalone tile as a Sortable item', () => {
    fixture.componentRef.setInput('draggable', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).not.toContain(
      'mlv-tiles__item-root',
    );
    expect(fixture.nativeElement.hasAttribute('data-mlv-tile-id')).toBe(false);
  });

  it('does not warn for standalone rendering but warns on requested tree operations', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    fixture.detectChanges();
    expect(warn).not.toHaveBeenCalled();

    component.remove();
    component.setProps({ title: 'Ignored' });
    component.updateProps((props) => props);

    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('reacts to dragDisabled for a registered tree item', async () => {
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();
    const root = host.nativeElement.querySelector('mlv-tile') as HTMLElement;

    expect(root.dataset['mlvTileId']).toBe('hero');
    expect(root.hasAttribute('data-mlv-tile-drag-disabled')).toBe(false);
    const handle = root.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLButtonElement;
    expect(handle.tagName).toBe('BUTTON');
    expect(handle.type).toBe('button');
    expect(handle.getAttribute('aria-label')).toBe('Move tile');
    expect(handle.hasAttribute('aria-hidden')).toBe(false);
    host.componentInstance.disabled.set(true);
    host.detectChanges();
    await host.whenStable();
    expect(root.dataset['mlvTileDragDisabled']).toBe('true');
    expect(handle.disabled).toBe(true);
    expect(handle.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps Sortable clone identity on the wrapper without custom geometry', async () => {
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();
    const rootElement = host.nativeElement.querySelector(
      '.mlv-tiles__item-root',
    ) as HTMLElement;
    const clone = rootElement.cloneNode(true) as HTMLElement;

    expect(clone.dataset['mlvTileId']).toBe('hero');
    expect(clone.textContent).toContain('Hero');
    expect(rootElement.style.getPropertyValue('--mlv-tile-drag-width')).toBe(
      '',
    );
    expect(rootElement.style.getPropertyValue('--mlv-tile-drag-height')).toBe(
      '',
    );
  });

  it('cleans Sortable wrapper metadata when the tile is destroyed', async () => {
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();
    const rootElement = host.nativeElement.querySelector(
      '.mlv-tiles__item-root',
    ) as HTMLElement;
    expect(rootElement.dataset['mlvTileId']).toBe('hero');

    host.destroy();
    expect(rootElement.classList).not.toContain('mlv-tiles__item-root');
    expect(rootElement.hasAttribute('data-mlv-tile-id')).toBe(false);
  });

  it('gives projected header content a dedicated layout container', async () => {
    const hostFixture = TestBed.createComponent(TileHeaderTestHost);
    await hostFixture.whenStable();

    expect(
      hostFixture.nativeElement.querySelector('.mlv-tile__title')?.textContent,
    ).toContain('Deployment status');
  });

  it('leads the header with the drag handle, then groups actions and close after the title', async () => {
    const host = TestBed.createComponent(TileActionsTestHost);
    await host.whenStable();

    const headerChildren = Array.from(
      host.nativeElement.querySelector('.mlv-tile__header').children,
    ) as HTMLElement[];
    const controlChildren = Array.from(
      host.nativeElement.querySelector('.mlv-tile__controls').children,
    ) as HTMLElement[];

    // The handle is the header's first element — a leading indent, not a
    // mid-cluster gap between the title and the actions/close controls.
    expect(headerChildren).toHaveLength(3);
    expect(headerChildren[0].classList).toContain('mlv-tile__drag-handle');
    expect(headerChildren[0].querySelector('svg')?.getAttribute('width')).toBe(
      '16',
    );
    expect(headerChildren[1].classList).toContain('mlv-tile__title');
    expect(headerChildren[2].classList).toContain('mlv-tile__controls');
    expect(controlChildren).toHaveLength(2);
    expect(controlChildren[0].classList).toContain('mlv-tile__actions');
    expect(controlChildren[1].classList).toContain('mlv-button-close');
    expect(controlChildren[1].classList).toContain('mlv-tile__close');
    // The close action pins its own compact density so the control geometry
    // stays constant across the five tile densities.
    expect(controlChildren[1].classList).toContain('mlv-button-close--compact');

    host.nativeElement.querySelector('.mlv-tile__actions button').click();
    expect(host.componentInstance.actionClicks()).toBe(1);
  });

  it('leads the header with the drag handle, then leading and trailing actions in controls', async () => {
    const host = TestBed.createComponent(TileTrailingActionsTestHost);
    await host.whenStable();

    const headerChildren = Array.from(
      host.nativeElement.querySelector('.mlv-tile__header').children,
    ) as HTMLElement[];
    const controls = Array.from(
      host.nativeElement.querySelector('.mlv-tile__controls').children,
    ) as HTMLElement[];

    expect(headerChildren).toHaveLength(3);
    expect(headerChildren[0].classList).toContain('mlv-tile__drag-handle');
    expect(headerChildren[1].classList).toContain('mlv-tile__title');
    expect(headerChildren[2].classList).toContain('mlv-tile__controls');
    expect(controls.map((child) => child.className)).toEqual([
      'mlv-tile__actions',
      'mlv-tile__trailing-actions',
    ]);
  });

  it('reveals only the current nested tile handle for hover and keyboard focus', async () => {
    const host = TestBed.createComponent(NestedHandleTestHost);
    host.detectChanges();
    await host.whenStable();
    const rootElement = host.nativeElement as HTMLElement;
    const header = rootElement.querySelector<HTMLElement>(
      '[data-tile-id="header"]',
    );
    const launch = rootElement.querySelector<HTMLElement>(
      '[data-tile-id="launch"]',
    );
    const introduction = rootElement.querySelector<HTMLElement>(
      '[data-tile-id="introduction"]',
    );
    if (!header || !launch || !introduction) {
      throw new Error('Expected rendered nested tiles');
    }
    const launchHandle = launch.querySelector<HTMLElement>(
      ':scope > .mlv-tile__header > .mlv-tile__drag-handle',
    );
    if (!launchHandle) throw new Error('Expected Launch handle');
    const opacityOneSelectors = selectorsWithDeclaration(
      compiledTileCss(),
      'opacity',
      '1',
    );

    header.classList.add('test-hover');
    launch.classList.add('test-hover');
    const hoverMatches = matchedElements(
      rootElement,
      opacityOneSelectors,
      ':hover',
      'test-hover',
    );
    header.classList.remove('test-hover');
    launch.classList.remove('test-hover');

    header.classList.add('test-focus-within');
    launch.classList.add('test-focus-within');
    const focusMatches = matchedElements(
      rootElement,
      opacityOneSelectors,
      ':focus-within',
      'test-focus-within',
    );

    expect(hoverMatches).toEqual([launchHandle]);
    expect(focusMatches).toEqual([launchHandle]);
    expect(launch.querySelector('button')?.textContent).toContain(
      'Edit Launch',
    );
    expect(launchHandle.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves the existing controls to a full-width row only in narrow tile containers', async () => {
    const host = TestBed.createComponent(TileTrailingActionsTestHost);
    host.detectChanges();
    await host.whenStable();
    const tile = host.nativeElement.querySelector('mlv-tile') as HTMLElement;
    const controls = tile.querySelector(
      ':scope > .mlv-tile__header > .mlv-tile__controls',
    ) as HTMLElement;
    const css = compiledTileCss();
    const root = parse(css);
    const containerAtRule = root.nodes.find(
      (node) =>
        node.type === 'atrule' &&
        node.name === 'container' &&
        node.params.includes('mlv-tile'),
    );
    const controlsDeclarations = new Map<string, string>();
    const header = tile.querySelector(
      ':scope > .mlv-tile__header',
    ) as HTMLElement;
    const headerDeclarations = new Map<string, string>();
    if (containerAtRule?.type === 'atrule') {
      containerAtRule.walkRules((rule) => {
        const declarations = controls.matches(rule.selector)
          ? controlsDeclarations
          : header.matches(rule.selector)
            ? headerDeclarations
            : undefined;
        if (declarations) {
          rule.walkDecls((declaration) => {
            declarations.set(declaration.prop, declaration.value);
          });
        }
      });
    }
    const baseDeclarations = new Map<string, string>();
    root.walkRules('.mlv-tile', (rule) => {
      if (rule.selector !== '.mlv-tile') return;
      rule.walkDecls((declaration) => {
        baseDeclarations.set(declaration.prop, declaration.value);
      });
    });

    expect(baseDeclarations.get('container-type')).toBe('inline-size');
    expect(baseDeclarations.get('container-name')).toBe('mlv-tile');
    expect(containerAtRule?.type === 'atrule' && containerAtRule.params).toBe(
      'mlv-tile (max-width: 18rem)',
    );
    expect(controls.classList).toContain('mlv-tile__controls--crowded');
    expect(headerDeclarations.get('flex-wrap')).toBe('wrap');
    expect(controlsDeclarations.get('flex-basis')).toBe('100%');
    expect(controlsDeclarations.get('width')).toBe('100%');
    // The handle sits ahead of the title as the header's own first child —
    // not inside the wrapping controls cluster — so it is unaffected by the
    // narrow-container wrap and never appears among these controls.
    expect(header.firstElementChild?.classList).toContain(
      'mlv-tile__drag-handle',
    );
    expect(
      Array.from(controls.children).map((child) => child.className),
    ).toEqual(['mlv-tile__actions', 'mlv-tile__trailing-actions']);
    expect(controlsDeclarations.has('height')).toBe(false);
    expect(controlsDeclarations.has('min-height')).toBe(false);
    expect(baseDeclarations.get('background-color')).toBe(
      'var(--mlv-elevation-bg-2)',
    );
  });

  it('keeps a closable-only narrow header in one aligned row without hover tint', async () => {
    const host = TestBed.createComponent(TileClosableTestHost);
    host.detectChanges();
    await host.whenStable();
    const tile = host.nativeElement.querySelector('mlv-tile') as HTMLElement;
    const header = tile.querySelector(
      ':scope > .mlv-tile__header',
    ) as HTMLElement;
    const controls = header.querySelector(
      ':scope > .mlv-tile__controls',
    ) as HTMLElement;
    const css = compiledTileCss();
    const root = parse(css);
    const containerAtRule = root.nodes.find(
      (node) =>
        node.type === 'atrule' &&
        node.name === 'container' &&
        node.params === 'mlv-tile (max-width: 18rem)',
    );
    const narrowHeaderDeclarations = new Map<string, string>();
    const narrowControlsDeclarations = new Map<string, string>();
    if (containerAtRule?.type === 'atrule') {
      containerAtRule.walkRules((rule) => {
        const declarations = header.matches(rule.selector)
          ? narrowHeaderDeclarations
          : controls.matches(rule.selector)
            ? narrowControlsDeclarations
            : undefined;
        if (declarations) {
          rule.walkDecls((declaration) => {
            declarations.set(declaration.prop, declaration.value);
          });
        }
      });
    }
    const hoverBackgrounds: string[] = [];
    root.walkRules((rule) => {
      if (!rule.selector.includes(':hover')) return;
      rule.walkDecls('background-color', (declaration) => {
        hoverBackgrounds.push(declaration.value);
      });
    });

    expect(Array.from(header.children).map((child) => child.className)).toEqual(
      ['mlv-tile__title', 'mlv-tile__controls'],
    );
    expect(
      Array.from(controls.children).map((child) => child.className),
    ).toEqual(['mlv-button-close mlv-tile__close mlv-button-close--compact']);
    expect(controls.classList).not.toContain('mlv-tile__controls--crowded');
    expect(narrowHeaderDeclarations.has('flex-wrap')).toBe(false);
    expect(narrowControlsDeclarations.has('flex-basis')).toBe(false);
    expect(narrowControlsDeclarations.has('width')).toBe(false);
    expect(hoverBackgrounds).toEqual([]);
  });
});

describe('MlvTile locked and inactive states', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  async function createLockedFixture(): Promise<
    ComponentFixture<TileLockedTestHost>
  > {
    await TestBed.configureTestingModule({
      imports: [TileLockedTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(TileLockedTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('cascades locked to every descendant container and tile', async () => {
    const fixture = await createLockedFixture();

    expect(tileElement(fixture, 'header').classList).toContain(
      'mlv-tile--locked',
    );
    // An explicit `[locked]="false"` cannot unlock a locked ancestor.
    expect(fixture.componentInstance.childLocked()).toBe(false);
    expect(tileElement(fixture, 'logo').classList).toContain(
      'mlv-tile--locked',
    );
    expect(
      (tileElement(fixture, 'header').querySelector('mlv-tiles') as HTMLElement)
        .classList,
    ).toContain('mlv-tiles--locked');
    expect(tileElement(fixture, 'body').classList).not.toContain(
      'mlv-tile--locked',
    );

    fixture.componentInstance.headerLocked.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tileElement(fixture, 'logo').classList).not.toContain(
      'mlv-tile--locked',
    );
  });

  it('withdraws the handle, the close action, and the Sortable item', async () => {
    const fixture = await createLockedFixture();
    const header = tileElement(fixture, 'header');
    const body = tileElement(fixture, 'body');

    expect(header.querySelector('.mlv-tile__drag-handle')).toBeNull();
    expect(header.querySelector('.mlv-tile__close')).toBeNull();
    expect(
      tileElement(fixture, 'logo').querySelector('.mlv-tile__drag-handle'),
    ).toBeNull();
    expect(
      tileElement(fixture, 'logo').querySelector('.mlv-tile__close'),
    ).toBeNull();
    expect(header.dataset['mlvTileDragDisabled']).toBe('true');
    expect(tileElement(fixture, 'logo').dataset['mlvTileDragDisabled']).toBe(
      'true',
    );

    expect(body.querySelector('.mlv-tile__drag-handle')).toBeTruthy();
    expect(body.querySelector('.mlv-tile__close')).toBeTruthy();
    expect(body.hasAttribute('data-mlv-tile-drag-disabled')).toBe(false);
  });

  it('excludes a locked subtree from a session an accepting policy would allow', async () => {
    const fixture = await createLockedFixture();
    const rootTiles = fixture.debugElement.query(By.directive(MlvTiles))
      .componentInstance as MlvTiles<DragTestProps>;
    const { coordinator } = rootTiles;

    const session = coordinator.startDrag('body');

    if (!session) throw new Error('Expected a drag session');
    expect(session.allowedTargetIds.has('page')).toBe(true);
    expect(session.allowedTargetIds.has('header')).toBe(false);
    coordinator.endDrag();
  });

  it('makes remove() a no-op while setProps still replaces props', async () => {
    const fixture = await createLockedFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logo = tileByLabel(fixture, 'logo');

    logo.remove();
    fixture.detectChanges();

    expect(
      (
        fixture.componentInstance.tree()
          .children[0] as MlvTileNodeWithChildren<DragTestProps>
      ).children.map(({ id }) => id),
    ).toEqual(['logo']);
    expect(warn).toHaveBeenCalledTimes(1);

    logo.setProps({ title: 'Renamed logo' });
    fixture.detectChanges();

    expect(
      (
        fixture.componentInstance.tree()
          .children[0] as MlvTileNodeWithChildren<DragTestProps>
      ).children[0].props.title,
    ).toBe('Renamed logo');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('inserts a child into an unlocked container node and rejects a leaf', async () => {
    const fixture = await createLockedFixture();
    fixture.componentInstance.headerLocked.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      tileByLabel(fixture, 'header').insertChild(
        { id: 'nav', acceptsChildren: false, props: { title: 'Nav' } },
        0,
      ),
    ).toBe(true);
    fixture.detectChanges();
    expect(
      (
        fixture.componentInstance.tree()
          .children[0] as MlvTileNodeWithChildren<DragTestProps>
      ).children.map(({ id }) => id),
    ).toEqual(['nav', 'logo']);
    expect(warn).not.toHaveBeenCalled();

    expect(
      tileByLabel(fixture, 'body').insertChild({
        id: 'orphan',
        acceptsChildren: false,
        props: { title: 'Orphan' },
      }),
    ).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('rejects insertChild while the tile is locked', async () => {
    const fixture = await createLockedFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const before = fixture.componentInstance.tree();

    expect(
      tileByLabel(fixture, 'header').insertChild({
        id: 'nav',
        acceptsChildren: false,
        props: { title: 'Nav' },
      }),
    ).toBe(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.tree()).toBe(before);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('stops an unlocked root from removing a node inside a locked subtree', async () => {
    const fixture = await createLockedFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rootTiles = fixture.debugElement.query(By.directive(MlvTiles))
      .componentInstance as MlvTiles<DragTestProps>;
    const before = fixture.componentInstance.tree();

    // The root container is not locked, but `logo` sits inside one that is.
    expect(rootTiles.lockedState()).toBe(false);
    expect(rootTiles.remove('logo')).toBe(false);
    expect(rootTiles.remove('header')).toBe(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.tree()).toBe(before);
    expect(warn).toHaveBeenCalledTimes(2);

    expect(rootTiles.remove('body')).toBe(true);
    fixture.detectChanges();
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['header']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('rejects insert on a locked container reference', async () => {
    const fixture = await createLockedFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const nested = fixture.debugElement
      .queryAll(By.directive(MlvTiles))
      .map((debug) => debug.componentInstance as MlvTiles<DragTestProps>)
      .find((container) => container.targetId() === 'header');
    if (!nested) throw new Error('Expected the nested header container');
    const before = fixture.componentInstance.tree();

    expect(nested.lockedState()).toBe(true);
    expect(
      nested.insert({
        id: 'nav',
        acceptsChildren: false,
        props: { title: 'Nav' },
      }),
    ).toBe(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.tree()).toBe(before);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('de-emphasises only the body for inactive and adds no ARIA state', async () => {
    const fixture = await createLockedFixture();
    const body = tileElement(fixture, 'body');

    expect(body.classList).not.toContain('mlv-tile--inactive');

    fixture.componentInstance.bodyInactive.set(true);
    fixture.detectChanges();

    expect(body.classList).toContain('mlv-tile--inactive');
    expect(body.hasAttribute('aria-disabled')).toBe(false);
    expect(body.hasAttribute('aria-hidden')).toBe(false);
    expect(body.querySelector('.mlv-tile__close')).toBeTruthy();
    // Non-cascading: a nested tile never inherits the modifier.
    expect(tileElement(fixture, 'header').classList).not.toContain(
      'mlv-tile--inactive',
    );
  });

  it('quiets a locked outline and dims only the inactive body', () => {
    const css = compiledTileCss();
    const rules = new Map<string, Map<string, string>>();
    parse(css).walkRules((rule) => {
      if (
        !rule.selector.includes('--locked') &&
        !rule.selector.includes('--inactive')
      ) {
        return;
      }
      const declarations = new Map<string, string>();
      rule.walkDecls((declaration) =>
        declarations.set(declaration.prop, declaration.value),
      );
      rules.set(rule.selector, declarations);
    });

    expect(rules.get('.mlv-tile--locked')?.get('border-color')).toBe(
      'var(--mlv-border-subtle)',
    );
    expect(rules.get('.mlv-tile--locked .mlv-tile__title')?.get('color')).toBe(
      'var(--mlv-text-secondary)',
    );
    expect(
      rules.get('.mlv-tile--inactive > .mlv-tile__body')?.get('opacity'),
    ).toBe('var(--mlv-disabled-opacity)');
    expect(
      rules
        .get('.mlv-tile--inactive > .mlv-tile__header > .mlv-tile__title')
        ?.get('color'),
    ).toBe('var(--mlv-text-secondary)');
  });
});

// ─── Focus ring ──────────────────────────────────────────────────────────────

/**
 * The block shipped no `:focus-visible` rule at all, so the drag handle fell
 * back to Chrome's UA ring (`rgb(0, 95, 204) auto 1px`) while the `mlvButton`
 * controls beside it in the same `.mlv-tile__controls` row drew the
 * design-system one. These assertions pin the rule down and, because
 * `.mlv-tile` clips to its padding box, prove the ring still fits inside the
 * tightest padding the block ever applies.
 */
const themeScss = readFileSync(
  fileURLToPath(import.meta.url).replace(
    /src\/lib\/tile\/tile\.spec\.ts$/,
    '../../styles/src/lib/theme.scss',
  ),
  'utf8',
);

/** Every rem value declared for one token across all theme blocks. */
function remValues(token: string): number[] {
  const matches = [
    ...themeScss.matchAll(new RegExp(`${token}:\\s*([\\d.]+)rem`, 'g')),
  ].map((match) => Number(match[1]));
  expect(matches.length, `${token} in theme.scss`).toBeGreaterThan(0);
  return matches;
}

/** Declarations of one exact selector in the compiled stylesheet. */
function declarationsOf(css: string, selector: string): Map<string, string> {
  const declarations = new Map<string, string>();
  let found = false;
  parse(css).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    found = true;
    rule.walkDecls((declaration) =>
      declarations.set(declaration.prop, declaration.value),
    );
  });
  expect(found, `rule ${selector}`).toBe(true);
  return declarations;
}

describe('MlvTile — focus ring', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('draws the design-system ring on the drag handle', () => {
    const rule = declarationsOf(
      compiledTileCss(),
      '.mlv-tile__drag-handle:focus-visible',
    );

    expect(rule.get('outline')).toBe(
      'var(--mlv-stroke-width-medium) solid var(--mlv-border-focus)',
    );
    // Form B (inset) — the block clips to its padding box, so the ring must
    // never extend past the handle's own edge.
    expect(rule.get('outline-offset')).toBe(
      'calc(var(--mlv-focus-ring-offset) * -1)',
    );
  });

  it('never suppresses a focus ring anywhere in the block', () => {
    const suppressed: string[] = [];
    parse(compiledTileCss()).walkDecls((declaration) => {
      if (
        declaration.prop !== 'outline' &&
        declaration.prop !== 'outline-style'
      ) {
        return;
      }
      const value = declaration.value.trim();
      if (value === 'none' || value === '0' || value.startsWith('none')) {
        suppressed.push(
          `${declaration.parent?.toString().split('{')[0]?.trim()}`,
        );
      }
    });
    expect(suppressed).toEqual([]);
  });

  it('keeps the ring inside the padding box the block clips to', () => {
    const css = compiledTileCss();
    // The clip that makes this a real constraint.
    expect(declarationsOf(css, '.mlv-tile').get('overflow')).toBe('hidden');
    // The tightest padding the block ever applies, and the tokens behind it.
    expect(
      declarationsOf(css, '.mlv-tile[class*="--tight"]').get(
        '--mlv-tile-padding',
      ),
    ).toBe('var(--mlv-padding-xs)');
    expect(themeScss).toContain(
      '--mlv-padding-xs: var(--mlv-spacing-1) var(--mlv-spacing-2);',
    );

    // Form B (SF-R3): `outline-offset` is `-focus-ring-offset`, so the ring's
    // outer edge sits `width - offset` from the handle's own border — the
    // amount it can still protrude past the handle into the tile's padding
    // (zero or negative means fully inset). The high-contrast theme widens
    // the stroke without widening the offset, so it is the tightest case.
    const offset = Math.min(...remValues('--mlv-focus-ring-offset'));
    const ring = Math.max(...remValues('--mlv-stroke-width-medium')) - offset;
    const blockPadding = Math.min(...remValues('--mlv-spacing-1'));
    const inlinePadding = Math.min(...remValues('--mlv-spacing-2'));

    expect(ring).toBeLessThanOrEqual(blockPadding);
    expect(ring).toBeLessThanOrEqual(inlinePadding);
  });

  it('applies the ring to the rendered handle and keeps it revealed', async () => {
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();

    const root = host.nativeElement as HTMLElement;
    const handle = root.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLButtonElement;
    expect(handle.tagName).toBe('BUTTON');

    const ringSelectors = selectorsWithDeclaration(
      compiledTileCss(),
      'outline-offset',
      'calc(var(--mlv-focus-ring-offset) * -1)',
    );
    handle.classList.add('test-focus');
    expect(
      matchedElements(root, ringSelectors, ':focus-visible', 'test-focus'),
    ).toEqual([handle]);
    handle.classList.remove('test-focus');

    // A hover-capable pointer dims an idle handle; focus has to bring it back
    // to full opacity or the ring would paint on a barely-visible control.
    const revealSelectors = selectorsWithDeclaration(
      compiledTileCss(),
      'opacity',
      '1',
    );
    const tile = handle.closest('.mlv-tile') as HTMLElement;
    tile.classList.add('test-focus-within');
    expect(
      matchedElements(
        root,
        revealSelectors,
        ':focus-within',
        'test-focus-within',
      ),
    ).toContain(handle);
    tile.classList.remove('test-focus-within');

    handle.focus();
    expect(document.activeElement).toBe(handle);
  });
});

describe('MlvTile — drag-start lift', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTiles, MlvTile],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('keeps box-shadow in the tile’s own transition list, so its lift can animate', () => {
    expect(
      declarationsOf(compiledTileCss(), '.mlv-tile').get('transition-property'),
    ).toBe('background-color, border-color, box-shadow');
  });

  it('elevates the still-connected source tile the instant Sortable marks it chosen', () => {
    const css = compiledTileCss();
    // Two forms because `resolveItemRoot` (tiles.ts) may mark either the tile
    // host itself (fused) or a wrapping consumer element (ancestor) as the
    // Sortable item root Sortable's `chosenClass` is toggled on.
    const fused = declarationsOf(css, '.mlv-tile.mlv-tiles__sortable-chosen');
    const wrapped = declarationsOf(
      css,
      '.mlv-tiles__sortable-chosen > .mlv-tile',
    );
    expect(fused.get('box-shadow')).toBe('var(--mlv-shadow-overlay)');
    expect(wrapped.get('box-shadow')).toBe('var(--mlv-shadow-overlay)');
    // Matches the pointer-following fallback clone's own elevation
    // (tiles.scss `&__sortable-fallback`) so the lift reads as one continuous
    // gesture even though the clone itself cannot animate its own appearance.
  });

  it('applies the fused chosen selector to a tile that is its own Sortable item root', async () => {
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();

    const tile = host.nativeElement.querySelector('.mlv-tile') as HTMLElement;
    tile.classList.add('mlv-tiles__sortable-chosen');
    expect(tile.matches('.mlv-tile.mlv-tiles__sortable-chosen')).toBe(true);
    tile.classList.remove('mlv-tiles__sortable-chosen');
  });
});

// ─── Drag handle hit-area geometry ──────────────────────────────────────────

/**
 * A 44px `min-width`/`min-height` floor on the visible handle box reserved a
 * wide empty run before the title (owner feedback on the leading-indent
 * change above). The visible box now hugs the glyph plus a hair of breathing
 * room, and the ≥44px pointer/drag target is restored by an out-of-flow
 * `::before` overlay instead, so it costs no header layout space.
 */
describe('MlvTile — drag handle hit-area geometry', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTiles, MlvTile],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  /**
   * Strips ALL whitespace so the assertions below pin the actual token
   * content (properties, operators, custom-property references) without
   * being pinned to incidental line-wrapping — Sass and Prettier disagree on
   * how to wrap a long `calc()`/`min()`, and Prettier reformats this file's
   * source on every commit (lint-staged), so exact whitespace is not stable.
   */
  function tokens(value: string | undefined): string {
    return (value ?? '').replace(/\s+/g, '');
  }

  it('shrinks the visible box to the glyph plus a hair of breathing room, dropping the 44px floor', () => {
    const rule = declarationsOf(compiledTileCss(), '.mlv-tile__drag-handle');

    expect(rule.has('min-width')).toBe(false);
    expect(rule.has('min-height')).toBe(false);
    expect(tokens(rule.get('--mlv-tile-handle-visible-size'))).toBe(
      tokens(
        'calc(var(--mlv-tile-handle-icon-size) + var(--mlv-spacing-1) * 2)',
      ),
    );
    expect(rule.get('width')).toBe('var(--mlv-tile-handle-visible-size)');
    expect(rule.get('height')).toBe('var(--mlv-tile-handle-visible-size)');
  });

  it('restores a >=44px pointer target via an out-of-flow ::before overlay', () => {
    const rule = declarationsOf(
      compiledTileCss(),
      '.mlv-tile__drag-handle::before',
    );

    expect(rule.get('position')).toBe('absolute');
    expect(rule.has('display')).toBe(false);
    expect(rule.get('--mlv-tile-handle-hit-size')).toBe('var(--mlv-height-m)');
    expect(tokens(rule.get('--mlv-tile-handle-hit-expand'))).toBe(
      tokens(
        'calc((var(--mlv-tile-handle-hit-size) - var(--mlv-tile-handle-visible-size)) / 2)',
      ),
    );
    expect(tokens(rule.get('inset-block'))).toBe(
      tokens('calc(-1 * var(--mlv-tile-handle-hit-expand))'),
    );
  });

  it('caps the reach toward the title at half the header gap, expanding the rest toward the leading padding', () => {
    const rule = declarationsOf(
      compiledTileCss(),
      '.mlv-tile__drag-handle::before',
    );

    // The reach toward the title (inline-end) is capped at half the header
    // gap so the hit area can never cross into the title's own box.
    expect(tokens(rule.get('--mlv-tile-handle-hit-expand-end'))).toBe(
      tokens('min(var(--mlv-tile-handle-hit-expand), var(--mlv-tile-gap) / 2)'),
    );
    expect(tokens(rule.get('inset-inline-end'))).toBe(
      tokens('calc(-1 * var(--mlv-tile-handle-hit-expand-end))'),
    );
    // Whatever budget the capped end side did not use expands inline-start
    // instead, into the tile's own ample leading padding, so the overlay
    // still reaches the full hit-size width overall.
    expect(tokens(rule.get('inset-inline-start'))).toBe(
      tokens(
        'calc(-1 * (var(--mlv-tile-handle-hit-expand) * 2 - var(--mlv-tile-handle-hit-expand-end)))',
      ),
    );
  });

  it('keeps the pointer/drag hit-area overlay resolving clicks to the real handle element', async () => {
    // Pseudo-elements have no separate DOM/EventTarget identity — a pointer
    // event anywhere inside `::before`'s painted box still reports the host
    // `.mlv-tile__drag-handle` as `event.target`, so SortableJS's `handle`
    // option (a plain CSS selector match) and this element's own
    // click/keydown listeners are unaffected by the overlay.
    const host = TestBed.createComponent(TileDragTestHost);
    host.detectChanges();
    await host.whenStable();

    const handle = host.nativeElement.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLButtonElement;
    let target: EventTarget | null = null;
    handle.addEventListener('mousedown', (event) => {
      target = event.target;
    });
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(target).toBe(handle);
  });
});

describe('MlvTile — scoped direction', () => {
  let fixture: ComponentFixture<TileDragTestHost>;
  let handle: HTMLElement;
  let moves: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileDragTestHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TileDragTestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.debugElement.query(By.directive(MlvTiles))
      .componentInstance as MlvTiles<DragTestProps>;
    // The tree operation itself is covered by the coordinator specs; what this
    // suite asserts is *which* logical direction each physical key resolves to.
    moves = vi
      .spyOn(root, 'moveByKeyboard')
      .mockImplementation(() => undefined);
    handle = fixture.nativeElement.querySelector(
      '.mlv-tile__drag-handle',
    ) as HTMLElement;
  });

  afterEach(() => {
    moves.mockRestore();
    // `setDirection` is global state (it writes `dir` onto <html>) — reset both
    // the service and the attribute so a direction never leaks into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  function altArrow(key: string): void {
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
  }

  /** The `direction` argument of every recorded move, in order. */
  function directions(): string[] {
    return moves.mock.calls.map((call) => String(call[1]));
  }

  it('mirrors Alt+Arrow moves inside a scoped [dir="rtl"] subtree while the document stays LTR', () => {
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    altArrow('ArrowRight');
    altArrow('ArrowLeft');
    // Vertical arrows never mirror.
    altArrow('ArrowUp');
    altArrow('ArrowDown');

    expect(directions()).toEqual(['left', 'right', 'up', 'down']);

    scope.removeAttribute('dir');
  });

  it('leaves a scoped [dir="ltr"] island unmirrored while the document is RTL', () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');
    fixture.detectChanges();

    altArrow('ArrowRight');
    altArrow('ArrowLeft');

    expect(directions()).toEqual(['right', 'left']);

    scope.removeAttribute('dir');
  });
});

/**
 * Accessibility sweep — standalone tile.
 *
 * A standalone `mlv-tile` renders no role, but its header row assembles up to
 * four separately-named things: the projected header, the leading and trailing
 * action slots, an `mlv-button-close` whose only content is a glyph, and — for
 * `draggable` without a `[tile]` registration — a **decorative** grip that is a
 * `<span aria-hidden="true">` rather than a button, because a standalone tile
 * has no tree to move within. That distinction is the point of this sweep: an
 * operable handle appears only in the compound case (swept in `tiles.spec.ts`),
 * and a nameless focusable grip here would be a defect.
 */
describe('MlvTile accessibility — standalone', () => {
  @Component({
    imports: [MlvTile, MlvTileHeader, MlvTileActions, MlvTileTrailingActions],
    template: `
      @for (tone of tones; track tone) {
        <mlv-tile [tone]="tone">
          <ng-template mlvTileHeader>{{ tone }} tile</ng-template>
          Body copy
        </mlv-tile>
      }

      <mlv-tile closable draggable id="chrome">
        <ng-template mlvTileHeader>Hero section</ng-template>
        <ng-template mlvTileActions>
          <button type="button" aria-label="Edit">
            <svg aria-hidden="true"></svg>
          </button>
        </ng-template>
        <ng-template mlvTileTrailingActions>
          <button type="button">Publish</button>
        </ng-template>
        Published content
      </mlv-tile>

      <mlv-tile inactive locked id="frozen">
        <ng-template mlvTileHeader>Archived</ng-template>
        Read-only body
      </mlv-tile>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TileA11yHost {
    readonly tones = [
      'default',
      'info',
      'success',
      'warning',
      'danger',
    ] as const;
  }

  it('has no axe violations across tones, slots and the close action', async () => {
    await TestBed.configureTestingModule({
      imports: [TileA11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(TileA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: seven tiles. The chrome one really did render its close button
    // with a name, and its standalone grip is the decorative `<span>` branch —
    // hidden, not a nameless tab stop.
    expect(host.querySelectorAll('mlv-tile')).toHaveLength(7);
    const close = host.querySelector(
      '.mlv-tile__close button',
    ) as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBeTruthy();
    const grip = host.querySelector('.mlv-tile__drag-handle') as HTMLElement;
    expect(grip.tagName.toLowerCase()).toBe('span');
    expect(grip.getAttribute('aria-hidden')).toBe('true');

    await expectNoAxeViolations(host);
  });
});
