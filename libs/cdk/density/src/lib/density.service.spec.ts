import { TestBed } from '@angular/core/testing';
import { MlvDensityService } from './density.service';
import { MLV_DEFAULT_DENSITY } from './density.types';

describe('MlvDensityService', () => {
  describe('default density', () => {
    it('is "comfortable" when no token is provided', () => {
      TestBed.configureTestingModule({});
      const service = TestBed.inject(MlvDensityService);
      expect(service.density()).toBe('comfortable');
    });

    it('uses the MLV_DEFAULT_DENSITY token when provided', () => {
      TestBed.configureTestingModule({
        providers: [{ provide: MLV_DEFAULT_DENSITY, useValue: 'compact' }],
      });
      const service = TestBed.inject(MlvDensityService);
      expect(service.density()).toBe('compact');
    });

    it('starts as "spacious" when provided via token', () => {
      TestBed.configureTestingModule({
        providers: [{ provide: MLV_DEFAULT_DENSITY, useValue: 'spacious' }],
      });
      const service = TestBed.inject(MlvDensityService);
      expect(service.density()).toBe('spacious');
    });
  });

  describe('setDensity()', () => {
    beforeEach(() => TestBed.configureTestingModule({}));

    it('updates the density signal to compact', () => {
      const service = TestBed.inject(MlvDensityService);
      service.setDensity('compact');
      expect(service.density()).toBe('compact');
    });

    it('updates the density signal to spacious', () => {
      const service = TestBed.inject(MlvDensityService);
      service.setDensity('spacious');
      expect(service.density()).toBe('spacious');
    });

    it('can cycle through all density levels', () => {
      const service = TestBed.inject(MlvDensityService);
      expect(service.density()).toBe('comfortable');
      service.setDensity('compact');
      expect(service.density()).toBe('compact');
      service.setDensity('spacious');
      expect(service.density()).toBe('spacious');
      service.setDensity('comfortable');
      expect(service.density()).toBe('comfortable');
    });
  });
});
