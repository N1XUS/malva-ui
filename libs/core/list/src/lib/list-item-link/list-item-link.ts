import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[mlvListItemLink]',
  templateUrl: './list-item-link.html',
  styleUrl: './list-item-link.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item__link',
  },
})
export class MlvListItemLink {
  readonly routerLink = inject(RouterLinkActive, { optional: true });

  readonly isActive = toSignal(this.routerLink?.isActiveChange ?? of(false), {
    initialValue: false,
  });
}
