import {
  mlvViewStateEqual,
  type MlvViewVariant,
  type MlvViewVariantAction,
  type MlvViewVariantBusyAction,
  type MlvViewVariantCapabilities,
  type MlvViewVariantCreateRequest,
  type MlvViewVariantGroupLabels,
  type MlvViewVariantScope,
} from '../index';

describe('mlvViewStateEqual', () => {
  it('compares normalized view state supplied by the host', () => {
    const normalize = (state: {
      page: number;
      filters: readonly string[];
    }) => ({
      filters: [...state.filters].sort(),
    });

    expect(
      mlvViewStateEqual(
        { page: 1, filters: ['b', 'a'] },
        { page: 9, filters: ['a', 'b'] },
        normalize,
      ),
    ).toBe(true);
  });

  it('detects meaningful normalized changes', () => {
    expect(
      mlvViewStateEqual(
        { search: 'risk' },
        { search: 'renewal' },
        (value) => value,
      ),
    ).toBe(false);
  });
});

describe('view-variant public contracts', () => {
  it('represents an immutable consumer-owned saved view', () => {
    type ViewState = Readonly<{
      search: string;
      filters: readonly string[];
    }>;

    const scope: MlvViewVariantScope = 'team';
    const action: MlvViewVariantAction = 'share';
    const capabilities: MlvViewVariantCapabilities = {
      clone: true,
      update: true,
      rename: true,
      delete: false,
      share: true,
    };
    const variant: MlvViewVariant<ViewState> = {
      id: 'renewals',
      name: 'Renewal risk',
      scope,
      state: { search: 'risk', filters: ['renewal'] },
      capabilities,
      locked: false,
      resultCount: 12,
      ownerLabel: 'Revenue team',
      revision: 4,
      updatedAt: '2026-08-20T08:00:00.000Z',
    };
    const request: MlvViewVariantCreateRequest<ViewState> = {
      name: variant.name,
      scope,
      state: variant.state,
      sourceId: variant.id,
    };
    const busyAction: MlvViewVariantBusyAction = {
      action,
      variantId: variant.id,
    };
    const labels: MlvViewVariantGroupLabels = {
      system: 'System views',
      team: 'Team views',
      personal: 'My views',
    };

    const assertReadonlyContract = (): void => {
      // @ts-expect-error Saved-view contracts do not permit changing a name.
      variant.name = 'Changed';
      // @ts-expect-error Capabilities are immutable public contract fields.
      capabilities.share = false;
      // @ts-expect-error Create-request fields are immutable public contract fields.
      request.scope = 'system';
    };
    const assertSystemScopeCannotBeCreated = (): void => {
      // @ts-expect-error Consumers cannot create a system-owned view.
      const systemScope: MlvViewVariantCreateRequest<unknown>['scope'] =
        'system';

      void systemScope;
    };

    void assertReadonlyContract;
    void assertSystemScopeCannotBeCreated;
    expect([busyAction.action, labels[scope], request.state.filters]).toEqual([
      'share',
      'Team views',
      ['renewal'],
    ]);
  });
});
