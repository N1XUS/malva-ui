# Rule: Angular Pipe

Applies to every `@Pipe` created or modified in this codebase.

---

## Required Decorator Settings

```ts
@Pipe({
  name: 'mlvMyPipe',   // camelCase, mlv prefix for lib pipes
  pure: true,           // default — only change to false when absolutely necessary
  // DO NOT set standalone: true — it is the default in Angular v20+
})
export class MyPipe implements PipeTransform { ... }
```

- Never set `standalone: true` — it is the default in Angular v20+.
- `pure: true` is the default and should be kept unless the pipe depends on mutable state that Angular's change detection cannot track (very rare).
- `pure: false` causes the pipe to run on every change detection cycle — use only when necessary and document the reason.

---

## Naming Convention

| Pipe type    | `name` field      | Class name       |
| ------------ | ----------------- | ---------------- |
| Library pipe | `'mlvFormatDate'` | `FormatDatePipe` |
| App pipe     | `'appTruncate'`   | `TruncatePipe`   |

Use camelCase for the `name`. The class name should end in `Pipe` and use PascalCase.

---

## Dependency Injection

Use `inject()` in the class body. Never use constructor parameter injection.

```ts
@Pipe({ name: 'mlvRelativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date): string {
    // ...
  }
}
```

If the pipe depends on a service that changes over time (e.g., locale, theme), the pipe may need `pure: false`. Document this clearly.

---

## `transform` Method Typing

Always use explicit, strict types for `transform`. Avoid `any`.

```ts
// Good — strongly typed
transform(value: Date | null, format?: string): string {
  if (!value) return '';
  return formatDate(value, format ?? 'yyyy-MM-dd', this.locale);
}

// Good — generics for utility pipes
transform<T>(value: T[], predicate: (item: T) => boolean): T[] {
  return value.filter(predicate);
}

// Bad — avoid
transform(value: any): any { ... }
```

Return `null` or `''` for nullable/undefined inputs rather than throwing.

---

## Pure Pipes (default)

A pure pipe is only re-evaluated when the input reference changes. Rely on this — do not perform expensive work that should be memoized elsewhere.

```ts
@Pipe({ name: 'mlvHighlight' })
export class HighlightPipe implements PipeTransform {
  transform(text: string, query: string): string {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
```

---

## Impure Pipes (use sparingly)

Only use `pure: false` when the pipe reads from a mutable store that signals cannot capture:

```ts
/**
 * Translates a key using the current locale.
 * Pure: false because translations can change at runtime when the locale changes.
 */
@Pipe({ name: 'mlvTranslate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18N_SERVICE_TOKEN);

  transform(key: string): string {
    return this.i18n.translate(key);
  }
}
```

---

## Using Pipes in Components

Import the pipe class directly in the consuming component's `imports` array:

```ts
@Component({
  imports: [FormatDatePipe, HighlightPipe],
  template: `
    <span>{{ item.createdAt | mlvFormatDate:'dd MMM yyyy' }}</span>
    <span [innerHTML]="item.title | mlvHighlight:searchQuery()"></span>
  `,
})
```

---

## JSDoc Requirements

```ts
/**
 * Formats a Date value using Angular's DatePipe under the hood,
 * with Malva UI's default locale from LOCALE_ID.
 *
 * @param value - The Date to format. Returns '' for null/undefined.
 * @param format - Optional date format string (default: 'yyyy-MM-dd').
 */
@Pipe({ name: 'mlvFormatDate' })
export class FormatDatePipe implements PipeTransform {
  transform(value: Date | null | undefined, format?: string): string { ... }
}
```

---

## Barrel Export

Always re-export pipes from the library `index.ts` using barrel-star syntax:

```ts
// libs/my-lib/src/index.ts
export * from './lib/format-date.pipe';
```

Never use named re-exports: `export { FormatDatePipe } from '...'` is **not allowed**.

---

## Complete Minimal Example

```ts
import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';

/**
 * Formats a Date into a localised string.
 * Returns an empty string for null/undefined input.
 *
 * @example
 * {{ item.date | mlvFormatDate }}           // '2025-03-26'
 * {{ item.date | mlvFormatDate:'dd/MM/yy' }} // '26/03/25'
 */
@Pipe({ name: 'mlvFormatDate' })
export class FormatDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date | string | null | undefined, format = 'yyyy-MM-dd'): string {
    if (!value) return '';
    return formatDate(value, format, this.locale);
  }
}
```
