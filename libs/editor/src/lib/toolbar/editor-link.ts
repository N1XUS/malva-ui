import type { Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { getMarkRange } from '@tiptap/core';
import { LucideLink } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_REVISION,
} from '../editor-toolbar-context';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';
import { MlvSwitch } from '@malva-ui/core/switch';

interface EditorLinkSelection {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly linked: boolean;
}

/** Safe URL and label editor for the active Tiptap link mark. */
@Component({
  selector: 'mlv-editor-link',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideLink,
    MlvEditorToolbarWidget,
    MlvInput,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvSwitch,
  ],
  templateUrl: './editor-link.html',
  styleUrl: './editor-link.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-link',
    '[hidden]': '!_supported()',
  },
})
export class MlvEditorLink {
  /**
   * URL schemes accepted by Malva before the active Tiptap Link extension
   * applies its own configured protocol policy.
   */
  readonly allowedProtocols = input<readonly string[]>([
    'https',
    'http',
    'mailto',
    'tel',
  ]);

  /** @protected Editor-scoped command and form state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Toolbar transaction/selection invalidation state. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });

  /** @private Detached panel ownership for composite focus. */
  private readonly _overlays = inject(MLV_EDITOR_OVERLAY_REGISTRY);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @protected Popup controller owned by the trigger. */
  protected readonly _popup = viewChild.required<MlvPopup>('_popup');

  /** @protected Connected trigger controller. */
  protected readonly _trigger = viewChild.required<MlvPopupTrigger>('_trigger');

  /** @protected Native trigger restored after popup teardown. */
  protected readonly _triggerElement = viewChild.required('_triggerElement', {
    read: ElementRef,
  }) as Signal<ElementRef<HTMLButtonElement>>;

  /** @protected URL field focused on open. */
  protected readonly _urlInput = viewChild.required<MlvInput>('_urlInput');

  /** @private Detached panel queried through Angular rather than selectors. */
  private readonly _panel = viewChild<ElementRef<HTMLElement>>('_panel');

  /** @protected URL draft retained when validation fails. */
  protected readonly _urlDraft = signal('');

  /** @protected Linked/selected text draft. */
  protected readonly _textDraft = signal('');

  /** @protected Whether the link should open in a new browsing context. */
  protected readonly _newTab = signal(false);

  /** @protected Whether the current URL draft failed strict policy. */
  protected readonly _invalid = signal(false);

  /** @protected Whether the currently edited range already carries a link. */
  protected readonly _canRemove = signal(false);

  /** @private Whole mark or selected range retained while focus is detached. */
  private _selection: EditorLinkSelection | null = null;

  /** @protected Reactive localized copy for trigger, fields, and actions. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      link: copy?.link ?? 'Link',
      linkUrl: copy?.linkUrl ?? 'Link URL',
      linkText: copy?.linkText ?? 'Link text',
      invalidLink: copy?.invalidLink ?? 'Enter a valid link URL.',
      openInNewTab: copy?.openInNewTab ?? 'Open in new tab',
      applyLink: copy?.applyLink ?? 'Apply link',
      removeLink: copy?.removeLink ?? 'Remove link',
    };
  });

  /** @protected Exact command presence without dispatching a transaction. */
  protected readonly _supported = computed(() => {
    this._revision?.();
    const commands = this._context.editor()?.commands as
      | Record<string, unknown>
      | undefined;
    return (
      typeof commands?.['setLink'] === 'function' &&
      typeof commands['unsetLink'] === 'function'
    );
  });

  /** @protected Link mark state at the retained editor selection. */
  protected readonly _active = computed(() => {
    this._revision?.();
    return this._context.isActive('link');
  });

  /** @protected Whether readonly/disabled state blocks the complete popup. */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );

  constructor() {
    effect(() => {
      if (this._disabled() && this._popup().opened()) {
        this._popup().opened.set(false);
      }
    });

    effect((onCleanup) => {
      const panel = this._panel()?.nativeElement;
      if (!panel) return;
      const unregister = this._overlays.register(panel, () =>
        this._popup().opened.set(false),
      );
      onCleanup(unregister);
    });
  }

  /** @protected Preloads the active whole-link range or current selection. */
  protected _onOpened(): void {
    const editor = this._context.editor();
    if (!editor || this._disabled()) {
      this._popup().opened.set(false);
      return;
    }
    const selection = editor.state.selection;
    const linkType = editor.schema.marks['link'];
    const markRange = linkType
      ? getMarkRange(selection.$from, linkType)
      : undefined;
    const linked = Boolean(markRange && editor.isActive('link'));
    const from = linked && markRange ? markRange.from : selection.from;
    const to = linked && markRange ? markRange.to : selection.to;
    const text = editor.state.doc.textBetween(from, to, ' ');
    const attributes = linked ? editor.getAttributes('link') : {};
    this._selection = { from, to, text, linked };
    this._canRemove.set(linked);
    this._urlDraft.set(
      typeof attributes['href'] === 'string' ? attributes['href'] : '',
    );
    this._textDraft.set(text);
    this._newTab.set(attributes['target'] === '_blank');
    this._invalid.set(false);
    queueMicrotask(() => {
      if (!this._popup().opened()) return;
      this._urlInput().focus();
      this._urlInput().select();
    });
  }

  /** @protected Restores the connected toolbar trigger after final teardown. */
  protected _onClosed(): void {
    if (!this._disabled() && this._triggerElement().nativeElement.isConnected) {
      this._triggerElement().nativeElement.focus();
    }
  }

  /** @protected Clears stale validation as the user edits without closing. */
  protected _onUrlChange(value: string): void {
    this._urlDraft.set(value);
    this._invalid.set(false);
  }

  /** @protected Applies an inserted or updated link after both policy checks. */
  protected _apply(): void {
    const selection = this._selection;
    const href = this._validateUrl(this._urlDraft());
    if (!selection || !href) {
      this._invalid.set(true);
      return;
    }
    const text = this._textDraft() || href;
    const applied = this._context.run((editor) =>
      this._applyToEditor(editor, selection, href, text),
    );
    if (applied) {
      this._trigger().close();
    } else {
      this._invalid.set(true);
    }
  }

  /** @protected Removes only the link mark while retaining its text. */
  protected _remove(): void {
    const selection = this._selection;
    if (!selection) return;
    const removed = this._context.run((editor) =>
      editor
        .chain()
        .setTextSelection({ from: selection.from, to: selection.to })
        .unsetLink()
        .run(),
    );
    if (removed) this._trigger().close();
  }

  /** @private Preflights Link policy before replacing text and applying attributes. */
  private _applyToEditor(
    editor: Editor,
    selection: EditorLinkSelection,
    href: string,
    text: string,
  ): boolean {
    const newTab = this._newTab();
    const attributes = {
      href,
      target: newTab ? '_blank' : null,
      rel: newTab ? 'noopener noreferrer' : null,
    };
    const canApplyLink = editor
      .can()
      .chain()
      .setTextSelection({ from: selection.from, to: selection.to })
      .setLink(attributes)
      .run();
    if (!canApplyLink) return false;

    let range = { from: selection.from, to: selection.to };
    let chain = editor.chain().setTextSelection(range);
    if (text !== selection.text) {
      chain = chain.insertContentAt(range, { type: 'text', text });
      range = { from: range.from, to: range.from + text.length };
      chain = chain.setTextSelection(range);
    }
    return chain.setLink(attributes).run();
  }

  /** @private Strict scheme allowlist validation before Tiptap's own policy. */
  private _validateUrl(draft: string): string | null {
    const href = draft.trim();
    if (!href || /^(?:\/\/|\/|\?|#)/.test(href)) return null;
    const match = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(href);
    if (!match) return null;
    const scheme = match[1]?.toLowerCase();
    const schemeValue = match[2]?.trim() ?? '';
    if (!scheme || !schemeValue || !this._normalizedProtocols().has(scheme)) {
      return null;
    }
    if (scheme === 'http' || scheme === 'https') {
      try {
        const parsed = new URL(href);
        if (parsed.protocol !== `${scheme}:` || !parsed.hostname) return null;
      } catch {
        return null;
      }
    }
    return href;
  }

  /** @private Trims, lowercases, and removes trailing colons from the API input. */
  private _normalizedProtocols(): ReadonlySet<string> {
    return new Set(
      this.allowedProtocols()
        .map((protocol) => protocol.trim().toLowerCase().replace(/:+$/, ''))
        .filter(Boolean),
    );
  }
}
