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

## License

MIT
