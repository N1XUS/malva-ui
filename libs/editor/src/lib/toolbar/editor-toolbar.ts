import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { BooleanInput } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  Injectable,
  PLATFORM_ID,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { TemplateRef } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type { Signal, WritableSignal } from '@angular/core';
import { LucideEllipsis } from '@lucide/angular';
import type {
  MlvEditorError,
  MlvEditorFormat,
  MlvEditorImageUploadControl,
} from '../editor.types';
import {
  MlvFade,
  MlvResizeObserverService,
  MlvRtlService,
} from '@malva-ui/cdk/utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
  MLV_EDITOR_TOOLBAR_ROVING,
  MLV_EDITOR_TOOLBAR_REVISION,
  MlvEditorOverlayRegistry,
  MlvEditorToolbarRovingRegistry,
  MlvEditorToolbarRevision,
  type MlvEditorToolbarContext,
} from '../editor-toolbar-context';
import { MlvEditorAlignment } from './editor-alignment';
import { MlvEditorBlockInsert } from './editor-block-insert';
import { MlvEditorHeading } from './editor-heading';
import { MlvEditorHighlight } from './editor-highlight';
import { MlvEditorInlineMarks } from './editor-inline-marks';
import { MlvEditorList } from './editor-list';
import { MlvEditorLink } from './editor-link';
import { MlvEditorImageUpload } from './editor-image-upload';
import { MlvEditorTable } from './editor-table';
import { MlvEditorUndoRedo } from './editor-undo-redo';
import { MlvEditorZoom } from './editor-zoom';
import { MlvEditorTextColor } from './editor-text-color';
import { MlvEditorToolbarWidget } from './editor-toolbar-widget';

/** @internal Named roving-focus root used by editor and compatibility toolbar shells. */
@Directive({
  selector: '[mlvEditorToolbarRoot]',
  exportAs: 'mlvEditorToolbarRoot',
  host: {
    class: 'mlv-editor-toolbar',
    '[class.mlv-editor-toolbar--narrow]': 'narrow()',
    role: 'toolbar',
    '[attr.aria-label]': 'resolvedAriaLabel()',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-disabled]': 'disabled() || null',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MlvEditorToolbarRoot {
  /** Whether the toolbar has entered its compact overflow layout. */
  readonly narrow = signal(false);
  /** Accessible toolbar name. */
  readonly ariaLabel = input<string | undefined>(undefined);
  /** Whether the composite toolbar is unavailable. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Keyboard-navigation axis. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Whether arrow navigation wraps at the boundaries. */
  readonly wrap = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /** @internal Editor-scoped focus registry. */
  private readonly _registry = inject(MLV_EDITOR_TOOLBAR_ROVING);
  /** @internal Transaction state that re-evaluates disabled toolbar widgets. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @internal Optional localized defaults. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /**
   * @internal Actual composite-root element. Also the scope the horizontal
   * roving arrows resolve their direction against.
   */
  private readonly _element = inject<ElementRef<HTMLElement>>(ElementRef);
  /** @internal Root teardown lifecycle. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @internal Avoids DOM observers during server rendering. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** @internal Shared observer abstraction for responsive width changes. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);
  /** @internal Normalizes horizontal arrow meaning for RTL toolbars. */
  private readonly _rtlService = inject(MlvRtlService);
  /**
   * @internal Direction applying to this toolbar, resolved once and cached
   * behind the shared `dir` observer rather than re-walked on every arrow
   * keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._element,
  );

  constructor() {
    effect(() => {
      this._revision?.();
      this._registry.setDisabled(this.disabled());
    });
    if (this._isBrowser) {
      this._destroyRef.onDestroy(
        this._registry.connect(this._element.nativeElement),
      );
      this._resizeObserver
        .observe(this._element)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((entries) => {
          const width = entries[entries.length - 1]?.contentRect.width;
          if (width !== undefined && width > 0) this.narrow.set(width < 640);
        });
    }
  }

  /** @internal Resolves the user or localized toolbar label. */
  protected resolvedAriaLabel(): string {
    return this.ariaLabel() ?? this._i18n?.().toolbarLabel ?? 'Editor toolbar';
  }

  /** @internal Handles roving navigation from the host metadata event binding. */
  protected handleKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this._registry.focusBoundary(event.key === 'Home' ? 'start' : 'end');
      return;
    }
    // Resolved against the toolbar root, not the document: direction is scoped,
    // so a toolbar inside a `dir` subtree — or inside a CDK overlay pane, which
    // is stamped with its own `dir` — must mirror on its own reading.
    const key = this._rtlService.normalizeArrowKey(event, this._direction());
    const direction =
      this.orientation() === 'vertical'
        ? key === UP_ARROW
          ? -1
          : key === DOWN_ARROW
            ? 1
            : undefined
        : key === LEFT_ARROW
          ? -1
          : key === RIGHT_ARROW
            ? 1
            : undefined;
    if (!direction) return;
    event.preventDefault();
    this._registry.move(target, direction, this.wrap());
  }
}

/** @internal Responsive menu containing commands removed from the primary row. */
@Component({
  selector: 'mlv-editor-toolbar-overflow',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
    LucideEllipsis,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvEditorToolbarWidget,
  ],
  template: `
    <button
      mlvButton
      mlvEditorToolbarWidget
      type="button"
      shape="circle"
      variant="transparent"
      [attr.aria-label]="_copy().moreFormatting"
      [disabled]="_context.disabled()"
      [mlvMenuTrigger]="_menu"
      [menuTriggerDisabled]="_context.disabled()"
      [mlvTooltip]="_copy().moreFormatting"
      (menuOpened)="_registerOverlay()"
      (menuClosed)="_unregisterOverlay()"
    >
      <svg mlvButtonIcon lucideEllipsis aria-hidden="true" />
    </button>
    <mlv-menu #_menu [label]="_copy().moreFormatting">
      @if (_supported('toggleBold')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canBold)"
          [attr.aria-current]="_context.isActive('bold') ? 'true' : null"
          (itemClick)="_run(_bold)"
          >{{ _copy().bold }}</mlv-list-item
        >
      }
      @if (_supported('toggleItalic')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canItalic)"
          [attr.aria-current]="_context.isActive('italic') ? 'true' : null"
          (itemClick)="_run(_italic)"
          >{{ _copy().italic }}</mlv-list-item
        >
      }
      @if (_supported('toggleStrike')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canStrike)"
          [attr.aria-current]="_context.isActive('strike') ? 'true' : null"
          (itemClick)="_run(_strike)"
          >{{ _copy().strike }}</mlv-list-item
        >
      }
      @if (_supported('toggleUnderline')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canUnderline)"
          [attr.aria-current]="_context.isActive('underline') ? 'true' : null"
          (itemClick)="_run(_underline)"
          >{{ _copy().underline }}</mlv-list-item
        >
      }
      @if (_supported('setTextAlign')) {
        @for (alignment of _alignments(); track alignment.value) {
          <mlv-list-item
            mlvMenuItem
            [disabled]="_commandDisabled(_canAlign(alignment.value))"
            [attr.aria-current]="
              _context.isActive('paragraph', { textAlign: alignment.value })
                ? 'true'
                : null
            "
            (itemClick)="_run(_align(alignment.value))"
            >{{ alignment.label }}</mlv-list-item
          >
        }
      }
      @if (_supported('toggleBlockquote')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canBlockquote)"
          [attr.aria-current]="_context.isActive('blockquote') ? 'true' : null"
          (itemClick)="_run(_blockquote)"
          >{{ _copy().blockquote }}</mlv-list-item
        >
      }
      @if (_supported('toggleCodeBlock')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canCodeBlock)"
          [attr.aria-current]="_context.isActive('codeBlock') ? 'true' : null"
          (itemClick)="_run(_codeBlock)"
          >{{ _copy().codeBlock }}</mlv-list-item
        >
      }
      @if (_supported('setHorizontalRule')) {
        <mlv-list-item
          mlvMenuItem
          [disabled]="_commandDisabled(_canHorizontalRule)"
          (itemClick)="_run(_horizontalRule)"
          >{{ _copy().horizontalRule }}</mlv-list-item
        >
      }
    </mlv-menu>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-toolbar__overflow',
    '[hidden]': '!_root.narrow()',
  },
})
export class MlvEditorToolbarOverflow {
  /** @protected Responsive state owned by the enclosing toolbar root. */
  protected readonly _root = inject(MlvEditorToolbarRoot);
  /** @protected Editor-scoped command state. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);
  /** @private Command-state invalidation signal. */
  private readonly _revision = inject(MLV_EDITOR_TOOLBAR_REVISION, {
    optional: true,
  });
  /** @private Roving coordinator used to recover focus after wide layout returns. */
  private readonly _roving = inject(MLV_EDITOR_TOOLBAR_ROVING);
  /** @private Detached overlay registry. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );
  /** @private Document used after a browser menu opens. */
  private readonly _document = inject(DOCUMENT);
  /** @private Teardown scope for a currently open menu. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Optional reactive localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });
  /** @protected Rendered overflow menu. */
  protected readonly _menu = viewChild.required<MlvMenu>('_menu');
  /** @protected Trigger that owns the overflow menu. */
  protected readonly _trigger = viewChild.required(MlvMenuTrigger);
  /** @private Current detached-overlay registration. */
  private _unregister: (() => void) | undefined;
  /** @private Guards queued registration after close. */
  private _menuOpen = false;
  /** @private Previous responsive state used to identify a narrow-to-wide edge. */
  private _wasNarrow = false;

  /** @protected Formatting order retained when controls move into overflow. */
  protected readonly _alignments = computed(() => [
    { value: 'left', label: this._copy().alignLeft },
    { value: 'center', label: this._copy().alignCenter },
    { value: 'right', label: this._copy().alignRight },
    { value: 'justify', label: this._copy().alignJustify },
  ]);
  /** @protected Reactive localized copy for every overflow command. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      moreFormatting: copy?.moreFormatting ?? 'More formatting',
      bold: copy?.bold ?? 'Bold',
      italic: copy?.italic ?? 'Italic',
      strike: copy?.strike ?? 'Strike-through',
      underline: copy?.underline ?? 'Underline',
      alignLeft: copy?.alignLeft ?? 'Align left',
      alignCenter: copy?.alignCenter ?? 'Align center',
      alignRight: copy?.alignRight ?? 'Align right',
      alignJustify: copy?.alignJustify ?? 'Justify',
      blockquote: copy?.blockquote ?? 'Blockquote',
      codeBlock: copy?.codeBlock ?? 'Code block',
      horizontalRule: copy?.horizontalRule ?? 'Horizontal rule',
    };
  });

  /** @protected Bold toggle command. */
  protected readonly _bold = (editor: Editor): boolean =>
    editor.chain().focus().toggleBold().run();
  /** @protected Italic toggle command. */
  protected readonly _italic = (editor: Editor): boolean =>
    editor.chain().focus().toggleItalic().run();
  /** @protected Strike toggle command. */
  protected readonly _strike = (editor: Editor): boolean =>
    editor.chain().focus().toggleStrike().run();
  /** @protected Underline toggle command. */
  protected readonly _underline = (editor: Editor): boolean =>
    editor.chain().focus().toggleUnderline().run();
  /** @protected Blockquote toggle command. */
  protected readonly _blockquote = (editor: Editor): boolean =>
    editor.chain().focus().toggleBlockquote().run();
  /** @protected Code-block toggle command. */
  protected readonly _codeBlock = (editor: Editor): boolean =>
    editor.chain().focus().toggleCodeBlock().run();
  /** @protected Horizontal-rule insertion command. */
  protected readonly _horizontalRule = (editor: Editor): boolean =>
    editor.chain().focus().setHorizontalRule().run();
  /** @protected Non-mutating bold capability check. */
  protected readonly _canBold = (editor: Editor): boolean =>
    editor.can().chain().toggleBold().run();
  /** @protected Non-mutating italic capability check. */
  protected readonly _canItalic = (editor: Editor): boolean =>
    editor.can().chain().toggleItalic().run();
  /** @protected Non-mutating strike capability check. */
  protected readonly _canStrike = (editor: Editor): boolean =>
    editor.can().chain().toggleStrike().run();
  /** @protected Non-mutating underline capability check. */
  protected readonly _canUnderline = (editor: Editor): boolean =>
    editor.can().chain().toggleUnderline().run();
  /** @protected Non-mutating blockquote capability check. */
  protected readonly _canBlockquote = (editor: Editor): boolean =>
    editor.can().chain().toggleBlockquote().run();
  /** @protected Non-mutating code-block capability check. */
  protected readonly _canCodeBlock = (editor: Editor): boolean =>
    editor.can().chain().toggleCodeBlock().run();
  /** @protected Non-mutating horizontal-rule capability check. */
  protected readonly _canHorizontalRule = (editor: Editor): boolean =>
    editor.can().chain().setHorizontalRule().run();

  constructor() {
    effect(() => {
      const narrow = this._root.narrow();
      const wasNarrow = this._wasNarrow;
      this._wasNarrow = narrow;
      if (narrow || !wasNarrow || !this._menuOpen) return;
      this._menu().close();
      queueMicrotask(() => this._roving.focusBoundary('start'));
    });
    this._destroyRef.onDestroy(() => this._unregisterOverlay());
  }

  /** @protected Whether the active extension set registered a command. */
  protected _supported(command: string): boolean {
    this._revision?.();
    const editor = this._context.editor();
    if (!editor) return false;
    return (
      typeof (editor.commands as unknown as Record<string, unknown>)[
        command
      ] === 'function'
    );
  }

  /** @protected Alignment command factory. */
  protected _align(value: string): (editor: Editor) => boolean {
    return (editor) => editor.chain().focus().setTextAlign(value).run();
  }

  /** @protected Non-mutating alignment capability factory. */
  protected _canAlign(value: string): (editor: Editor) => boolean {
    return (editor) => editor.can().chain().setTextAlign(value).run();
  }

  /** @protected Whether the command is blocked or unsupported. */
  protected _commandDisabled(command: (editor: Editor) => boolean): boolean {
    this._revision?.();
    if (this._context.disabled() || this._context.readonly()) return true;
    try {
      return !this._context.can(command);
    } catch {
      return true;
    }
  }

  /** @protected Executes one overflow command through the context guard. */
  protected _run(command: (editor: Editor) => boolean): void {
    this._context.run(command);
  }

  /** @protected Registers the detached overflow panel with composite focus. */
  protected _registerOverlay(): void {
    this._menuOpen = true;
    queueMicrotask(() => {
      if (!this._menuOpen) return;
      const panel = this._document.getElementById(this._menu().panelId);
      if (!panel) return;
      this._unregister?.();
      this._unregister = this._overlays.register(panel, () =>
        this._trigger().close(),
      );
    });
  }

  /** @protected Releases focus ownership after close. */
  protected _unregisterOverlay(): void {
    this._menuOpen = false;
    this._unregister?.();
    this._unregister = undefined;
  }
}

/** @internal Defers public-toolbar context reads until Angular has assigned inputs. */
@Injectable()
class MlvEditorToolbarContextProxy implements MlvEditorToolbarContext {
  /** @internal Owning public toolbar component. */
  private readonly _toolbar = inject(MlvEditorToolbar);

  /** Editor instance supplied through the public context input. */
  get editor(): Signal<Editor | null> {
    return this._toolbar.context().editor;
  }

  /** Disabled state combines the shell input and public context. */
  readonly disabled = computed(
    () => this._toolbar.disabled() || this._toolbar.context().disabled(),
  );

  /** Readonly state supplied through the public context input. */
  get readonly(): Signal<boolean> {
    return this._toolbar.context().readonly;
  }

  /** Focus state supplied by the public owner context. */
  get focused(): Signal<boolean> {
    return this._toolbar.context().focused;
  }

  /** Editable state supplied by the public owner context without shadowing. */
  get editable(): Signal<boolean> {
    return this._toolbar.context().editable;
  }

  /** Serialization format supplied through the public context input. */
  get format(): Signal<MlvEditorFormat> {
    return this._toolbar.context().format;
  }

  /** View zoom supplied through the public context input. */
  get zoom(): WritableSignal<number> {
    return this._toolbar.context().zoom;
  }

  /** Exact editor-owned upload capability supplied through the public context. */
  get imageUpload(): MlvEditorImageUploadControl | undefined {
    return this._toolbar.context().imageUpload;
  }

  /** Runs a public-context command. */
  run(command: (editor: Editor) => boolean): boolean {
    return this._toolbar.context().run(command);
  }

  /** Checks a public-context command. */
  can(command: (editor: Editor) => boolean): boolean {
    return this._toolbar.context().can(command);
  }

  /** Checks active state through the public context. */
  isActive(name: string, attributes?: Record<string, unknown>): boolean {
    return this._toolbar.context().isActive(name, attributes);
  }

  /** Reports a typed error through the public owner context. */
  reportError(error: MlvEditorError): void {
    this._toolbar.context().reportError(error);
  }
}

/** Public compatibility toolbar shell for standalone consumer use. */
@Component({
  selector: 'mlv-editor-toolbar',
  host: {
    class: 'mlv-editor-toolbar',
    '[class.mlv-editor-toolbar--disabled]':
      'disabled() || context().disabled()',
  },
  imports: [
    NgTemplateOutlet,
    MlvFade,
    MlvToolbar,
    MlvDivider,
    MlvEditorToolbarRoot,
    MlvEditorUndoRedo,
    MlvEditorZoom,
    MlvEditorHeading,
    MlvEditorList,
    MlvEditorInlineMarks,
    MlvEditorTextColor,
    MlvEditorHighlight,
    MlvEditorLink,
    MlvEditorImageUpload,
    MlvEditorTable,
    MlvEditorAlignment,
    MlvEditorBlockInsert,
    MlvEditorToolbarOverflow,
  ],
  template: `<div
    mlvEditorToolbarRoot
    #toolbarRoot="mlvEditorToolbarRoot"
    [ariaLabel]="ariaLabel()"
    [disabled]="disabled() || context().disabled()"
  >
    <ng-content select="[mlvEditorToolbarStart]" />
    @if (startTemplate(); as template) {
      <ng-container
        [ngTemplateOutlet]="template"
        [ngTemplateOutletContext]="{ $implicit: context() }"
      />
    }
    <div mlvFade class="mlv-editor-toolbar__scroll">
      <mlv-toolbar>
        <mlv-editor-undo-redo />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
        />
        <mlv-editor-zoom />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
        />
        <mlv-editor-heading />
        <mlv-editor-list />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-inline-marks [hidden]="toolbarRoot.narrow()" />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-text-color />
        <mlv-editor-highlight />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-alignment [hidden]="toolbarRoot.narrow()" />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-link />
        <mlv-editor-table />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-block-insert [hidden]="toolbarRoot.narrow()" />
        <mlv-divider
          class="mlv-editor-toolbar__separator"
          orientation="vertical"
          muted
          [hidden]="toolbarRoot.narrow()"
        />
        <mlv-editor-image-upload />
      </mlv-toolbar>
    </div>
    <mlv-editor-toolbar-overflow />
    @if (endTemplate(); as template) {
      <ng-container
        [ngTemplateOutlet]="template"
        [ngTemplateOutletContext]="{ $implicit: context() }"
      />
    }
    <ng-content select="[mlvEditorToolbarEnd]" /><ng-content />
  </div>`,
  styleUrl: './editor-toolbar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MlvEditorOverlayRegistry,
    MlvEditorToolbarRevision,
    MlvEditorToolbarRovingRegistry,
    MlvEditorToolbarContextProxy,
    {
      provide: MLV_EDITOR_OVERLAY_REGISTRY,
      useExisting: MlvEditorOverlayRegistry,
    },
    {
      provide: MLV_EDITOR_TOOLBAR_CONTEXT,
      useExisting: MlvEditorToolbarContextProxy,
    },
    {
      provide: MLV_EDITOR_TOOLBAR_REVISION,
      useFactory: (state: MlvEditorToolbarRevision) => state.revision,
      deps: [MlvEditorToolbarRevision],
    },
    {
      provide: MLV_EDITOR_TOOLBAR_ROVING,
      useExisting: MlvEditorToolbarRovingRegistry,
    },
  ],
})
export class MlvEditorToolbar {
  /** Accessible toolbar name. */
  readonly ariaLabel = input<string | undefined>(undefined);
  /** Whether all toolbar interactions are disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Optional content rendered before built-in groups. */
  readonly startTemplate = input<TemplateRef<{
    $implicit: MlvEditorToolbarContext;
  }> | null>(null);
  /** Optional content rendered after built-in groups. */
  readonly endTemplate = input<TemplateRef<{
    $implicit: MlvEditorToolbarContext;
  }> | null>(null);
  /** Context supplied to custom toolbar templates. */
  readonly context = input.required<MlvEditorToolbarContext>();

  /** @internal Invalidates built-in command state for the supplied standalone editor. */
  private readonly _revision = inject(MlvEditorToolbarRevision);

  constructor() {
    effect((onCleanup) => {
      const editor = this.context().editor();
      this._revision.revision.update((revision) => revision + 1);
      if (!editor) return;
      const invalidate = (): void =>
        this._revision.revision.update((revision) => revision + 1);
      editor.on('transaction', invalidate);
      editor.on('selectionUpdate', invalidate);
      onCleanup(() => {
        editor.off('transaction', invalidate);
        editor.off('selectionUpdate', invalidate);
      });
    });
  }
}
