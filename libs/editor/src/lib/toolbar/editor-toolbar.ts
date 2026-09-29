import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { BooleanInput } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  Injectable,
  ViewEncapsulation,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type { Signal, WritableSignal } from '@angular/core';
import type {
  MlvEditorError,
  MlvEditorFormat,
  MlvEditorImageUploadControl,
} from '../editor.types';
import { MlvFade } from '@malva-ui/cdk/utils';
import { MlvToolbar } from '@malva-ui/core/toolbar';
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
import { MlvEditorDefaultToolbarGroups } from './editor-default-toolbar-groups';
import { MlvEditorToolbarOverflow } from './editor-toolbar-overflow';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

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
    MlvEditorToolbarRoot,
    MlvEditorDefaultToolbarGroups,
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
        <mlv-editor-default-toolbar-groups />
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
