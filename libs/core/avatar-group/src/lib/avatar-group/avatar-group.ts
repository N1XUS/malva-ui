import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import type { MlvAvatarSize, MlvAvatarShape } from '@malva-ui/core/avatar';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MLV_AVATAR_GROUP_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  MlvPopup,
  MlvPopupTrigger,
  MlvPopupContent,
} from '@malva-ui/core/popup';

/**
 * Represents a single member in the avatar group.
 * Provides enough data to render a `mlv-avatar` for each member.
 */
export interface MlvAvatarGroupMember {
  /** Full display name — used for initials derivation, popup label, and aria-label. */
  name: string;
  /** Optional image URL. Falls back to initials or color on error. */
  src?: string | null;
  /** Explicit initials string; overrides name-derived initials. */
  initials?: string;
  /** CSS color for the avatar background. Defaults to a deterministic color from name. */
  color?: string;
}

/**
 * Avatar edge length per size, in rem — `--mlv-avatar-size` on
 * `.mlv-avatar--<size>` in `mlv-avatar`'s stylesheet. Kept in rem, not px:
 * the fit multiplies it by the root font size read with each measurement,
 * because a browser font-size preference scales rem but not px (#356).
 * Pinned to the compiled stylesheet, with {@link AVATAR_OVERLAP_REM}, by
 * `avatar-group-rem-fit.spec.ts`.
 */
const AVATAR_SIZE_REM: Record<MlvAvatarSize, number> = {
  xs: 1.5,
  s: 2,
  m: 2.5,
  l: 3.5,
  xl: 5,
  xxl: 6,
};

/**
 * Overlap per size, in rem — the magnitude of the negative
 * `--mlv-ag-overlap` inline-start margin applied to stacked avatars in
 * avatar-group.scss.
 */
const AVATAR_OVERLAP_REM: Record<MlvAvatarSize, number> = {
  xs: 0.25,
  s: 0.375,
  m: 0.5,
  l: 0.625,
  xl: 0.75,
  xxl: 0.875,
};

/**
 * Root font size (the size of `1rem`) assumed before the first measurement
 * and whenever the computed value cannot be read — the CSS initial `medium`.
 */
const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/**
 * Avatar group component rendering a horizontal stack of overlapping `mlv-avatar` instances.
 *
 * The visible count is calculated automatically based on the component's container width —
 * no manual `max` input is needed. When members overflow, an avatar-styled `+N` counter
 * is appended. Hovering or focusing the counter opens a popup listing every member.
 * Clicking anywhere on the host emits `groupClick`; clicking the `+N` counter
 * emits `overflowClick` instead.
 *
 * The host is always a named `role="group"`. Under `interactive` the visible
 * avatars sit inside an inner `<button>` (`.mlv-avatar-group__action`) that is
 * the keyboard and assistive-technology route to `groupClick`, and the `+N`
 * counter is a separate `<button>` beside it — never nested inside it (#328).
 *
 * The component fills its parent (uses `width: 100%` flex layout). Set a width or
 * `max-width` on the host to constrain the visible count.
 *
 * @example
 * ```html
 * <mlv-avatar-group
 *   [members]="team"
 *   size="m"
 *   (groupClick)="openMembersPanel($event)"
 *   style="max-width: 200px"
 * />
 * ```
 */
@Component({
  selector: 'mlv-avatar-group',
  templateUrl: './avatar-group.html',
  styleUrl: './avatar-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvAvatar,
    MlvColorFromTextPipe,
    MlvPopup,
    MlvPopupTrigger,
    MlvPopupContent,
  ],
  host: {
    class: 'mlv-avatar-group',
    '[class]': '"mlv-avatar-group--size-" + size()',
    '[class.mlv-avatar-group--interactive]': 'interactive()',
    role: 'group',
    '[attr.aria-label]': '_hostAriaLabel()',
    '(click)': '_onHostClick()',
  },
})
export class MlvAvatarGroup {
  /**
   * The full list of members to represent.
   * How many are visible is determined automatically by the container width.
   */
  readonly members = input<MlvAvatarGroupMember[]>([]);

  /**
   * Size variant applied to all avatars (including the overflow counter avatar).
   * Matches `MlvAvatarSize`: `'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'`.
   * Defaults to `'m'`.
   */
  readonly size = input<MlvAvatarSize>('m');

  /**
   * Shape applied to all avatars in the group.
   * Defaults to `'circle'`.
   */
  readonly shape = input<MlvAvatarShape>('circle');

  /**
   * When `true`, the visible avatars render inside an inner action
   * `<button>` (`.mlv-avatar-group__action`, named like the group) — a tab stop
   * that emits `groupClick` on Enter, Space and assistive-technology
   * activation — and the host shows a pointer cursor. The host itself stays a
   * `role="group"` and takes no tab stop, so the `+N` counter is a sibling
   * button rather than one nested inside a button. An empty group renders no
   * action button.
   */
  readonly interactive = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits the full member array when the user clicks anywhere on the group
   * host, or — under `interactive` — activates its inner action button. Not
   * emitted for an empty group, nor for a click on the `+N` counter.
   */
  readonly groupClick = output<MlvAvatarGroupMember[]>();

  /**
   * Emits the hidden (overflow) members when the user activates the `+N`
   * counter button — a click, Enter or Space. Propagation is stopped, so the
   * host does not also emit `groupClick`.
   */
  readonly overflowClick = output<MlvAvatarGroupMember[]>();

  // ── Private state ──────────────────────────────────────────────────────────

  /** @private Host element ref, observed for width to auto-calculate the visible count. */
  private readonly _el = inject(ElementRef<HTMLElement>);
  /** @private Shared resize-observer service used to track the host width. */
  private readonly _resizeService = inject(MlvResizeObserverService);
  /** @private Localised avatar-group messages. */
  private readonly _i18n = inject(MLV_AVATAR_GROUP_I18N);
  /** @private ICU resolver for count-aware accessible labels. */
  private readonly _resolver = inject(MlvI18nResolverService);
  /**
   * @private Injected document. The root font size is read through its
   * `defaultView`, never the ambient `document` / `getComputedStyle` globals
   * (#337), which under server rendering are not this render's document.
   */
  private readonly _document = inject(DOCUMENT);

  /** @private Measured width of the host element in pixels. 0 = not yet measured. */
  private readonly _containerWidth = signal(0);

  /**
   * @private Size of `1rem` in pixels, read from the root element with every
   * host measurement — so never on the server, where no measurement arrives.
   * A root font-size change resizes the rendered avatars and with them the
   * host's content-box height, so the same observer delivers the new value
   * even when the width stays put — unless something other than the avatars
   * sets the host's height (an explicit `height`, or a taller flex / grid
   * sibling it stretches to), in which case the next width change picks it
   * up.
   */
  private readonly _rootFontSizePx = signal(DEFAULT_ROOT_FONT_SIZE_PX);

  /**
   * @private Maximum total avatars (visible + overflow) that fit in the
   * current container, counted in rendered pixels: the rem geometry times the
   * root font size. Returns `Infinity` before the first ResizeObserver
   * measurement so that all members are shown during the initial render pass.
   */
  private readonly _maxFit = computed(() => {
    const w = this._containerWidth();
    if (w <= 0) return Infinity;

    const remPx = this._rootFontSizePx();
    const avatarPx = AVATAR_SIZE_REM[this.size()] * remPx;
    const overlapPx = AVATAR_OVERLAP_REM[this.size()] * remPx;
    const effectivePx = avatarPx - overlapPx; // width each additional avatar adds

    if (effectivePx <= 0) return 1;
    return Math.max(1, Math.floor((w - avatarPx) / effectivePx) + 1);
  });

  // ── Protected computed ─────────────────────────────────────────────────────

  /** Members within the auto-calculated visible limit — rendered as individual avatars. */
  protected readonly _visibleMembers = computed(() => {
    const all = this.members();
    const maxFit = this._maxFit();
    if (all.length <= maxFit) return all;
    // Reserve 1 slot for the overflow counter avatar; always show at least 1.
    return all.slice(0, Math.max(1, maxFit - 1));
  });

  /** Members beyond the visible limit — shown in the overflow popup. */
  protected readonly _hiddenMembers = computed(() =>
    this.members().slice(this._visibleMembers().length),
  );

  /** Number of hidden members. */
  protected readonly _overflowCount = computed(
    () => this._hiddenMembers().length,
  );

  /** Whether the overflow counter avatar should render. */
  protected readonly _hasOverflow = computed(() => this._overflowCount() > 0);

  /**
   * Whether the visible avatars render inside the inner action button: an
   * interactive group with at least one member. An empty group gets none,
   * because `groupClick` is suppressed there and the button would be a named
   * tab stop that does nothing.
   */
  protected readonly _actionable = computed(
    () => this.interactive() && this.members().length > 0,
  );

  /** Label shown inside the overflow counter avatar, e.g. `"+5"`. */
  protected readonly _overflowLabel = computed(
    () => `+${this._overflowCount()}`,
  );

  /** Accessible label for the group host element. */
  protected readonly _hostAriaLabel = computed(() => {
    const total = this.members().length;
    const visible = this._visibleMembers().length;
    if (total === 0) return this._i18n().noMembers;
    const key = this._hasOverflow() ? 'visibleMembers' : 'memberCount';
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      key,
      { total, visible },
    );
  });

  /** Localised label for the overflow trigger. */
  protected readonly _overflowAriaLabel = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'moreMembers',
      { count: this._overflowCount() },
    ),
  );

  /** Localised label for the complete member list. */
  protected readonly _allMembersLabel = computed(() => this._i18n().allMembers);

  constructor() {
    this._resizeService
      .observe(this._el)
      .pipe(takeUntilDestroyed())
      .subscribe((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        this._rootFontSizePx.set(this._readRootFontSizePx());
        this._containerWidth.set(width);
      });
  }

  /**
   * @private The root element's computed `font-size` in pixels — what `1rem`
   * resolves to. Called only from the resize callback, which never fires on
   * the server. Falls back to {@link DEFAULT_ROOT_FONT_SIZE_PX} when the
   * document has no view, or the value does not parse or is 0.
   */
  private _readRootFontSizePx(): number {
    const view = this._document.defaultView;
    if (!view) return DEFAULT_ROOT_FONT_SIZE_PX;
    const px = parseFloat(
      view.getComputedStyle(this._document.documentElement).fontSize,
    );
    return Number.isFinite(px) && px > 0 ? px : DEFAULT_ROOT_FONT_SIZE_PX;
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  /**
   * Handles a click on the `+N` counter button — a pointer click, or the click
   * the browser fires for Enter / Space on it, so no keydown handler is bound
   * beside it (#299). Stops propagation so the host does not also emit
   * `groupClick`.
   */
  protected _onOverflowClick(event: MouseEvent): void {
    event.stopPropagation();
    this.overflowClick.emit(this._hiddenMembers());
  }

  /**
   * Handles a click anywhere on the host. Under `interactive` this is also
   * where the inner action button's click lands — the pointer's, or the one
   * the browser fires for Enter / Space / assistive-technology activation —
   * so the button binds no listener of its own and each activation emits
   * once.
   */
  protected _onHostClick(): void {
    if (this.members().length > 0) {
      this.groupClick.emit(this.members());
    }
  }
}
