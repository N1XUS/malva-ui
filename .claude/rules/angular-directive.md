# Rule: Angular Directive

Applies to every `@Directive` created or modified in this codebase.

---

## Required Decorator Settings

```ts
@Directive({
  selector: '[mlvMyDirective]',   // camelCase attribute selector, mlv prefix
  // DO NOT set standalone: true — it is the default in Angular v20+
})
export class MyDirective { ... }
```

- Never set `standalone: true` — it is the default in Angular v20+.
- No `NgModules` — every directive is standalone.

---

## Selector Conventions

| Purpose              | Selector pattern   | Example                                         |
| -------------------- | ------------------ | ----------------------------------------------- |
| Attribute directive  | `[mlvSomething]`   | `[mlvClick]`, `[mlvSortable]`, `[mlvActionBar]` |
| Structural directive | `[mlvSomething]`   | `[mlvTabDef]`, `[mlvTabContent]`                |
| Template slot marker | `[mlvSlotName]`    | `[mlvButtonBefore]`, `[mlvCardHeader]`          |
| Attribute on element | `element[mlvAttr]` | `a[mlvLink]`, `button[mlvButton]`               |

All selectors use the `mlv` prefix. Use camelCase for the directive name portion.

---

## Host Bindings

Always use the `host` object inside `@Directive`. **Never** use `@HostBinding` or `@HostListener` decorators.

```ts
@Directive({
  selector: '[mlvClick]',
  host: {
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.role]': '"button"',
    '(keydown.enter)': 'onKey($event)',
    '(keydown.space)': 'onKey($event); $event.preventDefault()',
    '(click)': 'handleClick($event)',
  },
})
```

Arrow-key handlers never compare `event.key` to `'ArrowLeft'` / `'ArrowRight'` — switch on `MlvRtlService.normalizeArrowKey(event)` (`@malva-ui/cdk/utils`) so the inline axis mirrors in RTL. See `.claude/rules/rtl.md`.

---

## Inputs & Outputs

Use signal-based `input()` and `output()` functions. Never use `@Input()` or `@Output()` decorators.

```ts
// Required input
readonly value = input.required<string>();

// Optional with default
readonly disabled = input<BooleanInput, boolean | string>(false, {
  transform: coerceBooleanProperty,
});

// Output matching the directive selector name (standard Angular pattern)
readonly mlvClick = output<MouseEvent | KeyboardEvent>();

// Or a generic output name
readonly valueChange = output<string>();
```

When the output name matches the directive selector (`mlvClick` output on `[mlvClick]` directive), Angular wires it automatically via event binding: `(mlvClick)="handler($event)"`.

---

## Dependency Injection

Use `inject()` in the constructor or at the field level. Never use constructor parameter injection.

```ts
export class MyDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
}
```

---

## Lifecycle & Cleanup

Prefer `DestroyRef.onDestroy` for imperative cleanup. For observable streams, use `takeUntilDestroyed()`.

```ts
export class MyDirective {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Imperative listener cleanup
    const renderer = inject(Renderer2);
    const el = inject(ElementRef<HTMLElement>);

    destroyRef.onDestroy(renderer.listen(el.nativeElement, 'keydown', (e: KeyboardEvent) => this.onKey(e)));

    // Observable cleanup
    fromEvent<MouseEvent>(el.nativeElement, 'click')
      .pipe(takeUntilDestroyed())
      .subscribe((e) => this.clicked.emit(e));
  }
}
```

Do **not** use `ngOnDestroy()` hook just to unsubscribe — prefer `takeUntilDestroyed()` or `DestroyRef`.

---

## Template Slot Directives

For directives that mark `<ng-template>` slots, inject `TemplateRef` directly:

```ts
@Directive({ selector: '[mlvCardHeader]' })
export class MlvCardHeaderDef {
  /** The template reference for this content slot. */
  readonly templateRef = inject(TemplateRef);
}
```

The parent component queries these with `contentChild(MlvCardHeaderDef)` and renders with `[ngTemplateOutlet]`.

---

## Structural Directives

For directives that define template context (e.g., `mlvTabDef`), provide a typed context interface and a static type guard:

```ts
export interface MyDefContext {
  $implicit: boolean;
  index: number;
}

@Directive({ selector: '[mlvMyDef]' })
export class MyDefDirective {
  readonly templateRef = inject(TemplateRef<MyDefContext>);

  /** Type guard for correct template variable inference. */
  static ngTemplateContextGuard(_dir: MyDefDirective, ctx: unknown): ctx is MyDefContext {
    return true;
  }
}
```

---

## Injection Tokens for Parent–Child Communication

When a directive or component needs to communicate with a parent without importing it directly, use an `InjectionToken`:

```ts
// group-token.ts
export interface GroupAccessor {
  onChildFocus(child: ChildComponent): void;
  selectItem(child: ChildComponent): void;
}

export const MY_GROUP = new InjectionToken<GroupAccessor>('MY_GROUP');
```

```ts
// parent.ts — provides itself
@Component({
  providers: [{ provide: MY_GROUP, useExisting: ParentComponent }],
})
export class ParentComponent implements GroupAccessor { ... }

// child.ts — injects the token
export class ChildComponent {
  private readonly group = inject(MY_GROUP, { optional: true });
}
```

---

## Effects in Directives

Use `effect()` for reactive side-effects that depend on signals:

```ts
export class SortableDirective {
  readonly options = input<SortableOptions>();

  constructor() {
    effect(() => {
      const opts = this.options();
      if (opts && this._sortable) {
        Object.assign(this._sortable.options, opts);
      }
    });
  }
}
```

---

## JSDoc Requirements

```ts
export class MlvClick {
  /**
   * When true, sets tabindex="-1" so the element is removed from the tab order.
   * The mlvClick output is not suppressed — gate logic in the consumer if needed.
   */
  readonly disabled = input<BooleanInput, boolean | string>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits on native click, Enter keydown, or Space keydown.
   */
  readonly mlvClick = output<MouseEvent | KeyboardEvent>();

  /**
   * @protected The ElementRef for the host element, used for direct DOM access when necessary. Use with caution and prefer Renderer2 or Angular CDK utilities when possible.
   */
  protected readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private The DestroyRef for this directive, used for takeUntilDestroyed() and onDestroy() cleanup.
   */
  private readonly _destroyRef = inject(DestroyRef);
}
```

All public inputs and outputs must have JSDoc. Protected members: `_` prefix + JSDoc. Private members: `_` prefix + JSDoc.

---

## Complete Minimal Example

```ts
import { Directive, ElementRef, inject, input, output, DestroyRef } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive({
  selector: '[mlvClick]',
  host: {
    '[attr.tabindex]': 'disabled() ? -1 : 0',
  },
})
export class MlvClick {
  /** Removes element from tab order and disables keyboard activation when true. */
  readonly disabled = input<BooleanInput, boolean | string>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits on click, Enter, or Space. */
  readonly mlvClick = output<MouseEvent | KeyboardEvent>();

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement;
    const destroyRef = inject(DestroyRef);

    const enter$ = fromEvent<KeyboardEvent>(el, 'keydown').pipe(
      filter((e) => e.key === 'Enter'),
      takeUntilDestroyed(destroyRef),
    );
    const space$ = fromEvent<KeyboardEvent>(el, 'keydown').pipe(
      filter((e) => e.key === ' '),
      takeUntilDestroyed(destroyRef),
    );
    const click$ = fromEvent<MouseEvent>(el, 'click').pipe(takeUntilDestroyed(destroyRef));

    merge(click$, enter$, space$).subscribe((e) => this.mlvClick.emit(e));
  }
}
```
