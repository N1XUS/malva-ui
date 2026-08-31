import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from './input';
import { MlvInputNative } from './input-native';

@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input bare projectControl>
      <input mlvInputNative data-testid="projected" />
    </mlv-input>
  `,
})
class ProjectedHostComponent {
  readonly input = viewChild.required(MlvInput);
}

@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input bare>
      <input mlvInputNative data-testid="ignored" />
    </mlv-input>
  `,
})
class InternalHostComponent {
  readonly input = viewChild.required(MlvInput);
}

describe('MlvInputNative / projectControl', () => {
  function project(el: HTMLElement): HTMLInputElement | null {
    return el.querySelector<HTMLInputElement>('input[data-testid="projected"]');
  }

  let fixture: ComponentFixture<ProjectedHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the projected native input instead of an internal one', () => {
    const host = fixture.nativeElement as HTMLElement;
    const projected = project(host);
    expect(projected).toBeTruthy();
    // Only the projected input exists — no internally-rendered #native input.
    expect(host.querySelectorAll('input').length).toBe(1);
  });

  it('applies the mlv-input__native styling hook to the projected input', () => {
    const projected = project(fixture.nativeElement as HTMLElement);
    expect(projected?.classList.contains('mlv-input__native')).toBe(true);
  });

  it('resolves nativeElement / focus() to the projected input', () => {
    const projected = project(fixture.nativeElement as HTMLElement);
    const input = fixture.componentInstance.input();
    expect(input.nativeElement).toBe(projected);

    input.focus();
    expect(document.activeElement).toBe(projected);
  });

  it('renders its own internal input when projectControl is not set', async () => {
    const internalFixture = TestBed.createComponent(InternalHostComponent);
    internalFixture.detectChanges();
    await internalFixture.whenStable();

    const host = internalFixture.nativeElement as HTMLElement;
    // The mlvInputNative candidate is not projected; mlv-input renders its own.
    const projectedCandidate = host.querySelector(
      'input[data-testid="ignored"]',
    );
    expect(projectedCandidate).toBeNull();

    const internal = host.querySelector('input.mlv-input__native');
    expect(internal).toBeTruthy();
    expect(internalFixture.componentInstance.input().nativeElement).toBe(
      internal,
    );
  });
});
