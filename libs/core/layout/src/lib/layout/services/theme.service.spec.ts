import { ApplicationRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvThemeService, provideDefaultTheme } from './theme.service';

function installColorScheme(initialDark: boolean): {
  setDark: (dark: boolean) => void;
} {
  let matches = initialDark;
  const listeners = new Set<EventListener>();
  const media = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListener) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: EventListener) =>
      listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => media),
  });

  return {
    setDark(dark: boolean): void {
      matches = dark;
      const event = new Event('change');
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe('MlvThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('publishes the resolved theme on the document element', async () => {
    installColorScheme(false);
    TestBed.configureTestingModule({
      providers: [provideDefaultTheme('light')],
    });
    const service = TestBed.inject(MlvThemeService);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(document.documentElement.getAttribute('mlvTheme')).toBe('light');

    service.setTheme('dark');
    await TestBed.inject(ApplicationRef).whenStable();
    expect(document.documentElement.getAttribute('mlvTheme')).toBe('dark');
  });

  it('does not touch documentElement on the server', async () => {
    document.documentElement.removeAttribute('mlvTheme');
    const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
    TestBed.configureTestingModule({
      providers: [
        provideDefaultTheme('dark'),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    TestBed.inject(MlvThemeService);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(setAttribute).not.toHaveBeenCalledWith('mlvTheme', 'dark');
    setAttribute.mockRestore();
  });

  it('keeps the default manual mode resolved', () => {
    installColorScheme(true);
    TestBed.configureTestingModule({
      providers: [provideDefaultTheme('light')],
    });
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('light');
    expect(service.currentTheme()).toBe('light');
  });

  it('restores Auto and follows live system changes', () => {
    localStorage.setItem('mlv-theme', JSON.stringify('auto'));
    const media = installColorScheme(true);
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('auto');
    expect(service.currentTheme()).toBe('dark');

    media.setDark(false);
    expect(service.currentTheme()).toBe('light');
  });

  it('ignores system changes in manual mode and persists the mode', () => {
    const media = installColorScheme(false);
    const service = TestBed.inject(MlvThemeService);
    service.setTheme('dark');
    media.setDark(false);
    expect(service.currentTheme()).toBe('dark');
    expect(localStorage.getItem('mlv-theme')).toBe(JSON.stringify('dark'));
  });

  it('ignores an invalid persisted mode', () => {
    localStorage.setItem('mlv-theme', JSON.stringify('sepia'));
    installColorScheme(false);
    TestBed.configureTestingModule({
      providers: [provideDefaultTheme('dark')],
    });
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('dark');
    expect(service.currentTheme()).toBe('dark');
  });

  it('does not throw and falls back to default for a corrupt (non-JSON) persisted value', () => {
    localStorage.setItem('mlv-theme', '{not valid json');
    installColorScheme(false);
    expect(() =>
      TestBed.configureTestingModule({
        providers: [provideDefaultTheme('light')],
      }),
    ).not.toThrow();
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('light');
    expect(service.currentTheme()).toBe('light');
  });

  it('accepts a legacy plain-string (non-JSON-encoded) persisted value', () => {
    localStorage.setItem('mlv-theme', 'dark');
    installColorScheme(false);
    TestBed.configureTestingModule({
      providers: [provideDefaultTheme('light')],
    });
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('dark');
    expect(service.currentTheme()).toBe('dark');
  });

  it('ignores a corrupt plain-string persisted value that is not a valid theme mode', () => {
    localStorage.setItem('mlv-theme', 'sepia');
    installColorScheme(false);
    TestBed.configureTestingModule({
      providers: [provideDefaultTheme('light')],
    });
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('light');
    expect(service.currentTheme()).toBe('light');
  });

  it('resolves Auto to light on the server without reading matchMedia', () => {
    const matchMedia = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });
    TestBed.configureTestingModule({
      providers: [
        provideDefaultTheme('auto'),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const service = TestBed.inject(MlvThemeService);
    expect(service.themeMode()).toBe('auto');
    expect(service.currentTheme()).toBe('light');
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
