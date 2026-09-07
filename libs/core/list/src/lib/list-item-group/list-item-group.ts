import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';
import type { BooleanInput } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';

@Component({
  selector: 'mlv-list-item-group',
  imports: [LucideChevronRight],
  templateUrl: './list-item-group.html',
  styleUrl: './list-item-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item-group',
    // `<mlv-list-item-group>` is projected straight into `<mlv-list>`, whose
    // host claims a container role. A container role owns every roled or
    // focusable descendant it reaches through roleless wrappers, so with no
    // role here the group's own toggler `<button>` became a direct child of
    // `role="list"` — which may own nothing but `listitem` (axe
    // `aria-required-children`, WCAG 1.3.1), and the whole list stopped being
    // exposed as a list. Claiming `listitem` makes the group one row of the
    // outer list and puts the toggler inside it; the content region then
    // claims `role="list"` in the template so the rows nested under it still
    // have the `list` context `listitem` requires. This is the
    // `<li><button aria-expanded><ul>…</ul></li>` disclosure shape.
    //
    // Unconditional, because a group *is* a list section: it is documented as
    // a child of `<mlv-list>`, and every shipped consumer puts it in one at the
    // default `listRole="list"` (`apps/docs/.../pages/list/examples/5` and
    // `/8`, both `variant="inset"`). A consumer who overrides `listRole` — the
    // input exists for exactly that, and six sites already use it — would put a
    // `listitem` inside e.g. `role="menu"`, which owns no such child. Deriving
    // both roles from the parent list is tracked separately; nothing ships that
    // shape today. Note `libs/core/src/ssr-smoke.spec.ts` renders the group
    // outside any list, so this role is not conditional on finding a parent.
    role: 'listitem',
    '[class.mlv-list-item-group--toggled]': 'open()',
  },
})
export class MlvListItemGroup {
  readonly label = input.required<string>();

  readonly open = model<BooleanInput>(false);

  /** @protected Unique ID for the collapsible content region. */
  protected readonly _contentId = mlvNextId('mlv-list-group-content');

  toggle(): void {
    this.open.update((value) => !value);
  }
}
