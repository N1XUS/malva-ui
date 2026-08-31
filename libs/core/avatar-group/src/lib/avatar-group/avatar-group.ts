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

/** Avatar size to pixel mapping (matches mlv-avatar SCSS size tokens). */
const AVATAR_SIZE_PX: Record<MlvAvatarSize, number> = {
  xs: 24,
  s: 32,
  m: 40,
  l: 56,
  xl: 80,
  xxl: 96,
};

/**
 * Overlap in pixels per size — the absolute value of the negative
 * `margin-left` applied to stacked avatars in avatar-group.scss.
 */
const AVATAR_OVERLAP_PX: Record<MlvAvatarSize, number> = {
  xs: 4,
  s: 6,
  m: 8,
  l: 10,
  xl: 12,
  xxl: 14,
};

/**
 * Avatar group component rendering a horizontal stack of overlapping `mlv-avatar` instances.
 *
 * The visible count is calculated automatically based on the component's container width —
 * no manual `max` input is needed. When members overflow, an avatar-styled `+N` counter
 * is appended. Hovering or focusing the counter opens a popup listing every member.
 * Clicking anywhere on the host emits `groupClick`; clicking the `+N` counter also
 * emits `overflowClick`.
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
    '[attr.role]': 'interactive() ? "button" : "group"',
    '[attr.tabindex]': 'interactive() && members().length > 0 ? 0 : null',
    '[attr.aria-label]': '_hostAriaLabel()',
    '(click)': '_onHostClick()',
    '(keydown)': '_onHostKeydown($event)',
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
   * When `true`, the group is exposed as a keyboard-operable button.
   */
  readonly interactive = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits the full member array when the user clicks anywhere on the group host.
   */
  readonly groupClick = output<MlvAvatarGroupMember[]>();

  /**
   * Emits the hidden (overflow) members when the user clicks the `+N` counter avatar.
   * Event propagation is stopped before the host `groupClick` fires separately.
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

  /** Measured width of the host element in pixels. 0 = not yet measured. */
  private readonly _containerWidth = signal(0);

  /** Avatar size in pixels for the current `size()` input. */
  private readonly _avatarSizePx = computed(() => AVATAR_SIZE_PX[this.size()]);

  /**
   * Maximum total avatars (visible + overflow) that fit in the current container.
   * Returns `Infinity` before the first ResizeObserver measurement so that
   * all members are shown during the initial render pass.
   */
  private readonly _maxFit = computed(() => {
    const w = this._containerWidth();
    if (w <= 0) return Infinity;

    const avatarPx = this._avatarSizePx();
    const overlapPx = AVATAR_OVERLAP_PX[this.size()];
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
        this._containerWidth.set(width);
      });
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  /** Handles click on the overflow counter avatar. */
  protected _onOverflowClick(event: MouseEvent): void {
    event.stopPropagation();
    this.overflowClick.emit(this._hiddenMembers());
  }

  /** Handles keydown on the overflow counter avatar. */
  protected _onOverflowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    this.overflowClick.emit(this._hiddenMembers());
  }

  /** Handles click on the group host. */
  protected _onHostClick(): void {
    if (this.members().length > 0) {
      this.groupClick.emit(this.members());
    }
  }

  /** Activates an interactive group with the standard button keys. */
  protected _onHostKeydown(event: KeyboardEvent): void {
    if (
      !this.interactive() ||
      this.members().length === 0 ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return;
    }

    event.preventDefault();
    this.groupClick.emit(this.members());
  }
}
