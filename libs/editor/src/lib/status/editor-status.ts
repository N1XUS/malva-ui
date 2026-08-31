import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import {
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { normalizeMlvEditorCharacterLimit } from '../extensions/editor-extensions';

/** Runtime CharacterCount storage kept optional for literal extension replacement. */
interface CharacterCountStorage {
  readonly characters?: () => number;
  readonly words?: () => number;
}

/** Public character and word summary for the nearest editor context. */
@Component({
  selector: 'mlv-editor-status',
  templateUrl: './editor-status.html',
  styleUrl: './editor-status.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-status',
    '[hidden]': '!available()',
  },
})
export class MlvEditorStatus {
  /** Optional maximum character count; invalid values mean unlimited. */
  readonly characterLimit = input<number | null>(null);

  /** Current character count, or zero when CharacterCount is unavailable. */
  readonly characters = computed(() => {
    this._revision();
    const storage = this._storage();
    return storage?.characters?.() ?? 0;
  });

  /** Current Unicode-whitespace-aware word count. */
  readonly words = computed(() => {
    this._revision();
    const storage = this._storage();
    return storage?.words?.() ?? 0;
  });

  /** Whether the active extension set exposes CharacterCount storage. */
  readonly available = computed(() => this._storage() !== null);

  /** @protected Normalized limit displayed by the summary. */
  protected readonly _limit = computed(() =>
    normalizeMlvEditorCharacterLimit(this.characterLimit()),
  );

  /** @protected Accessible count and remaining-limit description. */
  protected readonly _ariaLabel = computed(() => {
    const characters = this.characters();
    const words = this.words();
    const limit = this._limit();
    if (limit === null) return `${characters} characters, ${words} words`;
    return `${Math.max(0, limit - characters)} characters remaining, ${characters} of ${limit} characters, ${words} words`;
  });

  /** @private Nearest public editor command context. */
  private readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Invalidates storage reads after transactions and selections. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION);

  /** @private Safely resolves optional Tiptap CharacterCount storage. */
  private readonly _storage = computed<CharacterCountStorage | null>(() => {
    this._revision();
    const editor = this._context.editor();
    if (!editor) return null;
    const storage = (
      editor.storage as unknown as Record<
        string,
        CharacterCountStorage | undefined
      >
    )['characterCount'];
    return typeof storage?.characters === 'function' ? storage : null;
  });
}
