import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';
import { MlvAutocomplete } from '@malva-ui/core/autocomplete';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import type { DemoUser } from '../../../select/examples/8/remote-users.data-source';
import { RemoteUsersDataSource } from '../../../select/examples/8/remote-users.data-source';

@Component({
  selector: 'docs-autocomplete-data-source-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvInput, MlvAutocomplete],
  templateUrl: './index.html',
})
export default class AutocompleteDataSourceExampleComponent {
  /** Fake remote source: 600ms latency, server-side search, 10 users per page. */
  readonly users = new RemoteUsersDataSource();

  readonly toOption = (user: DemoUser): MlvSelectOption<DemoUser> => ({
    label: user.name,
    value: user,
  });
}
