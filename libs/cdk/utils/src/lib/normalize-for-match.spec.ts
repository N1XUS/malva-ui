import { normalizeForMatch } from './normalize-for-match';

describe('normalizeForMatch', () => {
  it('lower-cases and strips diacritics', () => {
    expect(normalizeForMatch('Café')).toBe('cafe');
    expect(normalizeForMatch('ÅNGSTRÖM')).toBe('angstrom');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeForMatch('')).toBe('');
  });
});
