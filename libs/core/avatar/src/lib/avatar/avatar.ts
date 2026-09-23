import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MlvFade } from '@malva-ui/cdk/utils';

/** Available size variants for the avatar component. */
export type MlvAvatarSize = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

/** Available shape variants for the avatar component. */
export type MlvAvatarShape = 'circle' | 'square';

/**
 * Derives initials from a name string.
 * Takes the first letter of each space-separated part, max 2.
 *
 * @example
 * deriveInitials('John Doe')         // 'JD'
 * deriveInitials('Alice')            // 'A'
 * deriveInitials('John Michael Doe') // 'JD'
 * deriveInitials('')                 // ''
 */
export function deriveInitials(name: string): string {
  if (!name || !name.trim()) {
    return '';
  }
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/**
 * Avatar component displaying a user or entity representation.
 *
 * Supports image URLs, text initials (explicit or derived from a name),
 * arbitrary projected content (e.g. icons), and an optional label below.
 *
 * Content priority: `src` image > `initials`/`name` > `ng-content`.
 *
 * @example
 * ```html
 * <mlv-avatar name="John Doe" [color]="'John Doe' | mlvColorFromText" />
 * <mlv-avatar src="https://example.com/avatar.jpg" label="John Doe" />
 * <mlv-avatar size="xl" shape="square" initials="JD" color="hsl(228, 60%, 82%)" />
 * ```
 */
@Component({
  selector: 'mlv-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvFade],
  host: {
    class: 'mlv-avatar',
    '[class]': '"mlv-avatar--" + size()',
    '[class.mlv-avatar--circle]': 'shape() === "circle"',
    '[class.mlv-avatar--square]': 'shape() === "square"',
    // Expose the avatar as a single labelled image to assistive tech when it
    // represents a named entity. Without a name there is nothing to label, so
    // the role is omitted (the visible initials/content speak for themselves)
    // rather than emitting a nameless `role="img"`.
    '[attr.role]': '_accessibleName() ? "img" : null',
    '[attr.aria-label]': '_accessibleName()',
  },
})
export class MlvAvatar {
  /**
   * The size variant of the avatar.
   * Maps to predefined width/height and font-size values.
   */
  readonly size = input<MlvAvatarSize>('m');

  /**
   * The shape of the avatar visual container.
   * `circle` is fully rounded; `square` uses `--mlv-radius-2` (8px).
   */
  readonly shape = input<MlvAvatarShape>('circle');

  /**
   * Optional image URL. When provided, the avatar displays an image.
   * A loading skeleton is shown while the image loads.
   * On error, falls back to initials or projected content.
   */
  readonly src = input<string | null>(null);

  /**
   * A name string from which initials are automatically derived.
   * Takes the first character of each space-separated word, up to 2 characters.
   * E.g. "John Doe" → "JD", "Alice" → "A", "John Michael Doe" → "JD".
   * Ignored when `initials` is explicitly set.
   */
  readonly name = input<string>('');

  /**
   * Explicit initials string. When provided, overrides initials derived from `name`.
   */
  readonly initials = input<string>('');

  /**
   * CSS color value for the avatar background — an identity tint.
   * Accepts any valid CSS color: hex, rgb, hsl, CSS custom property reference.
   *
   * A tint is theme-independent, so its initials and projected content are
   * painted in the equally theme-independent `--mlv-palette-neutral-800`.
   * Pass a **pale** tint (the `mlvColorFromText` band, lightness ~80%): that
   * foreground clears WCAG AA on it, and would not on a mid or dark fill.
   * When empty (the default) the avatar renders the theme's neutral pair,
   * `--mlv-background-neutral-1` under `--mlv-text-primary`.
   */
  readonly color = input<string>('');

  /**
   * Optional label text displayed below the avatar.
   * Long text is gracefully faded at the edges using `MlvFade`.
   */
  readonly label = input<string>('');

  /**
   * @internal Whether the image has successfully loaded.
   */
  protected readonly _imageLoaded = signal(false);

  /**
   * @internal Whether the image encountered a load error.
   */
  protected readonly _imageError = signal(false);

  /**
   * @internal Inline background of the visual: the `color` tint, or `null`
   * so the stylesheet's theme pair applies. The old default bound
   * `var(--mlv-text-secondary)` here, a mid grey under 0.8-opacity dark
   * initials (1.72:1 in light, #302).
   */
  protected readonly _backgroundColor = computed(() => this.color() || null);

  /**
   * @internal Inline foreground of the visual, paired with `_backgroundColor`:
   * a fixed dark neutral while a tint is set (the tint does not follow the
   * theme, so neither may its text), otherwise `null` so the theme's
   * `--mlv-text-primary` applies. Initials and projected content inherit it.
   */
  protected readonly _foregroundColor = computed(() =>
    this.color() ? 'var(--mlv-palette-neutral-800)' : null,
  );

  /**
   * @internal Resolved initials to display.
   * Uses explicit `initials` input first, then derives from `name`.
   */
  protected readonly _resolvedInitials = computed(() => {
    const explicit = this.initials();
    if (explicit) {
      return explicit;
    }
    return deriveInitials(this.name());
  });

  /**
   * @internal Accessible name for the avatar as a whole.
   * Prefers the display `name`, falling back to the `label`. Returns `null`
   * when neither is set so the host stays role-less (see host bindings).
   */
  protected readonly _accessibleName = computed(
    () => this.name().trim() || this.label().trim() || null,
  );

  /**
   * @internal Whether to show the image element (src provided and no error).
   */
  protected readonly _showImage = computed(() => {
    return !!this.src() && !this._imageError();
  });

  /**
   * @internal Whether to show the loading skeleton.
   */
  protected readonly _showSkeleton = computed(() => {
    return !!this.src() && !this._imageLoaded() && !this._imageError();
  });

  /**
   * @internal Whether to show initials (no valid image, and initials are available).
   */
  protected readonly _showInitials = computed(() => {
    return !this._showImage() && !!this._resolvedInitials();
  });

  /**
   * @internal Whether to show projected ng-content (no valid image and no initials).
   */
  protected readonly _showContent = computed(() => {
    return !this._showImage() && !this._resolvedInitials();
  });

  /**
   * @internal Label words split for individual MlvFade wrapping.
   */
  protected readonly _labelWords = computed(() => {
    const l = this.label();
    if (!l || !l.trim()) {
      return [];
    }
    return l.trim().split(/\s+/);
  });

  /**
   * @internal Handles the image load event.
   */
  protected _onImageLoad(): void {
    this._imageLoaded.set(true);
  }

  /**
   * @internal Handles the image error event.
   */
  protected _onImageError(): void {
    this._imageError.set(true);
  }
}
