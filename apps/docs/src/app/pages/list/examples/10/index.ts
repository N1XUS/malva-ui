import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import {
  MlvStatusIndicator,
  type MlvStatusIndicatorTone,
} from '@malva-ui/core/status-indicator';

interface OrderRow {
  id: string;
  product: string;
  detail: string;
  amount: string;
  status: string;
  statusTone: MlvStatusIndicatorTone;
  imageUrl: string;
}

@Component({
  selector: 'docs-list-orders-example',
  imports: [
    MlvAvatar,
    MlvList,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemTitle,
    MlvStatusIndicator,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListOrdersExampleComponent {
  protected readonly orders: OrderRow[] = [
    {
      id: '48213',
      product: 'Mechanical keyboard — Aurora 65%',
      detail: 'Priya Natarajan · Order #48213 · 2 items',
      amount: '$189.00',
      status: 'Shipped',
      statusTone: 'info',
      imageUrl: 'https://picsum.photos/seed/mlv-aurora-keyboard/200/200',
    },
    {
      id: '48198',
      product: 'Standing desk converter',
      detail: 'Marcus Reid · Order #48198 · 1 item',
      amount: '$342.00',
      status: 'Processing',
      statusTone: 'warning',
      imageUrl: 'https://picsum.photos/seed/mlv-standing-desk/200/200',
    },
    {
      id: '48179',
      product: 'Wireless mouse — Ion',
      detail: 'Amelia Chen · Order #48179 · 1 item',
      amount: '$59.00',
      status: 'Delivered',
      statusTone: 'success',
      imageUrl: 'https://picsum.photos/seed/mlv-ion-mouse/200/200',
    },
    {
      id: '48154',
      product: 'USB-C dock, 12-in-1',
      detail: 'Sana Al-Rashid · Order #48154 · 3 items',
      amount: '$129.00',
      status: 'Refunded',
      statusTone: 'default',
      imageUrl: 'https://picsum.photos/seed/mlv-usbc-dock/200/200',
    },
  ];
}
