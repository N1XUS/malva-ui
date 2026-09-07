import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvAlert } from './alert';

describe('MlvAlert', () => {
  let fixture: ComponentFixture<MlvAlert>;
  let component: MlvAlert;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvAlert],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvAlert);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // ── Creation ─────────────────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create without error', () => {
      expect(component).toBeTruthy();
    });

    it('should apply mlv-alert class to host', () => {
      expect(hostEl.classList).toContain('mlv-alert');
    });
  });

  // ── Default inputs ────────────────────────────────────────────────────────────

  describe('default inputs', () => {
    it('should default tone to info', () => {
      expect(component.tone()).toBe('info');
    });

    it('should default dismissible to false', () => {
      expect(component.dismissible()).toBe(false);
    });
  });

  // ── Tone modifier ─────────────────────────────────────────────────────────

  describe('tone modifier class', () => {
    it('should apply mlv-alert--tone-info class by default', () => {
      expect(hostEl.classList).toContain('mlv-alert--tone-info');
    });

    it('should apply mlv-alert--tone-success when set', () => {
      fixture.componentRef.setInput('tone', 'success');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-alert--tone-success');
      expect(hostEl.classList).not.toContain('mlv-alert--tone-info');
    });

    it('should apply mlv-alert--tone-warning when set', () => {
      fixture.componentRef.setInput('tone', 'warning');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-alert--tone-warning');
    });

    it('should apply mlv-alert--tone-danger when set', () => {
      fixture.componentRef.setInput('tone', 'danger');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-alert--tone-danger');
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('should have role="alert" on host', () => {
      expect(hostEl.getAttribute('role')).toBe('alert');
    });

    it('should have aria-live="polite" on host', () => {
      expect(hostEl.getAttribute('aria-live')).toBe('polite');
    });

    it('icon area should be aria-hidden', () => {
      const iconArea = fixture.debugElement.query(By.css('.mlv-alert__icon'));
      expect(iconArea.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('should not have hidden attribute by default', () => {
      expect(hostEl.getAttribute('hidden')).toBeNull();
    });
  });

  // ── Dismiss behavior ─────────────────────────────────────────────────────────

  describe('dismissible', () => {
    it('should not render dismiss button when dismissible is false', () => {
      const btn = fixture.debugElement.query(By.css('.mlv-alert__dismiss'));
      expect(btn).toBeNull();
    });

    it('should render dismiss button when dismissible is true', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const btn = fixture.debugElement.query(By.css('.mlv-alert__dismiss'));
      expect(btn).not.toBeNull();
    });

    it('dismiss button should have aria-label="Dismiss alert"', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();
      // `mlv-button-close` names its inner native button, not its role-less
      // custom-element host, so the accessible name lands on the focusable
      // control a screen reader actually reaches.
      const btn: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-alert__dismiss button'),
      ).nativeElement;
      expect(btn.getAttribute('aria-label')).toBe('Dismiss alert');
    });

    it('should emit dismissed event when dismiss button clicked', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      let emitted = false;
      component.dismissed.subscribe(() => {
        emitted = true;
      });

      const btn: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-alert__dismiss'),
      ).nativeElement;
      btn.click();
      fixture.detectChanges();

      expect(emitted).toBe(true);
    });

    it('keeps dismiss as one native button and emits once from its click', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const dismissed = vi.fn();
      component.dismissed.subscribe(dismissed);

      const closeHost = hostEl.querySelector('mlv-button-close') as HTMLElement;
      const dismissButton = closeHost.querySelector(
        'button',
      ) as HTMLButtonElement;
      expect(closeHost).not.toBeNull();
      expect(closeHost.getAttribute('role')).toBeNull();
      expect(closeHost.getAttribute('tabindex')).toBeNull();
      expect(closeHost.querySelectorAll('button')).toHaveLength(1);

      await expectNoAxeViolations(hostEl);

      dismissButton.click();
      fixture.detectChanges();
      expect(dismissed).toHaveBeenCalledTimes(1);
    });

    it('should add mlv-alert--dismissed class after dismiss', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const btn: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-alert__dismiss'),
      ).nativeElement;
      btn.click();
      fixture.detectChanges();

      expect(hostEl.classList).toContain('mlv-alert--dismissed');
    });

    it('should set hidden attribute on host after dismiss', async () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const btn: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-alert__dismiss'),
      ).nativeElement;
      btn.click();
      fixture.detectChanges();

      expect(hostEl.getAttribute('hidden')).not.toBeNull();
    });
  });

  // ── Template structure ────────────────────────────────────────────────────────

  describe('template structure', () => {
    it('should render icon area', () => {
      const iconArea = fixture.debugElement.query(By.css('.mlv-alert__icon'));
      expect(iconArea).toBeTruthy();
    });

    it('should render body element', () => {
      const body = fixture.debugElement.query(By.css('.mlv-alert__body'));
      expect(body).toBeTruthy();
    });

    it('should render description area', () => {
      const desc = fixture.debugElement.query(
        By.css('.mlv-alert__description'),
      );
      expect(desc).toBeTruthy();
    });

    it('should not render title area when no title slot is projected', () => {
      const title = fixture.debugElement.query(By.css('.mlv-alert__title'));
      expect(title).toBeNull();
    });
  });

  // ── BooleanInput coercion ─────────────────────────────────────────────────────

  describe('BooleanInput coercion', () => {
    it('should coerce string "true" to true for dismissible', async () => {
      fixture.componentRef.setInput('dismissible', 'true');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.dismissible()).toBe(true);
      const btn = fixture.debugElement.query(By.css('.mlv-alert__dismiss'));
      expect(btn).not.toBeNull();
    });

    it('should coerce empty string to true for dismissible (attribute syntax)', async () => {
      fixture.componentRef.setInput('dismissible', '');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.dismissible()).toBe(true);
    });
  });
});
