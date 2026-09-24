import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Canonical key names accepted by the `keys` input.
 * These map to human-readable labels and OS-specific symbols.
 */
export type MlvKbdKey =
  | 'cmd'
  | 'command'
  | 'ctrl'
  | 'control'
  | 'shift'
  | 'alt'
  | 'option'
  | 'meta'
  | 'enter'
  | 'return'
  | 'backspace'
  | 'delete'
  | 'escape'
  | 'esc'
  | 'tab'
  | 'space'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'home'
  | 'end'
  | 'pageup'
  | 'pagedown'
  | (string & {});

/** Resolved label/symbol for a single key. */
export interface MlvResolvedKey {
  /** Display label rendered inside the `<kbd>` element. */
  label: string;
  /** Original key name; resolves the name assistive technology speaks. */
  key: string;
}

/** Returns `true` when running in a macOS browser. */
function isMacPlatform(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) return false;
  return (
    /mac/i.test(navigator.platform ?? '') || /mac/i.test(navigator.userAgent)
  );
}

const MAC_LABELS: Record<string, string> = {
  cmd: '⌘',
  command: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  control: '⌃',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  enter: '↵',
  return: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

const WIN_LABELS: Record<string, string> = {
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  enter: 'Enter',
  return: 'Enter',
  backspace: 'Backspace',
  delete: 'Del',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

/**
 * Whether `key` is one of the table's own entries. A plain index would also
 * find `Object.prototype` members, so `'constructor'` rendered
 * `function Object() { [native code] }`. `Object.hasOwn` is ES2022 and the
 * workspace compiles against the ES2020 lib, hence the `call` form.
 */
function hasOwnKey(map: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

/**
 * Resolves a raw key string to a display label for the given OS. Only the
 * table's own keys count (see `hasOwnKey`).
 */
function resolveKeyLabel(key: string, isMac: boolean): string {
  const normalized = key.toLowerCase();
  const map = isMac ? MAC_LABELS : WIN_LABELS;
  return hasOwnKey(map, normalized) ? map[normalized] : key.toUpperCase();
}

/** Spoken names of the arrow and paging keys, the same on every OS. */
const NAVIGATION_SPOKEN: Record<string, string> = {
  up: 'Up Arrow',
  down: 'Down Arrow',
  left: 'Left Arrow',
  right: 'Right Arrow',
  pageup: 'Page Up',
  pagedown: 'Page Down',
};

/**
 * Spoken names for the macOS key caps. Each glyph gets the name the key
 * carries on a Mac keyboard: `⌫` is "Delete", `⌦` "Forward Delete" and `↵`
 * "Return".
 */
const MAC_SPOKEN: Record<string, string> = {
  cmd: 'Command',
  command: 'Command',
  meta: 'Command',
  ctrl: 'Control',
  control: 'Control',
  shift: 'Shift',
  alt: 'Option',
  option: 'Option',
  enter: 'Return',
  return: 'Return',
  backspace: 'Delete',
  delete: 'Forward Delete',
  escape: 'Escape',
  esc: 'Escape',
  tab: 'Tab',
  space: 'Space',
  ...NAVIGATION_SPOKEN,
};

/**
 * Spoken names for the Windows / Linux key caps that are abbreviated or drawn
 * as a glyph. A key missing here is spoken as its label (`Shift`, `Enter`).
 */
const WIN_SPOKEN: Record<string, string> = {
  cmd: 'Control',
  command: 'Control',
  ctrl: 'Control',
  control: 'Control',
  meta: 'Windows',
  delete: 'Delete',
  escape: 'Escape',
  esc: 'Escape',
  ...NAVIGATION_SPOKEN,
};

/**
 * Resolves a raw key string to the name a screen reader should speak for it
 * on the given OS. Falls back to the display label, so a key outside the
 * tables (`'k'`, `'f5'`) is spoken exactly as it is shown. Own keys only (see
 * `hasOwnKey`).
 */
function resolveSpokenName(key: string, label: string, isMac: boolean): string {
  const normalized = key.toLowerCase();
  const map = isMac ? MAC_SPOKEN : WIN_SPOKEN;
  return hasOwnKey(map, normalized) ? map[normalized] : label;
}

/**
 * Keyboard shortcut display component. Renders an array of key names
 * as styled `<kbd>` elements separated by a configurable separator.
 *
 * OS detection swaps modifier labels: Mac shows `⌘`, `⌃`, `⇧`, `⌥`;
 * Windows/Linux shows `Ctrl`, `Shift`, `Alt`, etc.
 *
 * Assistive technology reads the shortcut once, spelled with key names
 * ("Command + K", "Control + K"), from a visually hidden text node; the key
 * caps and separators are `aria-hidden`. The host carries no role and no
 * `aria-label` — ARIA 1.2 prohibits naming a generic element.
 *
 * @example
 * ```html
 * <!-- Renders ⌘ + K on Mac, Ctrl + K on Windows -->
 * <mlv-kbd [keys]="['cmd', 'k']" />
 *
 * <!-- Custom separator -->
 * <mlv-kbd [keys]="['ctrl', 'shift', 'p']" separator=" " />
 * ```
 */
@Component({
  selector: 'mlv-kbd',
  templateUrl: './kbd.html',
  styleUrl: './kbd.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class: 'mlv-kbd',
  },
})
export class MlvKbd {
  /**
   * The ordered list of key names to display.
   * Accepts canonical names (`'cmd'`, `'shift'`, `'enter'`, etc.) or any
   * plain string which will be uppercased as a fallback label.
   *
   * @example `['cmd', 'k']` → `⌘ + K` (Mac) / `Ctrl + K` (Win)
   */
  readonly keys = input.required<MlvKbdKey[]>();

  /**
   * The string rendered between each key element.
   * Defaults to `'+'`.
   */
  readonly separator = input<string>('+');

  /** @private Resolved OS flag — true on macOS browsers. */
  private readonly _isMac = isMacPlatform(inject(PLATFORM_ID));

  /** @protected Resolved key labels for the template. */
  protected readonly _resolvedKeys = computed<MlvResolvedKey[]>(() =>
    this.keys().map((k) => ({
      key: k,
      label: resolveKeyLabel(k, this._isMac),
    })),
  );

  /**
   * @protected The shortcut as a screen reader should speak it: each key's
   * spoken name, joined by the separator (`'Command + K'`). Rendered once in a
   * visually hidden node beside the `aria-hidden` key caps, instead of as a
   * host `aria-label`, which ARIA 1.2 prohibits on a role-less element and
   * which would only have repeated the glyphs.
   */
  protected readonly _spokenText = computed(() =>
    this._resolvedKeys()
      .map((rk) => resolveSpokenName(rk.key, rk.label, this._isMac))
      .join(' ' + this.separator() + ' '),
  );
}
