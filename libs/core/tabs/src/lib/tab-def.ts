import { Directive, inject, TemplateRef } from '@angular/core';

export interface MlvTabDefContext {
  $implicit: boolean;
}

@Directive({
  selector: '[mlvTabDef]',
})
export class MlvTabDef {
  readonly templateRef = inject<TemplateRef<MlvTabDefContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: MlvTabDef,
    _ctx: unknown,
  ): _ctx is MlvTabDefContext {
    return true;
  }
}
