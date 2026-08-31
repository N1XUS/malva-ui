import { Directive, TemplateRef, inject } from '@angular/core';

export interface MlvListItemTemplateContext<T = unknown> {
  $implicit: T;
}

@Directive({
  selector: '[mlvListItemTemplate]',
})
export class MlvListItemTemplate<T = unknown> {
  readonly templateRef = inject(TemplateRef<MlvListItemTemplateContext<T>>);
}
