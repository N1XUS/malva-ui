import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { PositionStrategy } from '@angular/cdk/overlay';
import type { OverlayConfig } from '@angular/cdk/overlay';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  forwardRef,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  numberAttribute,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { LucideSearch } from '@lucide/angular';
import {
  MlvButton,
  MlvButtonIcon,
  MlvButtonClose,
} from '@malva-ui/core/button';
import {
  MlvFormControlAppend,
  MlvFormControlPrepend,
} from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvOverlayHostBase } from '@malva-ui/cdk/overlay';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_SEARCH_FIELD_I18N } from '@malva-ui/i18n';
import { MlvSearchOverlayContentDef } from './search-overlay-content';
import type { MlvSearchOverlayContentContext } from './search-overlay-content';

/** Controls when a search field commits the current query. */
export type MlvSearchFieldTrigger = 'live' | 'submit';

/**
 * How the field presents itself before an overlay search is opened.
 *
 * - `'field'` — the standard input. With `overlay`, clicking or focusing it
 *   opens the overlay instead of typing inline.
 * - `'icon'` — a circular icon button only. Implies `overlay`, since an icon has
 *   nowhere to type.
 */
export type MlvSearchFieldPresentation = 'field' | 'icon';

/**
 * ARIA role applied to the field's underlying `<input>`.
 *
 * - `'searchbox'` (default) — leaves the native `<input type="search">` role
 *   implicit and emits no {@link MlvSearchField.navigate} events.
 * - `'combobox'` — the field drives a popup listbox owned by the consumer.
 *   Stamps `role="combobox"` on the input and turns on the arrow-key hooks.
 */
export type MlvSearchFieldRole = 'searchbox' | 'combobox';

/** Values accepted by `aria-autocomplete` on a combobox input. */
export type MlvSearchFieldAriaAutocomplete = 'none' | 'list' | 'both';

/** One of the option-navigation keys reported by {@link MlvSearchField.navigate}. */
export type MlvSearchFieldNavigateDirection =
  | 'up'
  | 'down'
  | 'home'
  | 'end'
  | 'pageUp'
  | 'pageDown';

/**
 * Payload of {@link MlvSearchField.navigate} — an option-navigation key pressed
 * while the field is acting as a combobox.
 */
export interface MlvSearchFieldNavigateEvent {
  /** Which navigation key was pressed. */
  readonly direction: MlvSearchFieldNavigateDirection;
  /**
   * The originating key event. `up`/`down`/`pageUp`/`pageDown` arrive already
   * `preventDefault`ed; `home`/`end` do not — call `preventDefault()` on this
   * event to take the caret keys over as well.
   */
  readonly event: KeyboardEvent;
}

/**
 * Payload of {@link MlvSearchField.commit} — the user asked to act on the
 * current query, through Enter or the submit action.
 */
export interface MlvSearchFieldCommitEvent {
  /** The query at the moment of the commit. */
  readonly value: string;
  /**
   * The originating event. Call `preventDefault()` on it to take the commit
   * over: the field then skips its own `search` emission and leaves the key
   * consumed, so a combobox consumer can resolve the active option instead.
   */
  readonly event: KeyboardEvent | MouseEvent;
}

/**
 * Keys that move through a popup listbox, mapped to the direction reported by
 * {@link MlvSearchField.navigate}.
 */
const NAVIGATION_KEYS = new Map<string, MlvSearchFieldNavigateDirection>([
  ['Home', 'home'],
  ['End', 'end'],
  ['PageUp', 'pageUp'],
  ['PageDown', 'pageDown'],
]);

/**
 * Directions whose native effect inside a text input fights the listbox — the
 * arrows and page keys jump the caret to the ends of the query or scroll the
 * page. They are consumed on the field's behalf. `home`/`end` are not: in an
 * editable combobox they are the caret keys the WAI-ARIA pattern keeps.
 */
const CONSUMED_DIRECTIONS = new Set<MlvSearchFieldNavigateDirection>([
  'up',
  'down',
  'pageUp',
  'pageDown',
]);

/**
 * A search-specific text field with either debounced live updates or explicit
 * submission through Enter and a trailing action button.
 */
@Component({
  selector: 'mlv-search-field',
  imports: [
    MlvInput,
    MlvButton,
    MlvButtonIcon,
    MlvLoader,
    LucideSearch,
    MlvFormControlPrepend,
    MlvFormControlAppend,
    MlvButtonClose,
    NgTemplateOutlet,
    // `cdkTrapFocus` on the overlay panel — `role="dialog" aria-modal="true"`
    // only holds if focus is actually trapped, as in `mlv-dialog`/`mlv-drawer`.
    A11yModule,
    // The overlay's default body is another `mlv-search-field` with overlay
    // behaviour off. Self-reference needs `forwardRef`: the class is not yet
    // defined while its own decorator is evaluated.
    forwardRef(() => MlvSearchField),
  ],
  templateUrl: './search-field.html',
  styleUrl: './search-field.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-search-field',
    '[class.mlv-search-field--disabled]': 'disabled()',
    '[class.mlv-search-field--loading]': 'loading()',
    '[class.mlv-search-field--submit]': 'trigger() === "submit"',
    '[class.mlv-search-field--icon]': 'presentation() === "icon"',
    '[class.mlv-search-field--overlay-enabled]': '_overlayEnabled()',
    '[class.mlv-search-field--overlay-open]': 'opened()',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class MlvSearchField extends MlvOverlayHostBase {
  private readonly _rtlService = inject(MlvRtlService);
  /** Current query. Supports two-way binding with `[(value)]`. */
  readonly value = model<string>('');

  /**
   * Search commit strategy. Live mode emits after {@link debounce}; submit
   * mode emits only from Enter or the submit button.
   */
  readonly trigger = input<MlvSearchFieldTrigger>('live');

  /**
   * Trailing delay, in milliseconds, used by live mode. Negative values are
   * clamped to zero.
   * @default 200
   */
  readonly debounce = input<number, number | string>(200, {
    transform: (value) => Math.max(0, numberAttribute(value, 200)),
  });

  /** Placeholder override. Falls back to the active i18n language pack. */
  readonly placeholder = input<string | undefined>(undefined);

  /** Accessible input label override. Falls back to the active i18n pack. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** Whether the field and all its actions are unavailable. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether a pending-search indicator is shown. The input remains editable
   * so a newer live query can supersede an in-flight request; explicit submit
   * activation is blocked until loading completes.
   */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether the trailing submit action is rendered in `submit` mode.
   *
   * Set to `false` for a field that commits from Enter alone — the overlay's own
   * nested field does this, since the overlay already has a leading search icon
   * and a close action.
   * @default true
   */
  readonly showSubmit = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Whether a clear action is shown while the field has a value. */
  readonly clearable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether clearing also commits the empty query through {@link search}.
   * Composite controls can disable this while still receiving the cleared
   * {@link value} model update.
   * @default true
   */
  readonly commitOnClear = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Visual form of the trigger. `'icon'` renders a circular search button only
   * and implies {@link overlay}.
   * @default 'field'
   */
  readonly presentation = input<MlvSearchFieldPresentation>('field');

  /**
   * Opens a full-screen search overlay instead of accepting input inline.
   *
   * With `presentation="field"` the visible input becomes a trigger: clicking it
   * or pressing Enter/Space on it opens the overlay, so the inline input is
   * rendered read-only to keep it from competing with the overlay's own input.
   * Focus alone never opens the overlay — see {@link _onTriggerClick}. With
   * `presentation="icon"` this is always on.
   * @default false
   */
  readonly overlay = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * ARIA role of the underlying `<input>`, and the opt-in switch for the
   * combobox keyboard hooks.
   *
   * `'searchbox'` (the default) changes nothing: the native
   * `<input type="search">` role stays implicit, no `role` attribute is
   * rendered, and {@link navigate} never emits. `'combobox'` stamps
   * `role="combobox"` on the input and starts reporting the option-navigation
   * keys through {@link navigate}, so a consumer-owned popup listbox can be
   * driven from the field. Pair it with {@link ariaControls},
   * {@link ariaExpanded}, {@link ariaAutocomplete} and
   * {@link ariaActiveDescendant}.
   *
   * Only meaningful with `presentation="field"` — `presentation="icon"` renders
   * a dialog-trigger button, which has no input to carry the role. Likewise
   * mutually exclusive with {@link overlay}, whose inline trigger is a
   * read-only dialog opener rather than a text entry.
   * @default 'searchbox'
   */
  readonly role = input<MlvSearchFieldRole>('searchbox');

  /**
   * Forwarded to `aria-controls` on the input — the DOM id of the popup listbox
   * this field drives. Required by the combobox pattern; ignored while `null`.
   */
  readonly ariaControls = input<string | null>(null);

  /**
   * Forwarded to `aria-activedescendant` on the input — the DOM id of the
   * currently highlighted option inside the popup. Keep DOM focus on the input
   * and move this id instead, so typing keeps working while navigating options.
   */
  readonly ariaActiveDescendant = input<string | null>(null);

  /**
   * Forwarded to `aria-autocomplete` on the input. Use `'list'` when the popup
   * suggests options without changing the query, `'both'` when the field also
   * completes inline. Ignored while `null`.
   */
  readonly ariaAutocomplete = input<MlvSearchFieldAriaAutocomplete | null>(
    null,
  );

  /**
   * Forwarded to `aria-expanded` on the input — whether the consumer's popup is
   * currently open. Required by the combobox pattern.
   *
   * Ignored while {@link overlay} is enabled: the inline input is then a dialog
   * trigger and reports the overlay's own open state instead.
   */
  readonly ariaExpanded = input<boolean | null>(null);

  /** Emits a committed query according to the selected trigger strategy. */
  // `search` is the intentional public event vocabulary for this composite
  // control; it is emitted on commit, unlike the native input's `search` event.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>();

  /**
   * Emits when an option-navigation key is pressed while `role="combobox"`.
   *
   * Covers ArrowUp/ArrowDown, PageUp/PageDown and Home/End. The first four are
   * `preventDefault`ed before the event is handed over — inside a text input
   * they would otherwise jump the caret to the ends of the query or scroll the
   * page, which is never what a combobox wants. Home/End are reported without
   * being consumed, because an editable combobox keeps them as caret keys per
   * WAI-ARIA; a consumer that wants "jump to first/last option" calls
   * `preventDefault()` on the supplied event itself.
   *
   * Never emits while `role="searchbox"`, so the default field is untouched.
   */
  readonly navigate = output<MlvSearchFieldNavigateEvent>();

  /**
   * Emits when the user asks to act on the current query — a non-composing
   * Enter on the inline input, or the trailing submit action.
   *
   * Always emitted *before* the field's own commit, in every `trigger` mode, so
   * a combobox consumer can resolve the highlighted option instead of running a
   * plain search: call `preventDefault()` on the supplied event and the field
   * skips its `search` emission and leaves the key consumed. Left alone, the
   * existing behaviour runs unchanged — `submit` mode emits `search`, `live`
   * mode has already emitted through the debounce and Enter still bubbles.
   *
   * Not emitted while {@link overlay} is enabled, where Enter opens the dialog
   * rather than committing, and not emitted while disabled or loading.
   */
  readonly commit = output<MlvSearchFieldCommitEvent>();

  /** @protected Reactive strings for the active language. */
  protected readonly _i18n = inject(MLV_SEARCH_FIELD_I18N);

  /** @protected Consumer template replacing the overlay body, when supplied. */
  protected readonly _overlayContentDef = contentChild(
    MlvSearchOverlayContentDef,
  );

  /** @protected The overlay panel template attached to the CDK overlay. */
  protected readonly _overlayTemplate =
    viewChild<TemplateRef<unknown>>('overlayTemplate');

  /**
   * @protected Whether overlay behaviour is active. `presentation="icon"` forces
   * it on: an icon button has nowhere to accept text.
   */
  protected readonly _overlayEnabled = computed(
    () => this.overlay() || this.presentation() === 'icon',
  );

  /** @protected Context handed to a consumer-supplied overlay body. */
  protected readonly _overlayContext = computed<MlvSearchOverlayContentContext>(
    () => ({
      $implicit: this.value(),
      query: this.value(),
      loading: this.loading(),
      placeholder: this._resolvedPlaceholder(),
      ariaLabel: this._resolvedAriaLabel(),
      setQuery: (value: string) => this._onValueChange(value),
      submit: () => this._submitFromOverlay(),
      clear: () => this._clear(),
      close: () => this.close(),
    }),
  );

  /** @protected Effective placeholder after resolving an explicit override. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().placeholder,
  );

  /** @protected Effective input label after resolving an explicit override. */
  protected readonly _resolvedAriaLabel = computed(
    () => this.ariaLabel() ?? this._i18n().search,
  );

  /**
   * @protected Explicit `role` attribute for the input, or `null` to leave it off.
   *
   * `searchbox` is the implicit role of `<input type="search">`, so the default
   * renders no attribute at all and the DOM stays exactly as it was.
   */
  protected readonly _resolvedRole = computed(() =>
    this.role() === 'combobox' ? 'combobox' : null,
  );

  /**
   * @protected Effective `aria-expanded`.
   *
   * An overlay-enabled field is a dialog trigger and owns this attribute
   * itself; otherwise it mirrors the consumer's popup state.
   */
  protected readonly _resolvedAriaExpanded = computed(() =>
    this._overlayEnabled() ? this.opened() : this.ariaExpanded(),
  );

  /** @protected Whether the clear action should currently be rendered. */
  protected readonly _showClear = computed(
    () => this.clearable() && this.value().length > 0 && !this.disabled(),
  );

  /**
   * @protected Whether the trailing submit action should be rendered.
   *
   * An overlay-enabled field never shows it: the inline input is a trigger, so
   * there is nothing to submit from it — the query is typed in the overlay.
   */
  protected readonly _showSubmitAction = computed(
    () =>
      this.trigger() === 'submit' &&
      this.showSubmit() &&
      !this._overlayEnabled(),
  );

  /**
   * @protected Whether the leading search icon should be rendered.
   *
   * The field carries exactly one search glyph: trailing when there is a submit
   * action to hang it on, leading otherwise. Live mode has no submit action, and
   * neither does a submit-mode field with {@link showSubmit} turned off.
   */
  protected readonly _showLeadingIcon = computed(
    () => !this._showSubmitAction(),
  );

  /**
   * @protected Whether the trailing spinner is rendered as its own element.
   *
   * The submit action carries its own loading state, so a second spinner beside
   * it would be redundant. Without a submit action the field needs one of its own.
   */
  protected readonly _showStandaloneLoader = computed(
    () => this.loading() && !this._showSubmitAction(),
  );

  /** @private Last query emitted by live mode, used to suppress duplicates. */
  private _lastLiveQuery: string | null = null;

  /** @private Marks model writes originating from this control's own UI. */
  private _interactionValue: string | undefined;

  /** @private Pending live-search timer, when a debounce window is active. */
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;

  /** @protected Backdrop class; the base appends `--leaving` on close. */
  protected override readonly _backdropClass = 'mlv-search-field__backdrop';

  /** @protected Attaches the overlay panel template. */
  protected override _getOverlayTemplate(): TemplateRef<unknown> | undefined {
    return this._overlayTemplate();
  }

  /** @protected Full-viewport overlay: a plain global strategy, sized by config. */
  protected override _buildPositionStrategy(): PositionStrategy {
    return this._overlay.position().global();
  }

  /** @protected Makes the pane cover the viewport so the body can centre within it. */
  protected override _buildExtraOverlayConfig(): OverlayConfig {
    return {
      width: '100%',
      height: '100%',
      panelClass: 'mlv-search-field__overlay-pane',
    };
  }

  /** Reconciles controlled values and registers timer cleanup. */
  constructor() {
    super();

    effect(() => {
      const value = this.value();
      if (this._interactionValue === value) {
        this._interactionValue = undefined;
        return;
      }

      // A parent-owned value supersedes both the captured debounce and the
      // duplicate baseline. The same query must be eligible to emit again
      // after a controlled reset.
      this._interactionValue = undefined;
      this._cancelPending();
      this._lastLiveQuery = null;
    });

    inject(DestroyRef).onDestroy(() => this._cancelPending());
  }

  /** @protected Opens the overlay if it is enabled and not already open. */
  protected _openOverlay(): void {
    if (this.disabled() || !this._overlayEnabled() || this.opened()) return;

    this.open();
  }

  /**
   * @protected Opens the overlay from a click on the inline trigger.
   *
   * The handler sits on the `mlv-input` host, so clicks on the field's own
   * actions — the clear button — bubble through here too. Only the input itself
   * is the trigger, so clearing a committed query does not force the overlay open.
   *
   * Deliberately not bound to focus. WAI-ARIA treats the control that opens a
   * dialog as a button, activated by click or Enter/Space; opening on focus traps
   * a keyboard user who is only tabbing past, and fights the focus the overlay
   * restores to this same input on close — which would reopen it immediately.
   */
  protected _onTriggerClick(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;

    this._openOverlay();
  }

  /**
   * @protected Opens the overlay from Space on the inline trigger.
   *
   * The trigger is `readonly` while the overlay is enabled, so Space types
   * nothing; `preventDefault` stops it from scrolling the page instead.
   */
  protected _onTriggerSpace(event: Event): void {
    if (!this._overlayEnabled() || this.disabled()) return;

    event.preventDefault();
    this._openOverlay();
  }

  /**
   * @protected Commits from inside the overlay.
   *
   * Submit mode has a commit action; live mode has already emitted through the
   * debounce, so Enter there only dismisses. Either way the overlay closes, which
   * restores focus to the trigger.
   */
  protected _submitFromOverlay(): void {
    if (this.trigger() === 'submit') {
      this._submit();
    }
    this.close();
  }

  /** @protected Commits and closes when Enter is pressed on the overlay input. */
  protected _onOverlayEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.isComposing) return;

    // The field commonly sits inside a form; handle Enter here rather than
    // letting it submit the surrounding form.
    event.preventDefault();
    this._submitFromOverlay();
  }

  /** @protected Synchronises user input and schedules a live search if enabled. */
  protected _onValueChange(value: string): void {
    if (this.disabled()) return;

    this._setInteractionValue(value);
    if (this.trigger() === 'live') {
      this._scheduleLive(value);
    } else {
      this._cancelPending();
    }
  }

  /**
   * @protected Handles a non-composing Enter on the inline field.
   *
   * With the overlay enabled the field is a dialog trigger, so Enter opens it;
   * otherwise Enter commits a submit-mode search. Either way the key is consumed:
   * search fields commonly live inside forms, and neither action should also
   * submit the surrounding form.
   */
  protected _onEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.isComposing) return;

    if (this._overlayEnabled()) {
      event.preventDefault();
      this._openOverlay();
      return;
    }

    if (this._consumerHandledCommit(event)) return;

    if (this.trigger() !== 'submit') return;

    event.preventDefault();
    this._submit();
  }

  /**
   * @protected Reports an option-navigation key while the field is a combobox.
   *
   * Silent for the default `role="searchbox"`, so a plain search field keeps
   * every key it has today. See {@link navigate} for which keys are consumed.
   */
  protected _onNavigationKey(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.isComposing) return;
    if (this.role() !== 'combobox' || this.disabled()) return;

    const key = this._rtlService.normalizeArrowKey(event);
    const direction =
      key === UP_ARROW
        ? 'up'
        : key === DOWN_ARROW
          ? 'down'
          : NAVIGATION_KEYS.get(event.key);
    if (direction === undefined) return;

    if (CONSUMED_DIRECTIONS.has(direction)) {
      event.preventDefault();
    }
    this.navigate.emit({ direction, event });
  }

  /** @protected Commits from the trailing submit action, offering it up first. */
  protected _onSubmitClick(event: MouseEvent): void {
    if (this._consumerHandledCommit(event)) return;

    this._submit();
  }

  /**
   * @private Offers the commit to the consumer and reports whether they took it.
   *
   * Nothing is offered while the field cannot commit anyway — disabled or with
   * a request already in flight — so `commit` never fires for an interaction
   * the field itself would have ignored.
   */
  private _consumerHandledCommit(event: KeyboardEvent | MouseEvent): boolean {
    if (this.disabled() || this.loading()) return false;

    this.commit.emit({ value: this.value(), event });
    return event.defaultPrevented;
  }

  /** @protected Commits the current value from the submit action button. */
  protected _submit(): void {
    if (this.disabled() || this.loading() || this.trigger() !== 'submit') {
      return;
    }

    this._cancelPending();
    this.search.emit(this.value());
  }

  /** @protected Clears immediately and invalidates any pending live query. */
  protected _clear(): void {
    if (this.disabled()) return;

    this._cancelPending();
    this._setInteractionValue('');
    if (this.commitOnClear()) {
      this._lastLiveQuery = '';
      this.search.emit('');
    }
  }

  /** @private Starts or immediately resolves the trailing live-search window. */
  private _scheduleLive(value: string): void {
    this._cancelPending();

    const delay = this.debounce();
    if (delay === 0) {
      this._emitLive(value);
      return;
    }

    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = null;
      if (this.trigger() === 'live' && !this.disabled()) {
        this._emitLive(value);
      }
    }, delay);
  }

  /** @private Emits a live query only when it differs from the prior one. */
  private _emitLive(value: string): void {
    if (value === this._lastLiveQuery) return;

    this._lastLiveQuery = value;
    this.search.emit(value);
  }

  /** @private Writes a user-originated value without treating it as controlled input. */
  private _setInteractionValue(value: string): void {
    this._interactionValue = value;
    this.value.set(value);
  }

  /** @private Cancels and forgets the current live-search timer. */
  private _cancelPending(): void {
    if (this._pendingTimer === null) return;

    clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
  }
}
