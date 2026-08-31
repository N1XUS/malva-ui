import { Directive, inject, TemplateRef } from '@angular/core';

@Directive()
export abstract class MlvStructural<C = unknown> {
  readonly templateRef = inject(TemplateRef<C>);
}
