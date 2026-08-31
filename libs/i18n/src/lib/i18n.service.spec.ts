import { TestBed } from '@angular/core/testing';
import { MlvI18nService } from './i18n.service';
import type { MlvLanguage } from './types';

const mockLanguage = {
  alert: { dismiss: 'Dismiss alert' },
  dialog: { closeDialog: 'Close dialog' },
} as MlvLanguage;

const mockLanguage2 = {
  alert: { dismiss: 'Verwerfen' },
  dialog: { closeDialog: 'Dialog schliessen' },
} as MlvLanguage;

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('MlvI18nService', () => {
  let service: MlvI18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MlvI18nService] });
    service = TestBed.inject(MlvI18nService);
  });

  it('should set language', () => {
    service.setLanguage(mockLanguage);
    const alert = service.select('alert');
    expect(alert().dismiss).toBe('Dismiss alert');
  });

  it('should select a component slice', () => {
    service.setLanguage(mockLanguage);
    const dialog = service.select('dialog');
    expect(dialog().closeDialog).toBe('Close dialog');
  });

  it('should switch language reactively', async () => {
    service.setLanguage(mockLanguage);
    const alert = service.select('alert');
    expect(alert().dismiss).toBe('Dismiss alert');

    await service.switchLanguage(async () => ({ default: mockLanguage2 }));
    expect(alert().dismiss).toBe('Verwerfen');
  });

  it('keeps the newest language when requests resolve out of order', async () => {
    service.setLanguage(mockLanguage);
    const first = deferred<{ default: MlvLanguage }>();
    const second = deferred<{ default: MlvLanguage }>();

    const firstSwitch = service.switchLanguage(() => first.promise);
    const secondSwitch = service.switchLanguage(() => second.promise);

    second.resolve({ default: mockLanguage2 });
    await secondSwitch;
    first.resolve({ default: mockLanguage });
    await firstSwitch;

    expect(service.select('alert')().dismiss).toBe('Verwerfen');
  });
});
