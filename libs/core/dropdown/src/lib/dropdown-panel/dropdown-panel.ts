import type { TemplateRef } from '@angular/core';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvList,
  MlvListItem,
  MlvListItemSelectable,
  MlvListSelectable,
} from '@malva-ui/core/list';
import { LucideCheck } from '@lucide/angular';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvInfiniteScroll } from '@malva-ui/cdk/infinite-scroll';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvSelectOption } from '../select-option';
import { hasOptionGroups } from '../select-option';
import { optionId } from '../active-descendant';
import { MlvHighlightMatchPipe } from '../highlight-match.pipe';
import { fromEvent, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * One option within a rendered group, paired with its flat index into the
 * panel's `options()` array. The flat index (not a group-local index) is what
 * the panel forwards to {@link MlvDropdownPanel.optionId} and matches
 * against `activeIndex`, so an owning combobox's activedescendant model stays
 * aligned regardless of grouping.
 */
interface DropdownOptionEntry<T> {
  readonly option: MlvSelectOption<T>;
  readonly index: number;
}

/**
 * A rendered cluster of consecutive options that share the same group label.
 * `label`/`headerId` are `null` for an ungrouped (headerless) run.
 */
interface DropdownOptionGroup<T> {
  readonly label: string | null;
  readonly headerId: string | null;
  readonly entries: DropdownOptionEntry<T>[];
}

@Component({
  selector: 'mlv-dropdown-panel',
  imports: [
    NgTemplateOutlet,
    MlvList,
    MlvListItem,
    MlvListItemSelectable,
    MlvListSelectable,
    LucideCheck,
    MlvHighlightMatchPipe,
    MlvScrollbar,
    MlvInfiniteScroll,
  ],
  templateUrl: './dropdown-panel.html',
  styleUrl: './dropdown-panel.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-dropdown-panel',
    '[class.mlv-dropdown-panel--parent-scroll]': 'scrollMode() === "parent"',
    '[class.mlv-dropdown-panel--loading]': 'loading()',
    '[style.max-height.px]': '_calculatedMaxHeight()',
  },
})
export class MlvDropdownPanel<T> {
  /**
   * Chooses the single scroll owner for this panel.
   *
   * Standalone panels scroll themselves. Panels composed inside `mlv-popup`
   * delegate to the popup so the DOM never contains nested scroll regions.
   */
  readonly scrollMode = input<'self' | 'parent'>('self');

  readonly minHeight = input<number>(0);
  readonly maxHeight = input<number>(0);
  readonly options = input<MlvSelectOption<T>[]>([]);
  /** Whether multiple options can be selected. */
  readonly multiple = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  readonly selectedValues = input<T[]>([]);
  readonly itemTemplate = input<TemplateRef<{
    $implicit: MlvSelectOption<T>;
  }> | null>(null);
  /**
   * Focus strategy forwarded to the inner aria listbox.
   *
   * - `'roving'` (default) — DOM focus moves onto the active option (`tabindex`).
   *   Used by `mlv-select`.
   * - `'activedescendant'` — DOM focus stays on the owning trigger/input; the
   *   active option is tracked via `aria-activedescendant`. Used by
   *   `mlv-combobox`, whose text input must retain focus so typing keeps
   *   working while navigating options.
   */
  readonly focusMode = input<'roving' | 'activedescendant'>('roving');
  /**
   * Index of the option that is visually "active" (highlighted) under the
   * activedescendant model. `-1` (default) means no active option. The panel
   * renders a deterministic `[id]` on each option (`<listboxId>-option-<index>`)
   * so an owning combobox can point its input's `aria-activedescendant` at the
   * active row and keep the highlight in sync.
   */
  readonly activeIndex = input<number>(-1);
  /**
   * Optional HTML `id` to assign to the inner `<mlv-list>` listbox element.
   * Allows a parent combobox or select to reference this listbox via `aria-controls`.
   */
  readonly listboxId = input<string | null>(null);

  /**
   * Accessible name rendered as `aria-label` on the inner listbox. `role="listbox"`
   * is an ARIA input field, so a panel that is not already named through an owning
   * control (`mlv-filter`'s popover, for instance) needs one to satisfy WCAG 4.1.2.
   * `null` (default) renders no attribute.
   */
  readonly ariaLabel = input<string | null>(null);

  /**
   * When non-empty, the default option row emphasises the matched substring of
   * this query inside each suggestion label (case- and diacritic-insensitive;
   * see {@link MlvHighlightMatchPipe}). Ignored for rows rendered by a custom
   * {@link itemTemplate}. Empty (default) renders the label as plain text —
   * ungrouped, un-highlighted lists are byte-for-byte unchanged.
   */
  readonly highlightQuery = input<string>('');

  /**
   * When `true`, the panel renders a loading affordance instead of the option
   * list / empty state — used by `[mlvAutocomplete]` while an async `search`
   * resolves. The {@link loadingText} is announced politely.
   */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Text shown (and announced) inside the loading affordance while
   * {@link loading} is `true`. Localise by binding a translated string.
   * @default 'Loading…'
   */
  readonly loadingText = input<string>('Loading…');

  /**
   * When `true`, a page beyond the first is being fetched: renders a polite
   * bottom status row (`loadingText`) after the last option. The listbox and
   * existing options stay interactive.
   * @default false
   */
  readonly loadingMore = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether more pages exist. When `true` the panel observes its scroll owner
   * and emits {@link loadMore} as the user nears the end of the list.
   * @default false
   */
  readonly hasMore = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Distance (px) from the end of the scroll owner at which {@link loadMore} fires. */
  readonly infiniteScrollThreshold = input<number>(150);

  /** Emits when the user scrolls within `infiniteScrollThreshold` of the end while `hasMore`. */
  readonly loadMore = output<void>();

  /**
   * @protected Effective listbox id forwarded to the aria `Listbox.id` input on
   * the inner `<mlv-list>`. Uses the consumer-provided {@link listboxId} when
   * set, otherwise a stable generated fallback so the rendered listbox always
   * carries a valid unique DOM id (aria would otherwise mint its own, breaking
   * a parent trigger's `aria-controls` linkage).
   */
  protected readonly _resolvedListboxId = computed(
    () => this.listboxId() ?? this._fallbackListboxId,
  );

  /** @private Stable generated id used when no `listboxId` is supplied. */
  private readonly _fallbackListboxId = mlvNextId('mlv-dropdown-listbox');

  /**
   * @protected Whether the current options declare groups (at least one option
   * carries a non-empty `group`). When `false` the template renders the exact
   * flat option list as before — plain / ungrouped arrays are unaffected.
   */
  protected readonly _isGrouped = computed(() =>
    hasOptionGroups(this.options()),
  );

  /**
   * @protected The options clustered into consecutive same-group runs for
   * rendering under sticky headers. Consecutive-run grouping (no reordering)
   * keeps DOM order identical to the flat `options()` order, so option indices,
   * `optionId`, `activeIndex`, and aria's DOM-order navigation all stay aligned.
   * Each entry retains its flat index into `options()`. A run of options without
   * a group (empty/undefined) becomes a headerless cluster (`label: null`).
   */
  protected readonly _groups = computed<DropdownOptionGroup<T>[]>(() => {
    const listboxId = this._resolvedListboxId();
    const groups: DropdownOptionGroup<T>[] = [];
    this.options().forEach((option, index) => {
      const label = option.group ? option.group : null;
      const current = groups[groups.length - 1];
      if (current && current.label === label) {
        current.entries.push({ option, index });
      } else {
        groups.push({
          label,
          headerId: label ? `${listboxId}-group-${groups.length}` : null,
          entries: [{ option, index }],
        });
      }
    });
    return groups;
  });

  /**
   * @protected Effective max panel height in px — the `maxHeight` input when
   * set, else the viewport-derived default.
   *
   * `null` while neither is resolved, so the host emits no `max-height` at all
   * rather than a `0px` that would collapse the panel. That is the state a
   * server render is always in: the viewport height is a browser measurement,
   * and the real value lands on the first browser render.
   */
  protected readonly _calculatedMaxHeight = computed<number | null>(() => {
    const inputMaxHeight = this.maxHeight();
    if (inputMaxHeight > 0) return inputMaxHeight;
    const viewportMaxHeight = this._defaultMaxHeight();
    return viewportMaxHeight > 0 ? viewportMaxHeight : null;
  });

  readonly valueChange = output<readonly T[]>();

  /** @private Selection service coordinating focus-first requests from a parent select/combobox. */
  private readonly _selectionService = inject(MlvSelectionService);
  /** @private Set of currently selected values for O(1) membership checks. */
  private readonly _selectedSet = computed(
    () => new Set(this.selectedValues()),
  );
  /** @private Default max panel height (px) derived from the viewport height. */
  private readonly _defaultMaxHeight = signal(0);
  /** @private The inner selectable list directive, used to move focus to the first option. */
  private readonly _listSelectable = viewChild(MlvListSelectable);

  /** @private The panel's own scrollbar (`scrollMode="self"` only). */
  private readonly _scrollbar = viewChild(MlvScrollbar);

  /** @private The sentinel-hosted infinite-scroll directive, re-checked after each option append. */
  private readonly _infiniteScroll = viewChild(MlvInfiniteScroll);

  /**
   * @protected The element that actually scrolls: the panel's own scrollbar
   * viewport (`scrollMode="self"`) or the nearest ancestor `mlv-scrollbar`
   * viewport — the owning `mlv-popup`'s — in parent mode. Resolved after the
   * first render; the sentinel directive stays disabled until then.
   */
  protected readonly _scrollContainer = signal<HTMLElement | null>(null);

  /**
   * @private Whether the scroll-owner lookup has already run. It needs the first
   * render, so a `null` {@link _scrollContainer} before that means "not resolved
   * yet", not "no owner" — the dev warning must not fire on it.
   */
  private readonly _scrollOwnerResolved = signal(false);

  /** @private Latches the dev-mode "no scroll owner" warning to once per panel. */
  private _warnedNoScrollOwner = false;

  /** @private Host element, used to scroll the active option into view (activedescendant model). */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** @private Angular-provided document used to access the browser viewport safely. */
  private readonly _document = inject(DOCUMENT);
  /** @private Whether this panel is running in a browser — the viewport height only exists there. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // Deliberately platform-gated rather than merely `defaultView`-gated: a
    // server document *has* a `defaultView`, but no `innerHeight`, so the
    // subscription used to publish `NaN` into `[style.max-height.px]` on every
    // server render.
    const viewport = this._isBrowser ? this._document.defaultView : null;
    if (viewport) {
      fromEvent(viewport, 'resize')
        .pipe(startWith(null), takeUntilDestroyed())
        .subscribe(() => {
          this._defaultMaxHeight.set(viewport.innerHeight * 0.4);
        });
    }

    this._selectionService.focusFirst$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this._listSelectable()?.focusFirst();
      });

    // Keep the activedescendant-active option scrolled into view. DOM focus
    // never lands on the option in this mode (it stays on the owning combobox
    // input), so the native scroll-on-focus does not apply.
    effect(() => {
      const index = this.activeIndex();
      if (this.focusMode() !== 'activedescendant' || index < 0) return;
      const el = this._host.nativeElement.querySelector<HTMLElement>(
        `[id="${this.optionId(index)}"]`,
      );
      // Optional call: `scrollIntoView` is absent in some environments (jsdom).
      el?.scrollIntoView?.({ block: 'nearest' });
    });

    // Resolve the paging sentinel's scroll owner once the view exists: the
    // panel's own scrollbar viewport, or the ancestor popup viewport it
    // delegates scrolling to.
    afterNextRender(() => {
      const own = this._scrollbar()?.viewportElement ?? null;
      const parent = this._host.nativeElement.closest<HTMLElement>(
        '.mlv-scrollbar__viewport',
      );
      this._scrollContainer.set(this.scrollMode() === 'self' ? own : parent);
      this._scrollOwnerResolved.set(true);
    });

    // Dev-mode diagnostic: an armed sentinel with no scroll owner is silent —
    // `scrollMode="parent"` finds nothing unless the panel renders inside an
    // `mlv-scrollbar` viewport. Re-checked reactively so a `hasMore` that flips
    // true later is caught too; warned at most once per panel instance.
    if (isDevMode()) {
      effect(() => {
        const missing =
          this.hasMore() &&
          this._scrollOwnerResolved() &&
          this._scrollContainer() === null;
        if (!missing) return;
        untracked(() => {
          if (this._warnedNoScrollOwner) return;
          this._warnedNoScrollOwner = true;
          console.warn(
            '[mlv-dropdown-panel] hasMore is set but no scroll owner was found — in scrollMode="parent" the panel must render inside an mlv-scrollbar viewport (e.g. mlv-popup); lazy paging will not fire.',
          );
        });
      });
    }

    // Auto-fill: after any render where the option set changed, re-measure so a
    // short page immediately requests the next one.
    afterRenderEffect(() => {
      this.options();
      this._infiniteScroll()?.check();
    });
  }

  isValueSelected(value: T): boolean {
    return this._selectedSet().has(value);
  }

  /**
   * Deterministic DOM `id` for the option at `index`, forwarded to aria's
   * `ngOption` id. An owning combobox computes the same id (via the shared
   * {@link optionId} helper) to wire its input's `aria-activedescendant`.
   */
  optionId(index: number): string {
    return optionId(this._resolvedListboxId(), index);
  }

  /**
   * Re-emits the aria listbox selection. `@angular/aria`'s `ngListbox` emits the
   * selected values array directly (unlike CdkListbox's `ListboxValueChangeEvent`).
   */
  onValueChange(values: readonly T[]): void {
    this.valueChange.emit(values);
  }
}
