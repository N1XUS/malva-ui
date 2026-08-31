import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFileUploadAction } from './file-upload-action';
import { MlvFileUpload } from './file-upload/file-upload';

/**
 * Host projecting one action on each side of the browse button, plus a bound
 * `[position]` control that documents why the slot marker must be static.
 */
@Component({
  imports: [MlvFileUpload, MlvFileUploadAction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-file-upload [compact]="compact()" actionLabel="Choose image">
      <button
        id="start-action"
        type="button"
        mlvFileUploadAction
        (click)="lastClicked.set('start')"
      >
        Generate
      </button>
      <button
        id="end-action"
        type="button"
        mlvFileUploadAction
        position="end"
        (click)="lastClicked.set('end')"
      >
        Import
      </button>
      <button
        id="bound-action"
        type="button"
        mlvFileUploadAction
        [position]="boundPosition()"
      >
        Bound
      </button>
    </mlv-file-upload>
  `,
})
class ActionHostComponent {
  readonly compact = signal(false);
  readonly boundPosition = signal<'start' | 'end'>('end');
  readonly lastClicked = signal('');
}

/**
 * Returns the action row's children in DOM order, identified by their id.
 * Only the built-in browse button is id-less, so it reads back as `'browse'`.
 */
function actionRowOrder(hostEl: HTMLElement): string[] {
  const row = hostEl.querySelector('.mlv-file-upload__zone-action');
  return Array.from(row?.children ?? []).map((child) => child.id || 'browse');
}

describe('MlvFileUploadAction', () => {
  let fixture: ComponentFixture<ActionHostComponent>;
  let host: ActionHostComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionHostComponent);
    host = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // -------------------------------------------------------------------------
  // Directive class / position input
  // -------------------------------------------------------------------------

  describe('directive', () => {
    it('should default position to "start"', () => {
      const directive = fixture.debugElement
        .query(By.css('#start-action'))
        .injector.get(MlvFileUploadAction);
      expect(directive.position()).toBe('start');
    });

    it('should apply the BEM element class to every projected action', () => {
      expect(hostEl.querySelectorAll('.mlv-file-upload__action').length).toBe(
        3,
      );
    });

    it('should NOT add the end modifier when position is start', () => {
      const start = hostEl.querySelector('#start-action') as HTMLElement;
      expect(start.classList).not.toContain('mlv-file-upload__action--end');
    });

    it('should add the end modifier when position is end', () => {
      const end = hostEl.querySelector('#end-action') as HTMLElement;
      expect(end.classList).toContain('mlv-file-upload__action--end');
    });

    it('should track a bound position for the modifier class', () => {
      const bound = hostEl.querySelector('#bound-action') as HTMLElement;
      expect(bound.classList).toContain('mlv-file-upload__action--end');

      host.boundPosition.set('start');
      fixture.detectChanges();
      expect(bound.classList).not.toContain('mlv-file-upload__action--end');
    });
  });

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------

  describe('projection', () => {
    it('should render projected actions inside the zone action row', () => {
      const row = hostEl.querySelector('.mlv-file-upload__zone-action');
      expect(row).toBeTruthy();
      expect(row?.querySelector('#start-action')).toBeTruthy();
      expect(row?.querySelector('#end-action')).toBeTruthy();
    });

    it('should place start actions before and end actions after the browse button', () => {
      expect(actionRowOrder(hostEl)).toEqual([
        'start-action',
        'bound-action',
        'browse',
        'end-action',
      ]);
    });

    it('should keep the browse button label between the two slots', () => {
      const browse = hostEl.querySelector(
        '.mlv-file-upload__zone-action button[mlvButton]',
      );
      expect(browse?.textContent?.trim()).toBe('Choose image');
    });

    it('should keep a bound [position]="end" in the start slot (static attribute only)', () => {
      // The slot is chosen by the template attribute, so the binding moves the
      // modifier class but never the node.
      const order = actionRowOrder(hostEl);
      expect(order.indexOf('bound-action')).toBeLessThan(
        order.indexOf('browse'),
      );
    });

    it('should still render projected actions in compact mode', () => {
      host.compact.set(true);
      fixture.detectChanges();

      const upload = hostEl.querySelector('mlv-file-upload') as HTMLElement;
      expect(upload.classList).toContain('mlv-file-upload--compact');
      expect(actionRowOrder(hostEl)).toEqual([
        'start-action',
        'bound-action',
        'browse',
        'end-action',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Click isolation
  // -------------------------------------------------------------------------

  describe('click isolation', () => {
    /** The hidden `<input type="file">` whose `click()` opens the picker. */
    function fileInput(): HTMLInputElement {
      return hostEl.querySelector(
        '.mlv-file-upload__input',
      ) as HTMLInputElement;
    }

    it('should NOT open the file picker when a projected action is clicked', () => {
      const spy = vi.spyOn(fileInput(), 'click');

      (hostEl.querySelector('#start-action') as HTMLElement).click();
      (hostEl.querySelector('#end-action') as HTMLElement).click();
      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should still run the consumer handler on a projected action click', () => {
      (hostEl.querySelector('#start-action') as HTMLElement).click();
      fixture.detectChanges();
      expect(host.lastClicked()).toBe('start');

      (hostEl.querySelector('#end-action') as HTMLElement).click();
      fixture.detectChanges();
      expect(host.lastClicked()).toBe('end');
    });

    it('should stop the click from leaving the projected action', () => {
      const bubbled: string[] = [];
      hostEl.addEventListener('click', () => bubbled.push('host'));

      (hostEl.querySelector('#start-action') as HTMLElement).click();
      expect(bubbled).toEqual([]);
    });

    it('should still open the file picker from the browse button', () => {
      const spy = vi.spyOn(fileInput(), 'click');

      const browse = hostEl.querySelector(
        '.mlv-file-upload__zone-action button[mlvButton]',
      ) as HTMLElement;
      browse.click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
