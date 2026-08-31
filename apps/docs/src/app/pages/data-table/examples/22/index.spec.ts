import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvDataTable } from '@malva-ui/core/data-table';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import PresentationStateExampleComponent from './index';

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === name ||
      candidate.getAttribute('aria-label') === name,
  );
  if (!button) throw new Error(`Expected button named "${name}".`);
  return button;
}

describe('PresentationStateExampleComponent', () => {
  it('captures and restores durable presentation without echoing programmatic apply or reset', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PresentationStateExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(PresentationStateExampleComponent);
    const changed = vi.fn();
    const host = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();

    const table = fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
    table.presentationStateChange.subscribe(changed);
    const initial = table.getPresentationState();

    buttonNamed(host, 'Capture presentation').click();
    fixture.detectChanges();
    expect(changed).not.toHaveBeenCalled();

    buttonNamed(host, 'Sort by Account').click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { key: 'account', direction: 'asc' } }),
    );

    buttonNamed(host, 'Show renewal review').click();
    fixture.detectChanges();
    expect(table.getPresentationState()).toMatchObject({
      sort: { key: 'renewalDate', direction: 'asc' },
      visibleColumnKeys: ['account', 'renewalDate', 'renewalRisk', 'arr'],
    });
    expect(changed).toHaveBeenCalledTimes(1);

    buttonNamed(host, 'Reapply captured state').click();
    fixture.detectChanges();
    expect(table.getPresentationState()).toEqual(initial);
    expect(host.querySelector('output')?.textContent).toContain(
      'Reapplied the captured presentation.',
    );
    expect(changed).toHaveBeenCalledTimes(1);

    buttonNamed(host, 'Show renewal review').click();
    buttonNamed(host, 'Reset example').click();
    fixture.detectChanges();
    expect(table.getPresentationState()).toEqual(initial);
    expect(host.querySelector('output')?.textContent).toContain(
      'Reset the presentation to the example default.',
    );
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
