import type { Provider } from '@angular/core';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

function getFromStorage(key: string): unknown {
  if (
    typeof localStorage === 'undefined' &&
    typeof sessionStorage === 'undefined'
  ) {
    return null;
  }
  let value: string | null;
  try {
    value = localStorage.getItem(key);
  } catch {
    try {
      value = sessionStorage.getItem(key);
    } catch {
      value = null;
    }
  }

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    // Legacy or hand-edited storage value (e.g. a bare `dark` string instead
    // of the JSON-encoded `"dark"`). Accept it as-is so a malformed/legacy
    // entry degrades gracefully instead of throwing during construction —
    // `isMlvThemeMode` still validates it before use.
    return value;
  }
}

function setToStorage(key: string, value: string): void {
  if (
    typeof localStorage === 'undefined' &&
    typeof sessionStorage === 'undefined'
  ) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // SSR or fully blocked storage — drop silently.
    }
  }
}

export type MlvTheme = 'light' | 'dark';
export type MlvThemeMode = MlvTheme | 'auto';

export function isMlvThemeMode(value: unknown): value is MlvThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export const MLV_THEME = new InjectionToken<MlvThemeMode>('MLV_THEME');
export const MLV_THEME_KEY = new InjectionToken<string>('MLV_THEME_KEY');

export const defaultThemeKey = 'mlv-theme' as const;
export const defaultTheme: MlvThemeMode = 'light' as const;

export function provideDefaultTheme(
  theme: MlvThemeMode = defaultTheme,
  themeKey = defaultThemeKey,
): Provider[] {
  return [
    {
      provide: MLV_THEME,
      useValue: theme,
    },
    {
      provide: MLV_THEME_KEY,
      useValue: themeKey,
    },
  ];
}

@Injectable({
  providedIn: 'root',
})
export class MlvThemeService {
  /** @private Whether the service is running in a browser (vs. server-side rendering). */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Lazily-resolved `prefers-color-scheme: dark` media query list. `null` on
   * the server where `window` is undefined.
   */
  private readonly _darkModeMedia: MediaQueryList | null = this._isBrowser
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /** @protected System dark-mode preference from the `prefers-color-scheme` media query. */
  protected readonly _prefersDark = signal(
    this._darkModeMedia?.matches ?? false,
  );

  readonly defaultTheme = inject(MLV_THEME, { optional: true }) ?? defaultTheme;
  /** @private Storage key used to persist the selected theme. */
  private readonly _themeKey =
    inject(MLV_THEME_KEY, { optional: true }) ?? defaultThemeKey;

  /** @private Platform document, used to publish the theme on the root element. */
  private readonly _document = inject(DOCUMENT);

  readonly themeMode = signal<MlvThemeMode>(this.defaultTheme);
  readonly currentTheme = signal<MlvTheme>(
    this._resolveTheme(this.defaultTheme),
  );

  constructor() {
    const savedTheme = getFromStorage(this._themeKey);
    if (isMlvThemeMode(savedTheme)) {
      this.themeMode.set(savedTheme);
      this._syncResolvedTheme();
    }

    if (this._darkModeMedia) {
      fromEvent(this._darkModeMedia, 'change')
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe(() => {
          this._prefersDark.set(this._darkModeMedia?.matches ?? false);
          if (this.themeMode() === 'auto') {
            this._syncResolvedTheme();
          }
        });
    }

    // Publish the resolved theme on the document element. `theme.scss` keys its
    // dark token map off a plain `[mlvTheme='dark']` attribute selector, so
    // nothing changes colour until that attribute exists somewhere above the
    // content. This used to be a side effect of rendering `mlv-layout`, which
    // meant any application — or any single route — that renders no layout got
    // a theme switcher that flipped a signal nobody read. Owning it here makes
    // the switch work regardless of which components happen to be on screen;
    // `mlv-layout` still carries its own `[attr.mlvTheme]` host binding, and a
    // scoped `mlvTheme` attribute further down the tree still wins locally.
    if (this._isBrowser) {
      effect(() => {
        this._document.documentElement.setAttribute(
          'mlvTheme',
          this.currentTheme(),
        );
      });
    }
  }

  setTheme(mode: MlvThemeMode): void {
    setToStorage(this._themeKey, mode);
    this.themeMode.set(mode);
    this._syncResolvedTheme();
  }

  private _resolveTheme(mode: MlvThemeMode): MlvTheme {
    if (mode === 'auto') {
      return this._prefersDark() ? 'dark' : 'light';
    }
    return mode;
  }

  private _syncResolvedTheme(): void {
    this.currentTheme.set(this._resolveTheme(this.themeMode()));
  }
}
