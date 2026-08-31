import { TestBed } from '@angular/core/testing';
import { MlvTranslatePipe } from './translate.pipe';

describe('MlvTranslatePipe', () => {
  let pipe: MlvTranslatePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new MlvTranslatePipe());
  });

  it('should pass through plain strings', () => {
    expect(pipe.transform('Hello')).toBe('Hello');
  });

  it('should resolve ICU with params', () => {
    expect(pipe.transform('{count} items', { count: 5 })).toBe('5 items');
  });

  it('should resolve plural forms', () => {
    const template = '{count, plural, one {# item} other {# items}}';
    expect(pipe.transform(template, { count: 1 })).toBe('1 item');
    expect(pipe.transform(template, { count: 42 })).toBe('42 items');
  });

  it('should return string unchanged if no params', () => {
    expect(pipe.transform('No params here')).toBe('No params here');
  });
});
