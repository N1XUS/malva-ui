import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { toOptionsResult } from './options-result';

describe('toOptionsResult', () => {
  it.each([
    ['an array', ['one', 'two']],
    ['a promise', Promise.resolve(['one', 'two'])],
    ['an observable', of(['one', 'two'])],
  ])('normalises %s', async (_label, source) => {
    await expect(firstValueFrom(toOptionsResult(source))).resolves.toEqual([
      'one',
      'two',
    ]);
  });
});
