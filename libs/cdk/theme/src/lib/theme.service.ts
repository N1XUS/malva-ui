import type { EnvironmentProviders, Provider } from '@angular/core';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

/**
 * @private Reads a persisted value, preferring `localStorage` and falling back
 * to `sessionStorage` when it is blocked. Returns `null` on the server and in
 * every failure mode, so nothing here can throw during construction.
 */
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

/** @private Persists the selected mode, silently dropping it when blocked. */
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

/** A resolved theme: exactly what the `mlvTheme` document attribute carries. */
export type MlvTheme = 'light' | 'dark';

/** A theme *preference*, which may defer to the operating system. */
export type MlvThemeMode = MlvTheme | 'auto';

/** Narrows an unknown (typically persisted) value to a theme mode. */
export function isMlvThemeMode(value: unknown): value is MlvThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** The theme an application starts in before the user has chosen one. */
export const MLV_THEME = new InjectionToken<MlvThemeMode>('MLV_THEME');

/** The storage key the chosen theme is persisted under. */
export const MLV_THEME_KEY = new InjectionToken<string>('MLV_THEME_KEY');

/** Storage key used when the application provides none. */
export const defaultThemeKey = 'mlv-theme' as const;

/** Theme used when the application provides none. */
export const defaultTheme: MlvThemeMode = 'light' as const;

/**
 * Configures the theme and eagerly starts `MlvThemeService`.
 *
 * The eager start is not incidental. The service is what writes the `mlvTheme`
 * attribute on the document element, and `theme.scss` keys its dark token map
 * off that attribute — so an application that registers the providers and
 * never happens to inject the service would get no theme at all. Supplying the
 * configuration tokens without the initializer made bootstrapping look correct
 * while leaving the outcome dependent on whether some component happened to
 * ask for the service.
 *
 * The return type is `(Provider | EnvironmentProviders)[]` rather than
 * `Provider[]` because of that initializer. Spreading the result into a
 * `providers` array is unaffected; only code that annotated the result as
 * `Provider[]` needs the wider type.
 *
 * @param theme Theme the application starts in; `'auto'` follows the OS.
 * @param themeKey Storage key the user's choice is persisted under.
 */
export function provideDefaultTheme(
  theme: MlvThemeMode = defaultTheme,
  themeKey = defaultThemeKey,
): (Provider | EnvironmentProviders)[] {
  return [
    {
      provide: MLV_THEME,
      useValue: theme,
    },
    {
      provide: MLV_THEME_KEY,
      useValue: themeKey,
    },
    provideEnvironmentInitializer(() => {
      inject(MlvThemeService);
    }),
  ];
}

/**
 * Owns the application's theme: the persisted preference, the resolved
 * light/dark value, and the `mlvTheme` attribute on the document element that
 * every `--mlv-*` token map keys off.
 *
 * It is headless by design and lives in the CDK family for that reason — a
 * contract with no component, like the date adapter. It renders nothing, has
 * no host, and works in an application that mounts no Malva UI layout at all.
 */
@Injectable({
  providedIn: 'root',
})
export class MlvThemeService {
  /** @private Whether the service is running in a browser (vs. server-side rendering). */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * @private Lazily-resolved `prefers-color-scheme: dark` media query list.
   * `null` on the server where `window` is undefined.
   */
  private readonly _darkModeMedia: MediaQueryList | null = this._isBrowser
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /** @protected System dark-mode preference from the `prefers-color-scheme` media query. */
  protected readonly _prefersDark = signal(
    this._darkModeMedia?.matches ?? false,
  );

  /** The theme the application was configured to start in. */
  readonly defaultTheme = inject(MLV_THEME, { optional: true }) ?? defaultTheme;

  /** @private Storage key used to persist the selected theme. */
  private readonly _themeKey =
    inject(MLV_THEME_KEY, { optional: true }) ?? defaultThemeKey;

  /** @private Platform document, used to publish the theme on the root element. */
  private readonly _document = inject(DOCUMENT);

  /** The user's preference, which may be `'auto'`. */
  readonly themeMode = signal<MlvThemeMode>(this.defaultTheme);

  /** The resolved theme actually in force, never `'auto'`. */
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
    // content. Owning it here makes the switch work regardless of which
    // components happen to be on screen, and a scoped `mlvTheme` attribute
    // further down the tree still wins locally.
    if (this._isBrowser) {
      effect(() => {
        this._document.documentElement.setAttribute(
          'mlvTheme',
          this.currentTheme(),
        );
      });
    }
  }

  /** Selects a theme mode, persists it, and republishes the resolved theme. */
  setTheme(mode: MlvThemeMode): void {
    setToStorage(this._themeKey, mode);
    this.themeMode.set(mode);
    this._syncResolvedTheme();
  }

  /** @private Collapses `'auto'` onto the current system preference. */
  private _resolveTheme(mode: MlvThemeMode): MlvTheme {
    if (mode === 'auto') {
      return this._prefersDark() ? 'dark' : 'light';
    }
    return mode;
  }

  /** @private Recomputes {@link currentTheme} from {@link themeMode}. */
  private _syncResolvedTheme(): void {
    this.currentTheme.set(this._resolveTheme(this.themeMode()));
  }
}
