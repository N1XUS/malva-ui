import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvSmartFilterBar } from '@malva-ui/core/filter';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import QueryFilterExampleComponent from './index';

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!button) throw new Error(`Expected button named "${name}".`);
  return button;
}

/**
 * A bounded filter's value rows are rendered by the shared `mlv-dropdown-panel`
 * as `mlv-list-item[role="option"]`, not as buttons.
 */
function optionNamed(scope: ParentNode, name: string): HTMLElement {
  const option = [
    ...scope.querySelectorAll<HTMLElement>(
      '.mlv-dropdown-panel__item[role="option"]',
    ),
  ].find((candidate) => candidate.textContent?.trim() === name);
  if (!option) throw new Error(`Expected option named "${name}".`);
  return option;
}

describe('QueryFilterExampleComponent', () => {
  it('adds, applies, and removes a query condition with explicit and live execution timing', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [QueryFilterExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(QueryFilterExampleComponent);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const execute = vi.fn();
    const host = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    const filterBar = fixture.debugElement.query(
      By.directive(MlvSmartFilterBar),
    ).componentInstance as MlvSmartFilterBar;
    filterBar.execute.subscribe(execute);

    expect(
      buttonNamed(host, 'Explicit mode').getAttribute('aria-pressed'),
    ).toBe('true');
    buttonNamed(host, 'Add filter').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    buttonNamed(overlay, 'Renewal risk').click();
    fixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    fixture.detectChanges();

    const riskChip = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Filter by Renewal risk"]',
    );
    if (!riskChip) throw new Error('Expected the Renewal risk query chip.');
    riskChip.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    optionNamed(overlay, 'At risk').click();
    fixture.detectChanges();
    expect(execute).not.toHaveBeenCalled();

    buttonNamed(overlay, 'Apply').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(execute).not.toHaveBeenCalled();

    buttonNamed(host, 'Apply').click();
    fixture.detectChanges();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: {
          kind: 'group',
          combinator: 'and',
          children: [
            {
              kind: 'condition',
              key: 'renewalDate',
              condition: { operator: 'less-than', value: '2026-10-01' },
            },
            {
              kind: 'condition',
              key: 'renewalRisk',
              condition: { operator: 'equals', value: 'At risk' },
            },
          ],
        },
      }),
    );

    buttonNamed(host, 'Live mode').click();
    fixture.detectChanges();
    expect(buttonNamed(host, 'Live mode').getAttribute('aria-pressed')).toBe(
      'true',
    );

    const removeRisk = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Renewal risk filter"]',
    );
    if (!removeRisk)
      throw new Error('Expected the Renewal risk remove action.');
    removeRisk.click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.lastPayload()?.expression).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [
        {
          kind: 'condition',
          key: 'renewalDate',
          condition: { operator: 'less-than', value: '2026-10-01' },
        },
      ],
    });
  });
});
