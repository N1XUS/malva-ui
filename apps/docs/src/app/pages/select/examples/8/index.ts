import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSelect } from '@malva-ui/core/select';
import type { MlvSelectOption } from '@malva-ui/core/select';
import type { DemoUser } from './remote-users.data-source';
import { RemoteUsersDataSource } from './remote-users.data-source';

@Component({
  selector: 'docs-select-data-source-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectDataSourceExampleComponent {
  /** Fake remote source: 600ms latency, server-side search, 10 users per page. */
  readonly users = new RemoteUsersDataSource();

  /**
   * A value as it arrives from a server: the id is real, the label is not
   * loaded yet. `compareWith` collapses it onto the option once the page
   * carrying that id lands.
   */
  readonly value = signal<DemoUser | null>({ id: 7, name: '', email: '' });

  readonly toOption = (user: DemoUser): MlvSelectOption<DemoUser> => ({
    label: user.name,
    value: user,
  });

  readonly compareWith = (a: DemoUser, b: DemoUser): boolean => a.id === b.id;
}
