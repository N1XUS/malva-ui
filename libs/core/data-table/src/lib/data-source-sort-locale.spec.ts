import { MlvArrayDataSource } from '@malva-ui/cdk/data-source';
import enLanguage from '@malva-ui/i18n/en';
import trLanguage from '@malva-ui/i18n/tr';
import { MlvI18nService } from '@malva-ui/i18n';

/**
 * `MlvArrayDataSource`'s sort comparator resolves its collator from the **host**
 * locale (`new Intl.Collator(undefined, …)`), once, at module load. This suite
 * pins the consequence: switching the app language at runtime must not move a
 * single row.
 *
 * It lives here rather than next to the data source because
 * `@nx/enforce-module-boundaries` restricts `family:cdk` to `family:cdk`, so
 * `libs/cdk/data-source` may not import `@malva-ui/i18n` even from a spec.
 * `@malva-ui/core/data-table` is the consumer that owns both — it re-exports
 * the data source and translates its own chrome — so the guard belongs here.
 */

/**
 * Turkish collates dotless `ı` before `i`; Western locales collate it after.
 * These three words therefore order differently under `tr` than under any
 * plausible host default, which is what makes the assertions below non-vacuous.
 */
const words = ['iz', 'ıs', 'isı'];

const orderUnder = (locale: string | undefined): string[] =>
  [...words].sort(new Intl.Collator(locale, { numeric: true }).compare);

const sortedLabels = (): string[] => {
  const source = new MlvArrayDataSource(words.map((label) => ({ label })));
  source.setPerPage(Infinity);
  source.setSort({ key: 'label', direction: 'asc' });
  return source
    .connect()()
    .map((row) => row.label);
};

describe('MlvArrayDataSource sorting vs the app language', () => {
  it('collates identically before and after MlvI18nService.switchLanguage()', async () => {
    const hostOrder = orderUnder(undefined);
    const turkishOrder = orderUnder('tr');

    // Pre-condition. If the host default ever *is* Turkish this guard would
    // pass vacuously, so fail loudly instead of quietly proving nothing.
    expect(hostOrder).not.toEqual(turkishOrder);

    const i18n = new MlvI18nService();
    i18n.setLanguage(enLanguage);
    expect(sortedLabels()).toEqual(hostOrder);

    await i18n.switchLanguage(async () => ({ default: trLanguage }));

    // The switch really landed — the active pack is Turkish, not English.
    expect(i18n.select('dataTable')()).toEqual(trLanguage.dataTable);
    expect(i18n.select('dataTable')()).not.toEqual(enLanguage.dataTable);

    // …and the rows did not move. A collator bound to the app language would
    // have produced `turkishOrder` here.
    expect(sortedLabels()).toEqual(hostOrder);
    expect(sortedLabels()).not.toEqual(turkishOrder);
  });

  it('collates identically for a source that outlives the language switch', async () => {
    const hostOrder = orderUnder(undefined);
    const turkishOrder = orderUnder('tr');
    expect(hostOrder).not.toEqual(turkishOrder);

    const source = new MlvArrayDataSource(words.map((label) => ({ label })));
    source.setPerPage(Infinity);
    source.setSort({ key: 'label', direction: 'asc' });
    expect(
      source
        .connect()()
        .map((row) => row.label),
    ).toEqual(hostOrder);

    const i18n = new MlvI18nService();
    i18n.setLanguage(enLanguage);
    await i18n.switchLanguage(async () => ({ default: trLanguage }));
    expect(i18n.select('dataTable')()).toEqual(trLanguage.dataTable);

    // Re-sorting the *same* source after the switch invalidates the computed
    // and re-runs the comparator, so this is not just a cached result.
    source.setSort({ key: 'label', direction: 'desc' });
    expect(
      source
        .connect()()
        .map((row) => row.label),
    ).toEqual([...hostOrder].reverse());
    source.setSort({ key: 'label', direction: 'asc' });
    expect(
      source
        .connect()()
        .map((row) => row.label),
    ).toEqual(hostOrder);
  });
});
