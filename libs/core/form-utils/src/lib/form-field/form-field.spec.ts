import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvFormField } from './form-field';

@Component({
  imports: [MlvFormField, ReactiveFormsModule],
  template: `
    <mlv-form-field displayStrategy="immediate">
      <input [formControl]="ctrl" />
    </mlv-form-field>
  `,
})
class HostComponent {
  /** A validator whose key is deliberately outside the built-in message map. */
  readonly ctrl = new FormControl('', () => ({ ibanChecksum: true }));
}

describe('MlvFormField — unmapped validator keys', () => {
  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the neutral translated message and warns once naming the unmapped key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const host = await render();

    const message = host.querySelector('mlv-message') as HTMLElement;
    expect(message.textContent?.trim()).toBe('This value is invalid');
    expect(host.textContent).not.toContain('ibanChecksum');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ibanChecksum');

    // A second field hitting the same key must stay silent.
    const second = TestBed.createComponent(HostComponent);
    second.detectChanges();
    await second.whenStable();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});
