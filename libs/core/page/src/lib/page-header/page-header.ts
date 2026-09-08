import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LucideChevronUp } from '@lucide/angular';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvPageSnapController } from '../page/page-snap-controller';
import { registerPageRegion } from '../page/page-geometry';
import { MLV_PAGE_HEADER_STATE } from './page-header-state';
import type { MlvPageHeaderState } from './page-header-state';
import { MlvPageTitle } from './page-header.directives';

/**
 * The header never pins itself: `followsChromeDefault` hands that decision to
 * the page, which owns the scrollport. Module-level so every header shares one
 * node instead of allocating a constant signal each.
 */
const NEVER_STICKY_ON_ITS_OWN = signal(false).asReadonly();

/** Visual scale of the page header. */
export type MlvPageHeaderSize = 'm' | 's';

/** Horizontal alignment of the tabs row inside the page header. */
export type MlvPageHeaderTabsAlign = 'start' | 'center';

/**
 * Structured page heading. Every region is a **projected element the consumer
 * owns** — `[mlvPageContext]`, `[mlvPageStatus]`, `[mlvPageActions]`,
 * `[mlvPageDescription]`, `[mlvPageMeta]`, `[mlvPageTabs]` — plus one
 * template, `[mlvPageTitle]`, which is a template because the header renders
 * it twice.
 *
 * Region *order* is still the header's: the projection sites are in this
 * template, so a consumer cannot put actions before the title. What they gain
 * is that the projected node is their own element, selectable and stylable
 * without piercing encapsulation, never re-instantiated when a sibling region
 * appears or disappears, and carrying its own defaults instead of another
 * input on this component.
 *
 * Inside `main[mlvPage]` the header participates in the scroll-scrubbed snap
 * timeline (`--mlv-page-snap`). **The title block collapses; the navigation
 * does not** — the description and the meta row give up their height, the
 * title crossfades between two complete type roles, and the context row, the
 * tabs and the actions stay exactly where they are. Both platforms make that
 * choice for the same reason: navigation is the thing a reader needs *most*
 * once scrolled.
 *
 * The collapse state is readable without wiring anything, either by injecting
 * {@link MLV_PAGE_HEADER_STATE} from a projected region or off a template
 * reference variable:
 *
 * ```html
 * <mlv-page-header #header="mlvPageHeader">…</mlv-page-header>
 * ```
 */
@Component({
  selector: 'mlv-page-header',
  exportAs: 'mlvPageHeader',
  imports: [NgTemplateOutlet, LucideChevronUp, MlvButton],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_PAGE_HEADER_STATE, useExisting: MlvPageHeader }],
  host: {
    class: 'mlv-page-header',
    'data-slot': 'page-header',
    '[class.mlv-page-header--size-s]': 'size() === "s"',
    '[class.mlv-page-header--tabs-center]': 'tabsAlign() === "center"',
    '[class.mlv-page-header--scrolled]': '_scrolled()',
    '[style.--mlv-page-header-title-size]': '_titleSize()',
    '[style.--mlv-page-header-title-collapsed-size]': '_titleCollapsedSize()',
  },
})
export class MlvPageHeader implements MlvPageHeaderState {
  /**
   * Visual scale. `'m'` is the default hero header; `'s'` is the compact
   * single-row variant for record-editor pages, with a smaller title scale.
   */
  readonly size = input<MlvPageHeaderSize>('m');

  /** Aligns the tabs row to the start (default) or centers it. */
  readonly tabsAlign = input<MlvPageHeaderTabsAlign>('start');

  /**
   * Shows the chevron that expands snapped chrome, as a trailing control in
   * the title row. Requires the header to be inside `main[mlvPage]`.
   */
  readonly snapControls = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Accessible label for the chevron that expands the snapped chrome. */
  readonly expandLabel = input('Expand header');

  /** @protected Page title template projected via `[mlvPageTitle]`. */
  protected readonly _titleRef = contentChild(MlvPageTitle);

  /** @private Snap controller of the owning page, when rendered inside one. */
  private readonly _snap = inject(MlvPageSnapController, { optional: true });

  /** @private The expanded title node, measured for the collapse distance. */
  private readonly _titleLarge =
    viewChild<ElementRef<HTMLElement>>('titleLarge');

  /** @private The collapsed title node, measured for the collapse distance. */
  private readonly _titleSmall =
    viewChild<ElementRef<HTMLElement>>('titleSmall');

  /** @protected Measured block size of the expanded title node, in pixels. */
  protected readonly _titleBlockSize = signal(0);

  /** @protected Measured block size of the collapsed title node, in pixels. */
  protected readonly _titleCollapsedBlockSize = signal(0);

  /** @private Whether the expanded title node overflows its inline size. */
  private readonly _titleLargeClipped = signal(false);

  /** @private Whether the collapsed title node overflows its inline size. */
  private readonly _titleSmallClipped = signal(false);

  /** @protected Expanded title height as a CSS length; the scrub's upper end. */
  protected readonly _titleSize = computed(() => `${this._titleBlockSize()}px`);

  /** @protected Collapsed title height as a CSS length; the scrub's floor. */
  protected readonly _titleCollapsedSize = computed(
    () => `${this._titleCollapsedBlockSize()}px`,
  );

  /**
   * @private What the title block gives up on the timeline: the difference
   * between the two rendered type roles, measured rather than declared. This
   * is the term that makes the collapse distance right for a header whose only
   * collapsing chrome is its own title.
   */
  private readonly _titleCollapse = computed(() =>
    Math.max(0, this._titleBlockSize() - this._titleCollapsedBlockSize()),
  );

  /** Collapse fraction of the owning page: 0 expanded .. 1 fully snapped. */
  readonly progress = computed(() => this._snap?.progress() ?? 0);

  /** True while the chrome is closer to snapped than expanded. */
  readonly collapsed = computed(() => this._snap?.snapped() ?? false);

  /**
   * True while the title node currently on screen is wider than its box.
   * Reported, never acted on: how a truncated title should degrade — a
   * tooltip, a shorter string, a second line — is the consumer's decision.
   */
  readonly titleClipped = computed(() =>
    this.collapsed() ? this._titleSmallClipped() : this._titleLargeClipped(),
  );

  /** @protected Alias of {@link collapsed} for this component's own template. */
  protected readonly _snapped = this.collapsed;

  /**
   * Moves focus to the page title, whichever of the two type roles is the one
   * on screen. Returns whether focus actually landed, so a caller with a
   * fallback can tell — a header rendered without a `[mlvPageTitle]` has
   * nothing to focus.
   *
   * This exists because the title template is instantiated **twice** and only
   * one copy is live: a consumer that put `tabindex="-1"` on its own heading
   * would be focusing whichever copy the DOM happened to return first, which
   * is `inert` half the time and silently refuses focus. Route-level
   * "back to the top" handlers call this instead.
   */
  focusTitle(): boolean {
    const node = (this.collapsed() ? this._titleSmall() : this._titleLarge())
      ?.nativeElement;
    if (!node) {
      return false;
    }
    node.focus();
    return node.ownerDocument.activeElement === node;
  }

  /**
   * @protected The controller behind the expand chevron, exposed only while
   * the chrome is actually snapped: expanding an expanded header does nothing,
   * so the control would be a dead tab stop the rest of the time.
   */
  protected readonly _expandControl = computed(() =>
    this.snapControls() && this._snap && this._snapped() ? this._snap : null,
  );

  /**
   * @protected True while the header sits over content rather than at the head
   * of it. Deliberately the *overlap* signal, not the collapse fraction: chrome
   * pinned at full height still has to paint its separation from the content
   * scrolling underneath it.
   */
  protected readonly _scrolled = computed(
    () => this._snap?.overlapped() ?? false,
  );

  constructor() {
    const resizeObserver = inject(MlvResizeObserverService);
    const destroyRef = inject(DestroyRef);
    const unregisterCollapse = this._snap?.registerCollapse(
      this._titleCollapse,
    );
    destroyRef.onDestroy(() => unregisterCollapse?.());

    afterNextRender(() => {
      // Both title nodes are always rendered — that is what makes the collapse
      // a crossfade instead of a font-size interpolation — so both can be
      // measured. Neither is clamped individually; only their shared grid cell
      // is, so `scrollHeight` is the natural height of each role.
      for (const [ref, blockSize, clipped] of [
        [this._titleLarge(), this._titleBlockSize, this._titleLargeClipped],
        [
          this._titleSmall(),
          this._titleCollapsedBlockSize,
          this._titleSmallClipped,
        ],
      ] as const) {
        const element = ref?.nativeElement;
        if (!element) {
          continue;
        }
        const measure = (): void => {
          blockSize.set(element.scrollHeight);
          // One device pixel of slack: a fractional layout size rounds
          // `scrollWidth` up and would otherwise report every title clipped.
          clipped.set(element.scrollWidth > element.clientWidth + 1);
        };
        measure();
        const subscription = resizeObserver.observe(element).subscribe(measure);
        destroyRef.onDestroy(() => subscription.unsubscribe());
      }

      this._warnOnDuplicatedTitleIds();
    });

    // The header is the page's block-start chrome. It registers rather than
    // being found by a selector, so a header rendered by an `@if` or wrapped
    // in a `<form>` publishes its geometry like any other.
    //
    // `sticky` is a constant `false` and `followsChromeDefault` is what
    // actually decides: whether the header sticks is the *page's* call, because
    // the page owns the scrollport it would stick to. The header used to carry
    // a duplicate `sticky` input, which could disagree with
    // `main[mlvPage] [stickyHeader]` in either direction — a header that
    // painted itself sticky over a scrollport reserving no clearance for it, or
    // the reverse.
    registerPageRegion({
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      edge: 'block-start',
      sticky: NEVER_STICKY_ON_ITS_OWN,
      followsChromeDefault: true,
    });
  }

  /**
   * @private Warns when the projected title carries an `id` of its own.
   *
   * The title template is rendered once per type role, so a static `id`
   * written inside it lands in the document twice — `getElementById` then
   * answers with whichever copy is first, which is the `inert` one whenever
   * the header is collapsed. Generated ids differ per instance and are
   * therefore silent; only an id that actually collides is reported.
   */
  private _warnOnDuplicatedTitleIds(): void {
    if (!isDevMode()) {
      return;
    }
    const large = this._titleLarge()?.nativeElement;
    const small = this._titleSmall()?.nativeElement;
    if (!large || !small) {
      return;
    }
    const ids = new Set(
      Array.from(large.querySelectorAll('[id]'), (el) => el.id),
    );
    const duplicated = Array.from(
      small.querySelectorAll('[id]'),
      (el) => el.id,
    ).filter((id) => ids.has(id));
    if (duplicated.length === 0) {
      return;
    }
    console.warn(
      `[mlv-page-header] The [mlvPageTitle] template carries id(s) ` +
        `${duplicated.join(', ')}. It is rendered once per type role, so each ` +
        `id is now in the document twice and getElementById answers with the ` +
        `copy that is inert while the header is collapsed. Keep identity out ` +
        `of the title template; use the header's focusTitle() to move focus ` +
        `to the title.`,
    );
  }
}
