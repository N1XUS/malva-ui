import { TestBed } from '@angular/core/testing';
import { MlvI18nResolverService } from './i18n-resolver.service';

describe('MlvI18nResolverService', () => {
  let resolver: MlvI18nResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    resolver = TestBed.inject(MlvI18nResolverService);
  });

  it('should return plain strings unchanged', () => {
    const i18n = { close: 'Close' };
    expect(resolver.resolve(i18n, 'close')).toBe('Close');
  });

  it('should resolve ICU with simple parameters', () => {
    const i18n = { range: '{start}\u2013{end} of {total}' };
    expect(
      resolver.resolve(i18n, 'range', { start: 1, end: 10, total: 50 }),
    ).toBe('1\u201310 of 50');
  });

  it('should resolve ICU plural (English)', () => {
    const i18n = { count: '{count, plural, one {# item} other {# items}}' };
    expect(resolver.resolve(i18n, 'count', { count: 1 })).toBe('1 item');
    expect(resolver.resolve(i18n, 'count', { count: 5 })).toBe('5 items');
  });

  it('should cache compiled templates', () => {
    const i18n = { msg: '{n} things' };
    resolver.resolve(i18n, 'msg', { n: 1 });
    resolver.resolve(i18n, 'msg', { n: 2 });
    expect(resolver.resolve(i18n, 'msg', { n: 3 })).toBe('3 things');
  });

  it('should return template unchanged when no params provided', () => {
    const i18n = { msg: 'Hello {name}' };
    expect(resolver.resolve(i18n, 'msg')).toBe('Hello {name}');
  });
});
