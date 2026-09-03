import {
  computed,
  createEnvironmentInjector,
  EnvironmentInjector,
} from '@angular/core';
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

  describe('slice memoization', () => {
    it('returns the identical signal for repeated selects of one key', () => {
      service.setLanguage(mockLanguage);
      const sameInstance = service.select('alert') === service.select('alert');
      expect(sameInstance).toBe(true);
    });

    it('returns a distinct signal per key', () => {
      service.setLanguage(mockLanguage);
      const sameInstance =
        (service.select('alert') as unknown) ===
        (service.select('dialog') as unknown);
      expect(sameInstance).toBe(false);
    });

    it('throws on a read before any pack loads, then yields the value once one arrives', () => {
      const alert = service.select('alert');

      expect(() => alert()).toThrowError(/no language pack loaded/);

      service.setLanguage(mockLanguage);
      expect(alert().dismiss).toBe('Dismiss alert');

      // The same memoized node must still be the one handed out afterwards.
      const sameInstance = service.select('alert') === alert;
      expect(sameInstance).toBe(true);
    });

    it('does not latch the pre-load error in a downstream computed', () => {
      const alert = service.select('alert');
      const derived = computed(() => alert().dismiss);

      expect(() => derived()).toThrowError(/no language pack loaded/);

      service.setLanguage(mockLanguage);
      expect(derived()).toBe('Dismiss alert');
    });

    it('propagates a later switch to a slice taken before the first pack', async () => {
      const alert = service.select('alert');

      service.setLanguage(mockLanguage);
      expect(alert().dismiss).toBe('Dismiss alert');

      await service.switchLanguage(async () => ({ default: mockLanguage2 }));
      expect(alert().dismiss).toBe('Verwerfen');
    });

    it('keeps caches separate across service instances', () => {
      const parent = TestBed.inject(EnvironmentInjector);
      const injectorA = createEnvironmentInjector([MlvI18nService], parent);
      const injectorB = createEnvironmentInjector([MlvI18nService], parent);

      try {
        const serviceA = injectorA.get(MlvI18nService);
        const serviceB = injectorB.get(MlvI18nService);
        expect(serviceA === serviceB).toBe(false);

        const sharedNode =
          serviceA.select('alert') === serviceB.select('alert');
        expect(sharedNode).toBe(false);

        serviceA.setLanguage(mockLanguage);
        serviceB.setLanguage(mockLanguage2);
        expect(serviceA.select('alert')().dismiss).toBe('Dismiss alert');
        expect(serviceB.select('alert')().dismiss).toBe('Verwerfen');
      } finally {
        injectorA.destroy();
        injectorB.destroy();
      }
    });
  });
});
