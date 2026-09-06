# Rule: Angular Component

Applies to every `@Component` created or modified in this codebase.

---

## Required Decorator Settings

```ts
@Component({
  selector: 'mlv-my-component',          // kebab-case, mlv- prefix for lib components
  templateUrl: './my-component.html',      // or inline template: for small components
  styleUrl: './my-component.scss',         // relative to the .ts file
  encapsulation: ViewEncapsulation.None,   // ALWAYS — BEM handles scoping
  changeDetection: ChangeDetectionStrategy.OnPush, // ALWAYS
  imports: [...],                          // only what's used; no NgModules
  // DO NOT set standalone: true — it is the default in Angular v20+
})
```

- `ViewEncapsulation.None` is **mandatory** on every **library** component. BEM class naming provides style isolation instead. Docs-app (`apps/docs`) page/example components are exempt — they keep default (emulated) encapsulation so example styles stay page-scoped.
- `ChangeDetectionStrategy.OnPush` is **mandatory** on every component.
- Never set `standalone: true` — redundant and incorrect in Angular v20+.

---

## Selectors

| Context                             | Pattern              | Example                                |
| ----------------------------------- | -------------------- | -------------------------------------- |
| Library element component           | `mlv-<name>`         | `mlv-button`, `mlv-dialog`             |
| Library attribute component         | `[mlv<Name>]`        | `[mlvActionBar]`                       |
| Library attribute on native element | `element[mlv<Name>]` | `button[mlvButton]`, `nav[mlvSidebar]` |
| Docs / app component                | `app-<name>`         | `app-dashboard`                        |

### Attribute selector on native element (exception)

Use `element[mlv<Name>]` when the component **wraps a semantically identical native element** — the component enhances the native element rather than replacing it. This preserves native browser semantics, built-in accessibility, and form integration without extra wrapper elements.

```ts
// button[mlvButton] — enhances <button> with Malva UI styling/behaviour.
// The host IS the <button>; native disabled, type, form attributes all work.
@Component({ selector: 'button[mlvButton], a[mlvButton]' })

// nav[mlvSidebar] — host IS the <nav>; landmark role is native.
@Component({ selector: 'nav[mlvSidebar]' })

// a[mlvLink] — host IS the <a>; href, target, router navigation all work.
@Component({ selector: 'a[mlvLink]' })
```

**Rules for this pattern:**

- The native element and the component must be semantically equivalent — do not put `button[mlvButton]` on a `<div>`.
- The BEM block class is still applied via `host: { class: 'mlv-button' }`.
- Native element attributes (`disabled`, `type`, `href`, etc.) are bound directly on the host — no wrapper element exists.
- Use a plain element selector (`mlv-<name>`) when no single native element captures the semantics (e.g., a card, a dialog, a data table).

---

## Host Bindings

Always use the `host` object inside `@Component`. **Never** use `@HostBinding` or `@HostListener` decorators.

```ts
host: {
  // Static classes
  'class': 'mlv-my-component',
  // Dynamic class bindings
  '[class.mlv-my-component--disabled]': 'disabled()',
  '[class]': '"mlv-my-component--" + variant()',
  // Attribute bindings
  '[attr.aria-disabled]': 'disabled() || null',
  '[attr.tabindex]': 'disabled() ? -1 : 0',
  // Event bindings
  '(click)': 'handleClick($event)',
  '(keydown.enter)': '!disabled() && activate.emit()',
  '(keydown.space)': '!disabled() && activate.emit(); $event.preventDefault()',
  // Static ARIA roles
  'role': 'button',
}
```

Always bind the static BEM block class as `'class': 'mlv-<block>'` in the host.

---

## Inputs & Outputs

Use signal-based `input()` and `output()` functions. Never use `@Input()` or `@Output()` decorators.

```ts
// Required input
readonly label = input.required<string>();

// Optional input with default
readonly variant = input<MlvButtonVariant>('primary');

// Two-way bindable (model)
readonly checked = model<boolean>(false);

// Boolean input with coercion — allows attribute usage: <mlv-x disabled>
readonly disabled = input<BooleanInput, boolean | string>(false, {
  transform: coerceBooleanProperty,
});

// Output
readonly activate = output<void>();
readonly valueChange = output<string>();
```

For boolean inputs that map to HTML attributes (`disabled`, `readonly`, `required`): use `BooleanInput` + `coerceBooleanProperty` from `@angular/cdk/coercion`.

---

## State & Derived Values

```ts
// Local state
readonly isOpen = signal(false);
readonly activeIndex = signal(0);

// Derived — never compute inline in the template
readonly displayValue = computed(() => {
  return this.options().find(o => o.value === this.value()) ?? null;
});

// Two-way model
readonly value = model<string>('');
```

- Use `signal()` for all mutable local state.
- Use `computed()` for all derived values. Keep computed functions pure (no side effects).
- Never use `signal.mutate()` — use `.update()` or `.set()` instead.
- Use `model()` for two-way bindable state.

---

## Content & View Queries

Use signal-based query functions. **Never** use `@ContentChild`, `@ContentChildren`, `@ViewChild`, `@ViewChildren`.

```ts
// Content children
protected readonly headerRef = contentChild(MlvCardHeaderDef);
protected readonly items = contentChildren(MlvListItem);

// View children
protected readonly listRef = viewChild<ElementRef<HTMLElement>>('listRef');
protected readonly tabItems = viewChildren(MlvTabItem);
```

---

## Dependency Injection

Always use `inject()`. Never use constructor injection.

```ts
// Correct
private readonly service = inject(MY_SERVICE_TOKEN);
private readonly elementRef = inject(ElementRef<HTMLElement>);
private readonly destroyRef = inject(DestroyRef);

// Wrong — do not use
constructor(private service: MyService) {}
```

---

## Observable Cleanup

Always clean up subscriptions with `takeUntilDestroyed()`. Do not store subscriptions manually.

```ts
constructor() {
  this.myService.data$.pipe(takeUntilDestroyed()).subscribe(data => {
    this.items.set(data);
  });
}
```

For imperative listeners, use `DestroyRef.onDestroy`:

```ts
constructor() {
  const renderer = inject(Renderer2);
  const destroyRef = inject(DestroyRef);
  destroyRef.onDestroy(
    renderer.listen(this.elementRef.nativeElement, 'keydown', (e) => this.onKeydown(e))
  );
}
```

---

## Templates

- Use native control flow: `@if`, `@for`, `@switch` — **never** `*ngIf`, `*ngFor`, `*ngSwitch`.
- Keep templates simple — extract logic to `computed()` or methods.
- Do not call `new Date()` or other globals in templates.
- Do not use `ngClass` — use `[class.foo]="condition"` or `[class]="expr"`.
- Do not use `ngStyle` — use `[style.color]="value"`.
- Use `as` aliases in `@if` blocks for readability.

```html
@if (resolvedOption(); as opt) {
<span class="mlv-select__label">{{ opt.label }}</span>
} @for (item of items(); track item.id) {
<mlv-list-item [value]="item.id">{{ item.name }}</mlv-list-item>
}
```

**Never** write custom buttons, inputs, checkboxes, or dialogs — always use the corresponding `@malva-ui/*` component.

---

## Lucide Icons

### Import rules

- **Never** import `LucideAngularModule` — it does not exist in `@lucide/angular` v1+.
- **Always** import each icon as a named directive class and list it in the component `imports` array.
- Use `LucideDynamicIcon` **only** when the icon name is determined at runtime; prefer the directive form for all static icons.

```ts
// Correct — named directive imports
import { LucideSettings, LucideLogOut, LucideUser } from '@lucide/angular';

@Component({
  imports: [LucideSettings, LucideLogOut, LucideUser],
})

// Wrong — LucideAngularModule does not exist
import { LucideAngularModule } from '@lucide/angular'; // ← compile error
```

### Static icons (directive form)

Apply the icon as an attribute directive on a bare `<svg>` element. Use `[size]` to control dimensions (defaults to `24`).

```html
<svg lucideArrowUp [size]="16" />
<svg lucideSettings [size]="20" />
<svg lucideLogOut [size]="16" />
```

### Dynamic icons

Use `LucideDynamicIcon` only when the icon name is a runtime value:

```ts
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  imports: [LucideDynamicIcon],
})
export class MyComponent {
  readonly iconName = input.required<string>(); // e.g. 'arrow-up', 'settings'
}
```

```html
<lucide-dynamic-icon [img]="iconName()" [size]="16" />
```

---

## Direction (RTL)

Malva UI mirrors at runtime, **scoped per `[dir]`** — a `dir="rtl"` on any ancestor flips that subtree. Inject `MlvRtlService` (`@malva-ui/cdk/utils`); never inject CDK `Directionality` directly (the service owns the document `dir` and the CDK sync).

- **Arrow keys** — switch on `normalizeArrowKey(event, this._direction())` (CDK constants, horizontal pair swapped in RTL), not `event.key === 'ArrowLeft'`. `_direction` is one cached `elementDirection(host)` signal per component; pass it whenever the handler branches on the horizontal pair, since omitting it falls back to the document direction and misses every scoped `[dir]` subtree, overlay panes included.
- **Measured geometry** (sliding indicator, pill, thumb) — read `elementDirection(host)()` inside the measuring `effect()`; a mirror moves children without resizing them, so no `ResizeObserver` or query fires.
- **Pointer maths** — `clientX` / `DOMRect` / `offsetLeft` are physical; convert to inline progress once at the boundary.
- **Overlays** — pass `direction: resolveDirection(trigger)` on the overlay config and use `start` / `end` in every `ConnectedPosition`; the pane is portaled to `<body>` and inherits no `[dir]`.
- **Icons** — glyphs that mean previous/next/expand-to-side mirror in SCSS via `transform: scaleX(var(--mlv-inline-direction))`; time and media glyphs do not.
- **API** — components take no `direction` input; the `dir` attribute is the API (overlay configs are the exception).

Full contract, snippets and checklist: `.claude/rules/rtl.md`.

---

## Services in Components

```ts
// Scoped service (provided by this component instance)
@Component({
  providers: [MyComponentService],
})
export class MyComponent {
  private readonly svc = inject(MyComponentService);
}
```

For singleton services, keep them at root level (`providedIn: 'root'`).

---

## Typing Conventions

```ts
// Union type aliases for variants/states
export type MlvButtonVariant = 'primary' | 'secondary' | 'outlined';

// Interfaces for public API shapes
export interface MlvSelectOption<T> {
  label: string;
  value: T;
}

// Abstract base classes for shared logic
export abstract class FormControlBase<T> implements ControlValueAccessor {
  // ...
}
```

- Use `interface` for public-facing API shapes.
- Use `type` aliases for unions.
- Use `abstract class` inheritance for shared component logic.

---

## JSDoc Requirements

```ts
export class MyComponent {
  /**
   * The visual style variant of this button.
   * Determines background color, text color, and hover state.
   */
  readonly variant = input<MlvButtonVariant>('primary');

  /**
   * Emits when the user activates this item via click or keyboard.
   */
  readonly activate = output<void>();

  /**
   * @internal Manages open/close state of the panel.
   */
  protected readonly _isOpen = signal(false);

  /**
   * @private Stores the current value of the input. Updated on user input and emits valueChange.
   */
  private readonly _internalValue = signal<string>('');
}
```

- All public inputs, outputs, and methods must have JSDoc.
- Protected members must be prefixed with `_` and have JSDoc.
- Private/internal members must be prefixed with `_` and have JSDoc.

---

## Complete Minimal Example

```ts
import { ChangeDetectionStrategy, Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

export type TagVariant = 'default' | 'success' | 'error';

@Component({
  selector: 'mlv-tag',
  template: `
    <span class="mlv-tag__label"><ng-content /></span>
    @if (removable()) {
      <button class="mlv-tag__remove" (click)="remove.emit()" aria-label="Remove tag">
        <svg lucideX [size]="12" />
      </button>
    }
  `,
  styleUrl: './tag.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-tag',
    '[class]': '"mlv-tag--" + variant()',
    '[class.mlv-tag--disabled]': 'disabled()',
    '[attr.aria-disabled]': 'disabled() || null',
  },
})
export class TagComponent {
  /** Visual style variant. */
  readonly variant = input<TagVariant>('default');

  /** Whether the remove button is visible. */
  readonly removable = input<BooleanInput, boolean | string>(false, {
    transform: coerceBooleanProperty,
  });

  /** Disables the component. */
  readonly disabled = input<BooleanInput, boolean | string>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits when the user clicks the remove button. */
  readonly remove = output<void>();
}
```
