# @malva-ui/i18n

Localisation for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — signal-based, per-component, with ICU MessageFormat and lazy-loaded language packs.

Every string a Malva UI component renders (pagination labels, dialog close buttons, empty-state copy, date-picker month names) comes from here. Nothing is hardcoded in the components.

## Install

```bash
npm install @malva-ui/i18n
```

Installed automatically by `ng add @malva-ui/core`.

## Quick start

Register one lazy-loaded language pack in your root providers:

```ts
import { provideMlvI18n } from '@malva-ui/i18n';

export const appConfig: ApplicationConfig = {
  providers: [provideMlvI18n(() => import('@malva-ui/i18n/en'))],
};
```

The pack is fetched during app initialisation, so it is a separate chunk — you ship one locale, not fourteen.

The loader may resolve to either shape of `MlvLanguageModule`: a module whose
`default` export is the pack, or one that exposes it under a `<locale>Language`
name — which is what the published locale entry points carry, since the package
build flattens each one to a single named export. Importing a locale entry point
directly, as above, therefore works unchanged; a pack you write yourself uses
`export default`.

```ts
import { provideMlvI18n, type MlvLanguageModule } from '@malva-ui/i18n';

// Both are accepted.
provideMlvI18n(() => import('@malva-ui/i18n/en')); // export const enLanguage
provideMlvI18n(() => import('./my-own-pack')); // export default myPack

// `MlvLanguageModule` types a loader you hold yourself.
const loader: () => Promise<MlvLanguageModule> = () => import('@malva-ui/i18n/uk');
```

`MlvI18nService.switchLanguage()` takes the same two shapes, so runtime locale
switching needs no wrapper either.

**One module, one pack.** `default` wins whenever it is there, and is used
as-is. Without one, the module must expose exactly one `<locale>Language` — the
loader throws rather than guessing:

```ts
// Fine — `default` is returned as-is, whatever your pack's keys are called.
provideMlvI18n(async () => ({ default: myPack }));

// Throws: two `<locale>Language` exports, and which one wins would be the order
// your barrel happens to declare them in.
provideMlvI18n(() => import('./locales')); // export * from '…/en'; export * from '…/de';
```

Re-export a single locale, or pick one explicitly —
`import('@malva-ui/i18n/en').then((pack) => ({ default: pack.enLanguage }))`.

## Available locales

`de` · `en` · `es` · `fr` · `id` · `it` · `ja` · `nl` · `pl` · `pt` · `ro` · `tr` · `uk` · `zh-Hans`

```ts
provideMlvI18n(() => import('@malva-ui/i18n/uk'));
```

## Translating your own strings

`MlvTranslatePipe` and `MlvI18nService` read the same message store, so application copy can share the component locale:

```ts
import { MlvTranslatePipe } from '@malva-ui/i18n';

@Component({ imports: [MlvTranslatePipe] })
export class MyComponent {}
```

Messages are ICU MessageFormat, so plurals and selects work as expected:

```
{count, plural, =0 {No results} one {# result} other {# results}}
```

## Testing

`@malva-ui/i18n/testing` provides helpers for unit tests that render Malva UI components without booting a real language pack.

## Peer dependencies

`@angular/core`, `intl-messageformat` (>=10).

## Related packages

- [`@malva-ui/core`](https://www.npmjs.com/package/@malva-ui/core) — the component library
- [`@malva-ui/cdk`](https://www.npmjs.com/package/@malva-ui/cdk) — headless primitives
- [`@malva-ui/editor`](https://www.npmjs.com/package/@malva-ui/editor) — rich-text editor

## Versioning and support

Semver contract, what counts as public API, the deprecation window and the
support window per major:
[VERSIONING.md](https://github.com/N1XUS/malva-ui/blob/main/VERSIONING.md)
(the repository is private while the library is pre-1.0, so the link needs
repository access — ask us for the policy if it 404s for you).

## License

MIT
