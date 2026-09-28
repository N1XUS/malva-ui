import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import type { MlvAvatarSize } from '@malva-ui/core/avatar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvAvatarGroup } from './avatar-group';
import type { MlvAvatarGroupMember } from './avatar-group';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the paths
// are resolved from this file rather than from `process.cwd()`.
const HERE = dirname(fileURLToPath(import.meta.url));
const AVATAR_SCSS = resolve(
  HERE,
  '../../../../avatar/src/lib/avatar/avatar.scss',
);
const AVATAR_GROUP_SCSS = resolve(HERE, './avatar-group.scss');

/**
 * The geometry the stylesheets render, in rem: `--mlv-avatar-size` on
 * `.mlv-avatar--<size>` and the magnitude of `--mlv-ag-overlap` on
 * `.mlv-avatar-group--size-<size>`. The first `describe` pins this table to
 * the compiled CSS, so every expectation derived from it below is what a
 * browser lays out — not what the component happens to assume.
 */
const RENDERED_REM: Record<MlvAvatarSize, { size: number; overlap: number }> = {
  xs: { size: 1.5, overlap: 0.25 },
  s: { size: 2, overlap: 0.375 },
  m: { size: 2.5, overlap: 0.5 },
  l: { size: 3.5, overlap: 0.625 },
  xl: { size: 5, overlap: 0.75 },
  xxl: { size: 6, overlap: 0.875 },
};

const SIZES = Object.keys(RENDERED_REM) as MlvAvatarSize[];

/**
 * Inline size in px that `slots` stacked avatars (the `+N` counter counts as
 * one) occupy at a given root font size: one full avatar, then each further
 * avatar adds its size minus the overlap.
 */
function slotsWidthPx(
  size: MlvAvatarSize,
  slots: number,
  rootPx: number,
): number {
  const { size: sizeRem, overlap } = RENDERED_REM[size];
  return (sizeRem + (slots - 1) * (sizeRem - overlap)) * rootPx;
}

const MEMBERS_10: MlvAvatarGroupMember[] = [
  'Alice Johnson',
  'Bob Martinez',
  'Carol White',
  'David Kim',
  'Eva Brown',
  'Frank Lee',
  'Grace Chen',
  'Henry Ford',
  'Iris Novak',
  'Jack Stone',
].map((name) => ({ name }));

const MEMBERS_7 = MEMBERS_10.slice(0, 7);

@Component({
  imports: [MlvAvatarGroup],
  template: `<mlv-avatar-group [members]="members()" [size]="size()" />`,
})
class RemFitHost {
  members = signal<MlvAvatarGroupMember[]>(MEMBERS_7);
  size = signal<MlvAvatarSize>('m');
}

let resizeSubject: Subject<ResizeObserverEntry[]>;

async function setup(): Promise<{
  fixture: ComponentFixture<RemFitHost>;
  host: RemFitHost;
}> {
  resizeSubject = new Subject<ResizeObserverEntry[]>();
  await TestBed.configureTestingModule({
    imports: [RemFitHost],
    providers: [
      provideMlvI18nTesting(),
      {
        provide: MlvResizeObserverService,
        useValue: { observe: () => resizeSubject.asObservable() },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RemFitHost);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host: fixture.componentInstance };
}

/**
 * What the host's `ResizeObserver` reports: jsdom performs no layout, so the
 * width a browser would measure is fed in directly.
 */
function measure(fixture: ComponentFixture<unknown>, width: number): void {
  emitWidth(width);
  fixture.detectChanges();
}

/** Delivers one observer callback, without rendering its result. */
function emitWidth(width: number): void {
  resizeSubject.next([
    { contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry,
  ]);
}

/**
 * Delivers one observer callback while the document reports `view` as its
 * `defaultView`. The component reads the root font size through the injected
 * document (#337), so shadowing the accessor there is enough; the prototype
 * getter comes back once the own property is deleted.
 */
function emitWidthWithView(width: number, view: Window | null): void {
  Object.defineProperty(document, 'defaultView', {
    configurable: true,
    get: () => view,
  });
  try {
    emitWidth(width);
  } finally {
    delete (document as { defaultView?: unknown }).defaultView;
  }
}

/** The real window, with `getComputedStyle` replaced by `computedStyle`. */
function viewWith(
  computedStyle: (element: Element) => Partial<CSSStyleDeclaration>,
): Window {
  const realView = document.defaultView as Window;
  return new Proxy(realView, {
    get(target, property) {
      if (property === 'getComputedStyle') return computedStyle;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Visible avatar count and the `+N` counter text (`null` when absent). */
function rendered(fixture: ComponentFixture<unknown>): {
  visible: number;
  counter: string | null;
} {
  const root = fixture.nativeElement as HTMLElement;
  const counter = root.querySelector(
    '.mlv-avatar-group__overflow .mlv-avatar__initials',
  );
  return {
    visible: root.querySelectorAll('.mlv-avatar-group__item').length,
    counter: counter?.textContent?.trim() ?? null,
  };
}

function setRootFontSize(px: number): void {
  document.documentElement.style.fontSize = `${px}px`;
}

afterEach(() => {
  document.documentElement.style.removeProperty('font-size');
});

describe('MlvAvatarGroup — rendered geometry the fit counts (#356)', () => {
  const avatarCss = stripCssLayersFromText(sass.compile(AVATAR_SCSS).css);
  const groupCss = stripCssLayersFromText(sass.compile(AVATAR_GROUP_SCSS).css);

  it.each(SIZES)(
    'size %s: the avatar edge and the stack overlap are the rem values the fit counts',
    (size) => {
      const avatarSize = avatarCss.match(
        new RegExp(
          String.raw`\.mlv-avatar--${size}\s*\{[^}]*--mlv-avatar-size:\s*([\d.]+)rem;`,
        ),
      );
      const overlap = groupCss.match(
        new RegExp(
          String.raw`\.mlv-avatar-group--size-${size}\s*\{[^}]*--mlv-ag-overlap:\s*-([\d.]+)rem;`,
        ),
      );
      expect(Number(avatarSize?.[1])).toBe(RENDERED_REM[size].size);
      expect(Number(overlap?.[1])).toBe(RENDERED_REM[size].overlap);
    },
  );
});

describe('MlvAvatarGroup — fit follows the root font size (#356)', () => {
  it('fits 3 avatars and the counter in 200px of size m at a 20px root', async () => {
    // The issue's scenario: a browser "large" font setting puts the root at
    // 20px, so a size-m avatar renders 50px wide and steps 40px. Five slots
    // would need 50 + 4 × 40 = 210px, so four fit: three avatars and "+4".
    // Counted at a fixed 16px root the group showed five avatars and "+2",
    // 250px of avatars in a 200px box — the counter clipped.
    setRootFontSize(20);
    const { fixture } = await setup();

    measure(fixture, 200);

    expect(rendered(fixture)).toEqual({ visible: 3, counter: '+4' });
  });

  describe.each([20, 12])('at a %ipx root', (rootPx) => {
    // 20px renders every avatar larger than 16px-root constants assume (the
    // group overflowed); 12px renders them smaller (the group under-filled,
    // withholding avatars that fit). Both must count what is rendered.
    it.each(SIZES)(
      'size %s: four slots fit exactly at their rendered width, three one pixel short',
      async (size) => {
        setRootFontSize(rootPx);
        const { fixture, host } = await setup();
        host.members.set(MEMBERS_10);
        host.size.set(size);
        fixture.detectChanges();

        const fourSlots = slotsWidthPx(size, 4, rootPx);

        measure(fixture, fourSlots);
        expect(rendered(fixture)).toEqual({ visible: 3, counter: '+7' });

        measure(fixture, fourSlots - 1);
        expect(rendered(fixture)).toEqual({ visible: 2, counter: '+8' });
      },
    );
  });

  it.each(SIZES)(
    'size %s at a 16px root counts exactly as before',
    async (size) => {
      // Identical at a 16px root: the old px tables were these rem values
      // times 16, so nothing moves for a user on the default font size.
      setRootFontSize(16);
      const { fixture, host } = await setup();
      host.members.set(MEMBERS_10);
      host.size.set(size);
      fixture.detectChanges();

      const fiveSlots = slotsWidthPx(size, 5, 16);

      measure(fixture, fiveSlots);
      expect(rendered(fixture)).toEqual({ visible: 4, counter: '+6' });

      measure(fixture, fiveSlots - 1);
      expect(rendered(fixture)).toEqual({ visible: 3, counter: '+7' });
    },
  );

  it('re-reads the root font size on every measurement', async () => {
    // A root font-size change resizes every rendered avatar, so the host's
    // content box changes height and its observer fires again — with the
    // same width. The fit must take the new root from that callback rather
    // than keep the one it read first.
    setRootFontSize(16);
    const { fixture } = await setup();

    measure(fixture, 200);
    // 16px root: 40px avatars stepping 32px → six slots.
    expect(rendered(fixture)).toEqual({ visible: 5, counter: '+2' });

    setRootFontSize(20);
    measure(fixture, 200);
    expect(rendered(fixture)).toEqual({ visible: 3, counter: '+4' });
  });

  it('applies the last root read to a size change that brings no new measurement', async () => {
    setRootFontSize(20);
    const { fixture, host } = await setup();
    measure(fixture, 200);
    expect(rendered(fixture)).toEqual({ visible: 3, counter: '+4' });

    // Size s at 20px: 40px avatars stepping 32.5px — floor(160 / 32.5) + 1
    // = 5 slots. No observer callback arrives for an input change before the
    // next frame, so the root read with the last width has to carry over.
    host.size.set('s');
    fixture.detectChanges();
    expect(rendered(fixture)).toEqual({ visible: 4, counter: '+3' });
  });

  it("reads the root font size through the injected document's view", async () => {
    // The document the component was given, not the ambient globals (#337):
    // shadow `defaultView` on it so its view reports a 20px root while the
    // ambient `getComputedStyle` still reads the real, unstyled root.
    const { fixture } = await setup();
    const seen: Element[] = [];
    const view = viewWith((element) => {
      seen.push(element);
      return { fontSize: '20px' };
    });

    emitWidthWithView(200, view);
    fixture.detectChanges();

    // Compared as booleans: a failing `toEqual` on elements would pretty-print
    // the whole document.
    expect(seen.map((element) => element === document.documentElement)).toEqual(
      [true],
    );
    expect(rendered(fixture)).toEqual({ visible: 3, counter: '+4' });
  });

  // In every fallback case the real root is 20px, so an ambient read (three
  // avatars) cannot pass for the fallback. 16px root: floor((200 − 40) / 32)
  // + 1 = six slots.
  it.each([
    // NaN left unguarded renders no avatars at all.
    ['does not parse', ''],
    // 0px taken at face value leaves no width per avatar: one avatar and `+6`.
    ['is 0', '0px'],
  ])(
    'falls back to a 16px root when the computed font size %s',
    async (_case, fontSize) => {
      setRootFontSize(20);
      const { fixture } = await setup();

      emitWidthWithView(
        200,
        viewWith(() => ({ fontSize })),
      );
      fixture.detectChanges();

      expect(rendered(fixture)).toEqual({ visible: 5, counter: '+2' });
    },
  );

  it('falls back to a 16px root when the document has no view', async () => {
    setRootFontSize(20);
    const { fixture } = await setup();

    emitWidthWithView(200, null);
    fixture.detectChanges();

    expect(rendered(fixture)).toEqual({ visible: 5, counter: '+2' });
  });
});
