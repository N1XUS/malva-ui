import { Directive, TemplateRef, inject } from '@angular/core';
import type { MlvEditorToolbarContext } from '../editor-toolbar-context';

/** @internal Template context supplied to replaceable toolbar definitions. */
interface MlvEditorToolbarTemplateContext {
  readonly $implicit: MlvEditorToolbarContext;
}

/** Complete replacement template for an editor's built-in toolbar. */
@Directive({
  selector: '[mlvEditorToolbar]',
})
export class MlvEditorToolbarDef {
  /** The projected template, whose implicit context is `MlvEditorToolbarContext`. */
  readonly templateRef = inject<TemplateRef<MlvEditorToolbarTemplateContext>>(
    TemplateRef,
    {
      optional: true,
    },
  );

  /** Narrows `let-context` to the editor toolbar context. */
  static ngTemplateContextGuard(
    _dir: MlvEditorToolbarDef,
    _context: unknown,
  ): _context is MlvEditorToolbarTemplateContext {
    return true;
  }
}

/** Template rendered before the built-in toolbar groups. */
@Directive({
  selector: '[mlvEditorToolbarStart]',
})
export class MlvEditorToolbarStartDef {
  /** The projected template, whose implicit context is `MlvEditorToolbarContext`. */
  readonly templateRef = inject<TemplateRef<MlvEditorToolbarTemplateContext>>(
    TemplateRef,
    {
      optional: true,
    },
  );

  /** Narrows `let-context` to the editor toolbar context. */
  static ngTemplateContextGuard(
    _dir: MlvEditorToolbarStartDef,
    _context: unknown,
  ): _context is MlvEditorToolbarTemplateContext {
    return true;
  }
}

/** Template rendered after the built-in toolbar groups. */
@Directive({
  selector: '[mlvEditorToolbarEnd]',
})
export class MlvEditorToolbarEndDef {
  /** The projected template, whose implicit context is `MlvEditorToolbarContext`. */
  readonly templateRef = inject<TemplateRef<MlvEditorToolbarTemplateContext>>(
    TemplateRef,
    {
      optional: true,
    },
  );

  /** Narrows `let-context` to the editor toolbar context. */
  static ngTemplateContextGuard(
    _dir: MlvEditorToolbarEndDef,
    _context: unknown,
  ): _context is MlvEditorToolbarTemplateContext {
    return true;
  }
}
