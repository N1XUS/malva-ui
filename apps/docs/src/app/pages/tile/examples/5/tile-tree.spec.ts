import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { By } from '@angular/platform-browser';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective } from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvTiles,
  type MlvTileNodeWithChildren,
  type MlvTileTreeNode,
} from '@malva-ui/core/tile';
import { beforeEach, describe, expect, it } from 'vitest';

import TileSiteBuilderExampleComponent from './index';
import type { PageBuilderProps } from './tile-tree-node';

const SOURCE_FILES = [
  'index.ts',
  'index.html',
  'tile-tree-node.ts',
  'tile-tree-node.html',
] as const;

function findNode(
  node: MlvTileTreeNode<PageBuilderProps>,
  tileId: string,
): MlvTileTreeNode<PageBuilderProps> | undefined {
  if (node.id === tileId) return node;
  if (!node.acceptsChildren) return undefined;

  for (const child of node.children) {
    const match = findNode(child, tileId);
    if (match) return match;
  }

  return undefined;
}

function requireContainer(
  root: MlvTileNodeWithChildren<PageBuilderProps>,
  tileId: string,
): MlvTileNodeWithChildren<PageBuilderProps> {
  const node = findNode(root, tileId);
  if (!node?.acceptsChildren) {
    throw new Error(`Expected container ${tileId}`);
  }

  return node;
}

function requireTile(
  fixture: ComponentFixture<TileSiteBuilderExampleComponent>,
  title: string,
): HTMLElement {
  const tile = Array.from(
    fixture.nativeElement.querySelectorAll('mlv-tile'),
  ).find(
    (candidate) =>
      candidate.querySelector('strong')?.textContent?.trim() === title,
  );
  if (!tile) throw new Error(`Expected rendered tile ${title}`);
  return tile;
}

describe('TileSiteBuilderExampleComponent', () => {
  let fixture: ComponentFixture<TileSiteBuilderExampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TileSiteBuilderExampleComponent);
    fixture.detectChanges();
  });

  it('binds one public root tree while nested containers inherit it', () => {
    const component = fixture.componentInstance;
    const tiles = fixture.debugElement
      .queryAll(By.directive(MlvTiles))
      .map((element) => element.injector.get(MlvTiles));
    const [rootTiles, ...nestedTiles] = tiles;

    expect(rootTiles.tree()).toBe(component.page());
    expect(nestedTiles.length).toBeGreaterThan(0);
    expect(nestedTiles.every((nested) => nested.tree() === undefined)).toBe(
      true,
    );
  });

  it('keeps CDK drag-and-drop outside the docs consumer surface', () => {
    const source = SOURCE_FILES.map((path) =>
      readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'),
    ).join('\n');

    expect(source).not.toContain('@angular/cdk/drag-drop');
  });

  it('accepts leaves broadly and rows only when the target has no leaves', () => {
    const component = fixture.componentInstance;
    const page = component.page();
    const row = requireContainer(page, 'feature-row');
    const headerRow = requireContainer(page, 'header-row');
    const emptyRow = requireContainer(page, 'empty-row');
    const mediaRow = requireContainer(page, 'media-row');
    const hero = findNode(page, 'hero');
    if (!hero) throw new Error('Expected hero tile');

    expect(row.props.kind).toBe('row');
    expect(row.props.blockType).toBeUndefined();
    expect(hero.props).toMatchObject({ kind: 'block', blockType: 'hero' });
    expect(component.canAccept(row, headerRow, headerRow.children)).toBe(false);
    expect(component.canAccept(row, emptyRow, emptyRow.children)).toBe(true);
    expect(component.canAccept(hero, mediaRow, mediaRow.children)).toBe(true);
  });

  it('leads with the built-in handle, then projects Edit, compact Switch, and Trash in order', () => {
    const tile = requireTile(fixture, 'Launch campaign');
    const header = tile.querySelector('.mlv-tile__header') as HTMLElement;
    const controls = Array.from(
      tile.querySelector('.mlv-tile__controls')?.children ?? [],
    ) as HTMLElement[];
    const switchElement = fixture.debugElement
      .queryAll(By.css('mlv-switch'))
      .find((element) => tile.contains(element.nativeElement));

    expect(
      tile.querySelector('button[aria-label="Edit Launch campaign"]'),
    ).not.toBeNull();
    expect(
      tile.querySelector('input[aria-label="Publish Launch campaign"]'),
    ).not.toBeNull();
    expect(tile.querySelector('.mlv-tile__drag-handle')).not.toBeNull();
    expect(
      tile.querySelector('button[aria-label="Remove Launch campaign"]'),
    ).not.toBeNull();
    expect(tile.querySelector('.mlv-button-close')).toBeNull();
    // The handle is the header's first element — a leading indent ahead of
    // the title — rather than sitting mid-cluster between Edit/Switch and
    // Trash.
    expect(header.firstElementChild?.classList).toContain(
      'mlv-tile__drag-handle',
    );
    expect(controls.map((control) => control.className)).toEqual([
      'mlv-tile__actions',
      'mlv-tile__trailing-actions',
    ]);
    if (!switchElement) throw new Error('Expected Launch campaign switch');
    expect(
      switchElement.injector.get(MlvDensityDirective).effectiveDensity(),
    ).toBe('compact');
  });

  it('keeps the action header focused on the title and renders details in the body', () => {
    const tile = requireTile(fixture, 'Launch campaign');
    const header = tile.querySelector('.mlv-tile__title');
    const body = tile.querySelector(':scope > .mlv-tile__body');
    const details = body?.querySelector(
      ':scope > .docs-tile-tree-node__details',
    );

    expect(header?.querySelector(':scope > strong')?.textContent?.trim()).toBe(
      'Launch campaign',
    );
    expect(header?.querySelector('.docs-tile-tree-node__details')).toBeNull();
    expect(
      details?.querySelector('.docs-tile-tree-node__meta')?.textContent?.trim(),
    ).toBe('hero');
    expect(
      details
        ?.querySelector('.docs-tile-tree-node__summary')
        ?.textContent?.trim(),
    ).toBe('Primary headline and featured message');
  });

  it('updates publication, title, and removal through public tile methods', () => {
    const component = fixture.componentInstance;
    let heroTile = requireTile(fixture, 'Launch campaign');

    heroTile
      .querySelector<HTMLInputElement>(
        'input[aria-label="Publish Launch campaign"]',
      )
      ?.click();
    fixture.detectChanges();
    expect(findNode(component.page(), 'hero')?.props.enabled).toBe(false);

    heroTile
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Edit Launch campaign"]',
      )
      ?.click();
    fixture.detectChanges();
    const inputDebugElement = fixture.debugElement
      .queryAll(By.directive(MlvInput))
      .find((element) => heroTile.contains(element.nativeElement));
    const input = inputDebugElement?.componentInstance as MlvInput | undefined;
    if (!input || !inputDebugElement) throw new Error('Expected title editor');
    input.value.set('Summer campaign');
    inputDebugElement.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    expect(findNode(component.page(), 'hero')?.props.title).toBe(
      'Summer campaign',
    );

    heroTile = requireTile(fixture, 'Summer campaign');
    heroTile
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Summer campaign"]',
      )
      ?.click();
    fixture.detectChanges();

    expect(findNode(component.page(), 'hero')).toBeUndefined();
  });
});
