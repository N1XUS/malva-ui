import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCombobox } from '@malva-ui/core/combobox';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import type { DemoUser } from '../../../select/examples/8/remote-users.data-source';
import { RemoteUsersDataSource } from '../../../select/examples/8/remote-users.data-source';

@Component({
  selector: 'docs-combobox-data-source-example',
  imports: [MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxDataSourceExampleComponent {
  /** Fake remote source: 600ms latency, server-side search, 10 users per page. */
  readonly users = new RemoteUsersDataSource();

  readonly toOption = (user: DemoUser): MlvSelectOption<DemoUser> => ({
    label: user.name,
    value: user,
  });

  readonly compareWith = (a: DemoUser, b: DemoUser): boolean => a.id === b.id;
}
