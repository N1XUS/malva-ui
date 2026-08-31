import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { MlvLayout } from './layout';
import { MlvThemeService } from './services/theme.service';

describe('Layout', () => {
  let component: MlvLayout;
  let fixture: ComponentFixture<MlvLayout>;

  beforeEach(async () => {
    // MlvThemeService calls window.matchMedia at field-init level; mock it for jsdom.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });

    await TestBed.configureTestingModule({
      imports: [MlvLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reflects the resolved theme on its own host element', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.getAttribute('mlvTheme')).toBe(
      TestBed.inject(MlvThemeService).currentTheme(),
    );
  });

  it('should not access documentElement when rendered on the server', async () => {
    TestBed.resetTestingModule();
    const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
    await TestBed.configureTestingModule({
      imports: [MlvLayout],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(MlvLayout);
    serverFixture.detectChanges();
    await serverFixture.whenStable();

    expect(setAttribute).not.toHaveBeenCalled();
  });
});
