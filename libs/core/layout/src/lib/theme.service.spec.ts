import * as cdkTheme from '@malva-ui/cdk/theme';
import * as layoutShim from './theme.service';

/**
 * `@malva-ui/core/layout` is a deprecation shim: `mlv-layout` is deleted and
 * everything the entry point still exports comes from `@malva-ui/cdk/theme`.
 *
 * The promise the migration makes is stronger than "the names still resolve" —
 * it is that they are the **same objects**, so an application part-way through
 * the move can import `MlvThemeService` from both paths and still inject one
 * service, and a `MLV_THEME` provided through the old path is read through the
 * new one. A re-export that were accidentally turned into a re-declaration
 * would satisfy the type checker and break exactly that.
 */
describe('@malva-ui/core/layout deprecation shim', () => {
  it('re-exports the theme entry point without adding or dropping anything', () => {
    expect(Object.keys(layoutShim).sort()).toEqual(
      Object.keys(cdkTheme).sort(),
    );
  });

  it('re-exports the same identities, not copies', () => {
    for (const key of Object.keys(cdkTheme) as (keyof typeof cdkTheme)[]) {
      expect(layoutShim[key]).toBe(cdkTheme[key]);
    }
  });

  it('exports no layout component or directive any more', () => {
    for (const removed of ['MlvLayout', 'MlvLayoutTop', 'MlvLayoutSide']) {
      expect(Object.keys(layoutShim)).not.toContain(removed);
    }
  });
});
