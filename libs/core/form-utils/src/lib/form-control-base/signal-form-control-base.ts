import type { ModelSignal, Signal } from '@angular/core';
import {
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Subscription } from 'rxjs';
import { filter, fromEvent, race, switchMap, take, timer } from 'rxjs';
import type {
  FormCheckboxControl,
  FormValueControl,
  ValidationError,
} from '@angular/forms/signals';
import type { MlvFormState } from '../models/form-state';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvFormControl } from '../models/form-control-connector';
import type {
  MlvFormControlLabelStrategy,
  MlvFormControlLabelTarget,
} from '../models/form-field-connector';
import { MLV_FORM_FIELD } from '../models/form-field-connector';
import { MlvFormControlAppend } from '../form-control-sides';
import { MlvFormControlInset } from '../form-control-sides';
import { MlvFormControlPrepend } from '../form-control-sides';

/**
 * Shared, forms-transport-agnostic surface for **signal-forms** Malva controls.
 * Owns everything EXCEPT the value/checked model: the
 * Malva field surface (`state`, `label`, `hint`, `message`, `clearable`,
 * `id`, prepend/append slots), the wrapper connector contract
 * ({@link MlvFormControl}), and the signal-forms field↔control bindings —
 * `errors` / `disabled` / `readonly` / `touched` / `dirty` input signals the
 * `[formField]` directive binds automatically, plus the `touch` output the
 * control emits when the user leaves the field.
 *
 * Per the signal-forms contract a component must NOT implement both
 * `ControlValueAccessor` and `FormValueControl`; controls therefore adopt
 * either {@link MlvSignalFormControlBase} or {@link MlvSignalCheckboxControlBase}
 * atomically. Reactive (`[formControl]`)
 * and template-driven (`ngModel`) bindings keep working — Angular binds the
 * signal contract from those directives without extra compatibility code.
 */
@Directive()
export abstract class MlvSignalFormUiControlBase implements MlvFormControl {
  /** @protected Backing signal for {@link focused}. */
  protected readonly _focused = signal(false);

  /** Whether the control currently has focus (drives the wrapper's focus ring). */
  readonly focused: Signal<boolean> = this._focused;

  /** Sets the control's focus state (wired to the focus target's focus/blur). */
  setFocused(value: boolean): void {
    this._focused.set(value);
  }

  /** Explicit consumer-authored visual validation state. */
  readonly state = input<MlvFormState>('default');

  /**
   * Whether the control is read-only. Also a signal-forms field binding: when
   * bound via `[formField]`, a `readonly` schema rule drives this input.
   */
  readonly readonly = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Whether the control is disabled. Also a signal-forms field binding: when
   * bound via `[formField]`, the field's disabled state drives this input.
   */
  readonly disabled = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Whether the control must be filled in. Renders the required marker in
   * `mlv-label` and sets `aria-required` on the control's focus target. Also a
   * signal-forms field binding: when bound via `[formField]`, a `required()`
   * schema rule drives this input.
   */
  readonly required = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /** Whether the control shows its loading affordance. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether the control renders a clear (X) affordance while it has a value. */
  readonly clearable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Fully rounded (stadium) control container. Shared by every control that
   * renders through `mlv-form-control-wrapper`, mirroring `shape="pill"` on
   * buttons and the pill action bar.
   */
  readonly pill = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Signal-forms field binding: current validation errors of the bound field
   * (`[formField]` binds them automatically). Empty when unbound.
   */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Signal-forms field binding: whether the bound field is touched. */
  readonly touched = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /** Signal-forms field binding: whether the bound field is dirty. */
  readonly dirty = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Effective visual state exposed through the Malva form-control connector.
   * An explicit non-default state wins; otherwise a signal-form validation
   * error becomes visible after the field is touched, matching the default
   * `MlvFormField` error-display strategy.
   */
  readonly resolvedState = computed<MlvFormState>(() => {
    const explicitState = this.state();
    if (explicitState !== 'default') return explicitState;
    return this.errors().length > 0 && this.touched() ? 'error' : 'default';
  });

  /**
   * Emits when the user finishes interacting with the field — when focus
   * leaves the control — the signal-forms replacement for the CVA `onTouched`
   * callback; `[formField]` subscribes and marks the bound field touched.
   *
   * A control with several focusable parts that reports through
   * {@link _reportTouchOnFocusLeave} (a pin input's cells, a radio group's
   * radios, a range slider's thumbs) emits it when focus leaves the
   * **control**, never on a move from one of its parts to another (#347).
   * Controls that have not adopted it yet keep their own timing; see
   * `docs/migrations/2026-09-touched-on-focus-leave.md` § 4.
   */
  readonly touch = output<void>();

  /**
   * Whether the control currently holds a clearable (non-empty) value.
   */
  abstract readonly hasValue: Signal<boolean>;

  /** HTML id applied to the control's focus target. */
  readonly id = input<string>(mlvNextId('mlv-control'));
  /** Label text rendered above the control. */
  readonly label = input('');
  /** Hint text rendered inside the label. */
  readonly hint = input('');
  /**
   * Persistent help text rendered **below** the control, in front of the
   * validation message. Unlike {@link hint} (a short inline aside inside the
   * label) this is meant for sentence-length descriptions, and it stays
   * visible while {@link message} is shown. Referenced by `aria-describedby`.
   */
  readonly description = input('');
  /** Validation/status message rendered below the control. */
  readonly message = input('');

  /**
   * Accessible name applied to the control's focus target (`aria-label`).
   * Use it when the control renders no visible `<mlv-label>`.
   */
  readonly ariaLabel = input<string | null>(null);

  /**
   * @private The enclosing `mlv-form-field`, when this control is projected
   * into one. Optional — every control still works standalone.
   */
  private readonly _formField = inject(MLV_FORM_FIELD, { optional: true });

  /**
   * @protected How an `<mlv-label>` projected beside this control into
   * `mlv-form-field` may name it. `'none'` by default, which is the only safe
   * default: guessing `'native'` would emit a `for` that names nothing on
   * every composite control, and guessing `'aria'` would publish an
   * `aria-labelledby` no template consumes. Concrete controls override it —
   * see `MlvFormControlLabelStrategy` for what each value asserts.
   *
   * A method rather than a field so an override may read signals (`mlv-select`
   * is `'native'` while its native `<select>` is the live surface and `'aria'`
   * behind its `div[role="combobox"]`) without depending on subclass field
   * initialisation order.
   */
  protected _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'none';
  }

  /**
   * @protected Id of the element {@link labelTarget} points at. Defaults to
   * {@link id}, because a control normally puts that id on its own focus
   * target.
   *
   * Overridden where the focus target cannot carry {@link id} itself:
   * `[mlvTitle]`'s host is the consumer's own heading, and a **static** `id`
   * attribute both feeds this input and stays on that heading — so the
   * `<textarea>` takes a derived id and reports it here, keeping the two
   * elements distinct.
   */
  protected _labelTargetId(): string {
    return this.id();
  }

  /**
   * The element inside this control that a label rendered outside it may name,
   * and how — `null` when nothing can. Read by `mlv-form-field`; see
   * {@link MlvFormControl.labelTarget}.
   */
  readonly labelTarget = computed<MlvFormControlLabelTarget | null>(() => {
    const strategy = this._externalLabelStrategy();
    if (strategy === 'none') return null;
    return { id: this._labelTargetId(), labelable: strategy === 'native' };
  });

  /**
   * @protected Value for the `for` attribute of the `<mlv-label>` a control
   * renders **itself** from {@link label} — the id of its name target when
   * that target is HTML-labelable, else `null`, which emits no attribute at
   * all.
   *
   * The question a control's own label asks is the same one
   * {@link labelTarget} already answers for a label projected beside it — "is
   * the id I would point `for` at on an element `<label for>` can name?" — so
   * both read one source of truth rather than each deciding again. Binding
   * `[for]="id()"` unconditionally is what #216 removes: on `mlv-select`'s
   * `div[role="combobox"]`, the three pickers' trigger `div`s, a
   * `projectControl` `mlv-input`, a disabled `mlv-tokenizer` and `mlv-editor`'s
   * contenteditable, that attribute named nothing while reading as an
   * association in review, and clicking the label focused nothing.
   *
   * Templates read it as `[for]="_ownLabelFor()"`. A control whose `for` is
   * some element other than its name target — `mlv-pin-input` points at its
   * first cell — keeps its own explicit binding.
   */
  protected readonly _ownLabelFor = computed<string | null>(() => {
    const target = this.labelTarget();
    return target?.labelable ? target.id : null;
  });

  /**
   * @protected Whether an `<mlv-label>` projected beside this control into
   * `mlv-form-field` is naming it — through **either** association strategy.
   *
   * {@link _fieldLabelId} cannot answer this: it is populated only on the
   * `'aria'` path. A `'native'` control reads `null` there and keeps emitting
   * whatever `aria-label` fallback its template supplies — and `aria-label`
   * outranks `<label for>` in the accessible-name computation, so the field's
   * label would deliver click-to-focus and no name at all (#197 review).
   *
   * Templates read it to suppress a **non-nullable** `aria-label` fallback:
   * `[attr.aria-label]="_externallyLabelled() ? null : (ariaLabel() ?? _i18n().x)"`.
   * A control whose fallback is already `ariaLabel()` alone needs nothing: a
   * consumer who wrote one asked for it.
   */
  protected readonly _externallyLabelled = computed<boolean>(() => {
    if (this._externalLabelStrategy() === 'none') return false;
    return this._formField?.labelId() != null;
  });

  /**
   * @protected Id of an `<mlv-label>` projected beside this control into
   * `mlv-form-field`, for controls whose focus target `<label for>` cannot
   * name. `null` for every other case — including when the control renders its
   * own label from {@link label}, which wins because it is the nearer,
   * explicitly-authored name.
   *
   * Templates read it as `[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"`.
   */
  protected readonly _fieldLabelId = computed<string | null>(() => {
    if (this._externalLabelStrategy() !== 'aria') return null;
    return this._formField?.labelId() ?? null;
  });

  /** @protected Id of the rendered `<mlv-description>` element. */
  protected readonly _descriptionId = computed(
    () => `${this.id()}-description`,
  );

  /** @protected Id of the rendered `<mlv-message>` element. */
  protected readonly _messageId = computed(() => `${this.id()}-message`);

  /**
   * @protected Id of the auto error message the enclosing `mlv-form-field` is
   * rendering right now — `null` outside a field, and whenever the field shows
   * no error, so no dangling IDREF is emitted.
   *
   * Folded into {@link _describedBy}, which is where a control reads it. It is
   * exposed on its own for a control that renders no description / message of
   * its own and so cannot bind `_describedBy()` without pointing at elements
   * that do not exist (`mlv-rating`).
   */
  protected readonly _fieldErrorId = computed<string | null>(
    () => this._formField?.errorMessageId?.() ?? null,
  );

  /**
   * @protected Space-separated `aria-describedby` value covering the rendered
   * description and message elements, followed by the enclosing field's auto
   * error message ({@link _fieldErrorId}) — `null` when none of them is
   * rendered, so no dangling IDREF is emitted.
   *
   * Every control that binds this therefore keeps the field's error reason
   * attached after the message's one-time `role="alert"` announcement: without
   * it a screen reader returning to the control heard "invalid entry" and no
   * reason (#320).
   */
  protected readonly _describedBy = computed(() => {
    const ids: string[] = [];
    if (this.description()) ids.push(this._descriptionId());
    if (this.message()) ids.push(this._messageId());
    const fieldErrorId = this._fieldErrorId();
    if (fieldErrorId) ids.push(fieldErrorId);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  /**
   * @protected `aria-invalid` value for the control's focus target: `true`
   * while {@link resolvedState} is `'error'`, `null` (no attribute) otherwise.
   * Only an error claims invalidity — `success`, `warning` and `info` are
   * status, not validity.
   */
  protected readonly _ariaInvalid = computed<true | null>(() =>
    this.resolvedState() === 'error' ? true : null,
  );

  /** Projected prefix slot. */
  readonly prepend = contentChild(MlvFormControlPrepend);
  /** Projected suffix slot. */
  readonly append = contentChild(MlvFormControlAppend);
  /** Projected full-width content rendered inside the control border. */
  readonly inset = contentChild(MlvFormControlInset);

  /**
   * Effective disabled state. In the signal base there is no CVA
   * `setDisabledState` side channel — the `disabled` input is the single
   * source (consumer-bound or field-bound), kept as a computed so existing
   * control templates retain one consistent disabled-state signal.
   */
  readonly computedDisabled = computed(() => this.disabled());

  /**
   * @protected Whether a **user interaction** may write the control's value
   * right now: `false` while the control is {@link readonly} or
   * {@link computedDisabled}, whichever forms transport set them (a consumer
   * `[readonly]` / `[disabled]`, a signal-forms `readonly()` / `disabled()`
   * rule, or a reactive `FormControl.disable()`).
   *
   * The one write-permission question every control asks, so none of them
   * re-derives it per handler and forgets a term (#298: the number-input,
   * checkbox, switch, slider and pin-input handlers all checked
   * `computedDisabled()` alone). Neither forms layer enforces it for a custom
   * control — signal forms wires the model back unconditionally and the
   * reactive interop has no readonly concept — so the control must.
   *
   * Gate a handler on it **before** it touches any local draft state (a
   * pending string, a cell array, a drag position), then write through
   * `_write()`. Programmatic writes to the model from the form or the consumer
   * are never gated: readonly locks the user out, not the application.
   *
   * `mlv-form-control-wrapper` restates this rule over the
   * `MLV_FORM_CONTROL` connector (`!readonly() && !disabled()`) to decide
   * whether its clear button renders (#301) — it sees only the connector, not
   * this protected member. A term added here must be added there too.
   */
  protected readonly _canWrite = computed(
    () => !this.readonly() && !this.computedDisabled(),
  );

  /** @protected Notifies the field that the user left the control. */
  protected _markTouched(): void {
    this.touch.emit();
  }

  /**
   * @private Host element of the concrete control: the boundary
   * {@link _focusLeavesControl} measures a focus move against.
   */
  private readonly _controlHost: HTMLElement = inject(ElementRef<HTMLElement>)
    .nativeElement;

  /**
   * @protected Whether `event`, a `focusout` from an element of this control,
   * takes focus out of the control altogether rather than to another of its
   * own parts.
   *
   * The contract behind {@link touch} (owner decision D22, #347): a control
   * reports touched when focus leaves the control or group, never on a move
   * between its own parts. A pin input used to touch on every auto-advance,
   * so a validated code turned red after its first digit.
   *
   * Read it synchronously, inside the listener. `relatedTarget` is the element
   * receiving focus, already retargeted by the browser to this control's tree:
   * focus entering a shadow root nested inside the control names that root's
   * host, which is contained, and focus entering a shadow root elsewhere names
   * an outside host. No `composedPath()` walk is needed, and the value is not
   * reliable once dispatch ends.
   *
   * A `relatedTarget` that names no element counts as **leaving**. The browser
   * sends that for a click on non-focusable space, `el.blur()`, a focused
   * element removed from the document (Chromium) and a window or tab switch.
   * Singling out the window switch would mean trusting
   * `document.activeElement` during `focusout`, which reads `body` for every
   * real focus move in Chromium, Firefox and WebKit (measured) and could not be
   * measured for a window switch at all, so nothing relies on it. Counting the
   * switch as leaving also keeps parity with every control that touches on a
   * native `blur`, which a window switch fires, and with Angular's own value
   * accessors. The one exception is a pointer press
   * inside the control, which {@link _reportTouchOnFocusLeave} defers until
   * the press has ended.
   *
   * @param event The `focusout` (or `blur`) event. Only its `relatedTarget`
   * is read.
   * @param containers Elements that belong to this control but sit outside
   * its host, such as an overlay pane portaled to `<body>`. The host always
   * counts.
   * @returns `true` when focus moved to no element, or to one outside the
   * host and every container.
   */
  protected _focusLeavesControl(
    event: FocusEvent,
    ...containers: readonly (Element | null | undefined)[]
  ): boolean {
    const next = event.relatedTarget;
    if (!isFocusTargetNode(next)) return true;
    if (this._controlHost.contains(next)) return false;
    return !containers.some((container) => container?.contains(next));
  }

  /**
   * @protected Whether focus is inside this control right now: the focused
   * element of the host's own root (the document, or the shadow root the
   * control renders in) is the host, one of its descendants, or inside one
   * of `containers`.
   *
   * For a verdict taken **after** a focus move rather than during one — the
   * end of a pointer gesture, when the question is whether the gesture left
   * focus inside the control (a pressed slider thumb) or not (a press on its
   * track). During a `focusout`, read {@link _focusLeavesControl} instead:
   * the focused element is not reliable there.
   *
   * @param containers Elements that belong to this control but sit outside
   * its host, such as an overlay pane portaled to `<body>`.
   */
  protected _focusIsInsideControl(
    ...containers: readonly (Element | null | undefined)[]
  ): boolean {
    const host = this._controlHost;
    const active =
      (host.getRootNode() as Partial<DocumentOrShadowRoot>).activeElement ??
      null;
    if (!active) return false;
    return (
      host.contains(active) ||
      containers.some((container) => container?.contains(active))
    );
  }

  /**
   * @protected Makes a control with several focusable parts report touched —
   * and clear {@link focused} — once focus leaves the control, and never on a
   * move between its own parts ({@link _focusLeavesControl}). Call it once,
   * from the constructor: it injects, and it owns its listeners' lifetime.
   *
   * Listens for `focusout` on the host, where it bubbles from every part and
   * fires for the host itself when the host is focusable. With
   * `options.containers` it also listens on the document, for a `focusout`
   * and a press whose target is inside a container: a container sits outside
   * the host, so neither event reaches the host from there.
   *
   * **A pointer press inside the control defers the verdict.** `mousedown`
   * on a part that is not focusable moves focus to the press target's nearest
   * focusable ancestor — outside the host, that is an ancestor of the host
   * (a `main[mlvPage]`, which is `tabindex="-1"`) or, with none, no element
   * at all (Chromium, Firefox and WebKit measured). A click on an
   * `mlv-radio`'s label blurs the focused radio that way at `mousedown` and
   * focuses the chosen one at `click`, so reading that `focusout` alone
   * touched a required group — and showed its error — while the user was still
   * choosing. So a `focusout` to no element or to an ancestor of the host (or
   * of a container), while a press that began inside the control is in
   * progress, waits for the press to end (the `click`, a `pointercancel`, or
   * {@link PRESS_END_FALLBACK_MS} after the `pointerup` for a press no click
   * follows) and then one task more — the label's own focus move — and reports
   * leaving only if focus is not back inside. Every other `focusout` is
   * decided on the spot. The ancestor test does not cross a shadow boundary:
   * inside a shadow root, an ancestor beyond it counts as leaving.
   *
   * @param options.enabled While it returns `false`, focus leaving reports
   * nothing — for a mode in which the control is not a form control.
   * @param options.containers Elements that belong to the control but sit
   * outside its host, such as a portaled overlay pane. Read on every event.
   * Focus moving between the host and a container stays inside the control;
   * focus leaving a container for anywhere else leaves it. A container inside
   * a shadow root is not seen from the document, which reads the shadow
   * root's host as the target.
   */
  protected _reportTouchOnFocusLeave(
    options: {
      readonly enabled?: () => boolean;
      readonly containers?: () => readonly (Element | null | undefined)[];
    } = {},
  ): void {
    const enabled = options.enabled ?? (() => true);
    const containers = options.containers ?? (() => []);
    const host = this._controlHost;
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);

    /** The press in progress, from `pointerdown` inside the control to its end. */
    let press: Subscription | null = null;
    /**
     * A `focusout` to no element or to an ancestor of the host or a container
     * arrived during {@link press}, and waits for the press to end.
     */
    let verdictPending = false;

    const leave = (): void => {
      if (!enabled()) return;
      this.setFocused(false);
      this._markTouched();
    };

    const onPressEnd = (): void => {
      press = null;
      if (!verdictPending) return;
      verdictPending = false;
      // One task after the `click`: its default action (a label focusing its
      // control) has run by then.
      timer(0)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => {
          if (!this._focusIsInsideControl(...containers())) leave();
        });
    };

    const onPressStart = (): void => {
      press?.unsubscribe();
      const capture = { capture: true, passive: true };
      press = race(
        fromEvent(document, 'click', capture),
        fromEvent(document, 'pointercancel', capture),
        fromEvent(document, 'pointerup', capture).pipe(
          switchMap(() => timer(PRESS_END_FALLBACK_MS)),
        ),
      )
        .pipe(take(1), takeUntilDestroyed(destroyRef))
        .subscribe(onPressEnd);
    };

    const onFocusOut = (event: FocusEvent): void => {
      const within = containers();
      if (!this._focusLeavesControl(event, ...within)) return;
      if (
        press !== null &&
        isPressFocusFixup(event.relatedTarget, [host, ...within])
      ) {
        verdictPending = true;
        return;
      }
      leave();
    };

    // Passive: nothing here cancels the press.
    const pressOptions = { capture: true, passive: true };

    fromEvent(host, 'pointerdown', pressOptions)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(onPressStart);

    fromEvent<FocusEvent>(host, 'focusout')
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(onFocusOut);

    if (options.containers === undefined) return;

    // A container sits outside the host, so a press or a focus move inside it
    // never reaches the host. Events inside the host are left to the two
    // listeners above, so none is handled twice.
    const inContainer = (event: Event): boolean => {
      const target = event.target;
      return (
        isFocusTargetNode(target) &&
        !host.contains(target) &&
        containers().some((container) => container?.contains(target))
      );
    };

    fromEvent(document, 'pointerdown', pressOptions)
      .pipe(
        filter((event) => inContainer(event)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(onPressStart);

    fromEvent<FocusEvent>(document, 'focusout')
      .pipe(
        filter((event) => inContainer(event)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(onFocusOut);
  }
}

/**
 * How long after a `pointerup` a press inside a control stays in progress
 * when no `click` follows it — a touch whose compatibility `click` is still
 * to come, or a press released outside any common ancestor. Only delays the
 * verdict of a deferred `focusout` (see
 * `MlvSignalFormUiControlBase._reportTouchOnFocusLeave`); it never decides it.
 */
const PRESS_END_FALLBACK_MS = 500;

/**
 * Whether a focus event's `relatedTarget` is a node `Node.contains()` accepts.
 * A duck check rather than `instanceof Node`, which fails for a node from
 * another realm.
 */
function isFocusTargetNode(target: EventTarget | null): target is Node {
  return (
    target !== null && typeof (target as Partial<Node>).nodeType === 'number'
  );
}

/**
 * Whether a focus event's `relatedTarget` names no element: `null`, which is
 * what browsers send, or the document itself, which jsdom sends for
 * `el.blur()`. `9` is `Node.DOCUMENT_NODE`, spelled out so the check needs no
 * `Node` global.
 */
function namesNoElement(target: EventTarget | null): boolean {
  return !isFocusTargetNode(target) || target.nodeType === 9;
}

/**
 * Whether a `focusout` from inside a control, during a pointer press that
 * began inside it, is the browser's `mousedown` focus move to the press
 * target's nearest focusable ancestor rather than a move elsewhere: focus went
 * to no element, or to an ancestor of the control's host or of one of its
 * containers (`roots`).
 */
function isPressFocusFixup(
  target: EventTarget | null,
  roots: readonly (Element | null | undefined)[],
): boolean {
  if (namesNoElement(target)) return true;
  return roots.some((root) => !!root && (target as Node).contains(root));
}

/**
 * Signal-forms base for **value** controls: adds the required
 * `value: ModelSignal<T>` of the `FormValueControl` contract. Each control
 * supplies the model itself (`readonly value = model<T>(initial)`), mirroring
 * how `hasValue` is supplied.
 */
@Directive()
export abstract class MlvSignalFormControlBase<T>
  extends MlvSignalFormUiControlBase
  implements FormValueControl<T>
{
  /** The control's value — kept in sync with the bound field by `[formField]`. */
  abstract readonly value: ModelSignal<T>;

  /**
   * @protected Writes a value produced by a user interaction — a key, a
   * pointer gesture, a paste, a clear — into {@link value}, but only while
   * {@link _canWrite} allows it.
   *
   * @param value The value the interaction produced.
   * @returns `true` when the model was written, `false` when the write was
   * refused. A caller that already mutated the DOM or a local draft (a native
   * input's `checked`, a typed string) uses `false` to roll that back.
   */
  protected _write(value: T): boolean {
    if (!this._canWrite()) return false;
    this.value.set(value);
    return true;
  }
}

/**
 * Signal-forms base for **checkbox-shaped** controls (checkbox, switch): adds
 * the required `checked: ModelSignal<boolean>` of the `FormCheckboxControl`
 * contract. The contract forbids a `value` member on this variant.
 */
@Directive()
export abstract class MlvSignalCheckboxControlBase
  extends MlvSignalFormUiControlBase
  implements FormCheckboxControl
{
  /** The control's checked state — kept in sync with the bound field by `[formField]`. */
  abstract readonly checked: ModelSignal<boolean>;

  /**
   * @protected Writes a checked state produced by a user interaction (click,
   * Space, Enter, clear) into {@link checked}, but only while
   * {@link _canWrite} allows it — the `checked` counterpart of
   * `MlvSignalFormControlBase._write`.
   *
   * @param checked The state the interaction produced.
   * @returns `true` when the model was written, `false` when the write was
   * refused — the caller then restores the native input's `checked`, which a
   * browser flips before `(change)` runs.
   */
  protected _write(checked: boolean): boolean {
    if (!this._canWrite()) return false;
    this.checked.set(checked);
    return true;
  }
}
