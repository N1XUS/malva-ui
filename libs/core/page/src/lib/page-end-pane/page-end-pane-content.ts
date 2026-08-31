import { Directive, inject, TemplateRef } from '@angular/core';

/** Owns the single template rendered by a responsive Page end pane. */
@Directive({ selector: 'ng-template[mlvPageEndPaneContent]' })
export class MlvPageEndPaneContent {
  /** Template projected into either the inline aside or compact Drawer. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
