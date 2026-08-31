import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import {
  provideLucideIcons,
  LucideHome,
  LucideSearch,
  LucideSettings,
  LucideBell,
  LucideUser,
  LucideHelpCircle,
  LucideEllipsis,
  LucideCalendar,
} from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBottomNav } from './bottom-nav';
import type { MlvNavItem } from '@malva-ui/cdk/utils';

@Component({
  imports: [MlvBottomNav],
  template: `<mlv-bottom-nav [items]="items()" />`,
})
class TestHostComponent {
  readonly items = signal<MlvNavItem[]>([
    { icon: 'home', label: 'Home', route: '/home' },
    { icon: 'search', label: 'Search', route: '/search' },
    { icon: 'settings', label: 'Settings', route: '/settings' },
  ]);
}

@Component({
  imports: [MlvBottomNav],
  template: `<mlv-bottom-nav
    [items]="items"
    [activeIndex]="activeIndex()"
    (itemClick)="onItemClick($event)"
  />`,
})
class ManagedHostComponent {
  items: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '' },
    { icon: 'search', label: 'Search', route: '' },
    { icon: 'bell', label: 'Alerts', route: '', disabled: true },
    { icon: 'settings', label: 'Settings', route: '' },
  ];

  readonly activeIndex = signal(0);
  lastClickedIndex: number | null = null;

  onItemClick(index: number): void {
    this.lastClickedIndex = index;
    this.activeIndex.set(index);
  }
}

describe('MlvBottomNav', () => {
  const lucideProviders = [
    provideLucideIcons(
      LucideHome,
      LucideSearch,
      LucideSettings,
      LucideBell,
      LucideUser,
      LucideHelpCircle,
      LucideEllipsis,
      LucideCalendar,
    ),
    provideMlvI18nTesting(),
  ];

  describe('router mode', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent, RouterModule.forRoot([])],
        providers: lucideProviders,
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
    });

    it('should create', () => {
      const nav = fixture.nativeElement.querySelector('mlv-bottom-nav');
      expect(nav).toBeTruthy();
    });

    it('should render all items when count <= 5', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      expect(items.length).toBe(3);
    });

    it('should render items as anchor elements with routerLink', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      expect(items[0].tagName.toLowerCase()).toBe('a');
    });

    it('should render labels', () => {
      const labels = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__label',
      );
      expect(labels[0].textContent.trim()).toBe('Home');
      expect(labels[1].textContent.trim()).toBe('Search');
      expect(labels[2].textContent.trim()).toBe('Settings');
    });

    it('should have navigation role', () => {
      const nav = fixture.nativeElement.querySelector('mlv-bottom-nav');
      expect(nav.getAttribute('role')).toBe('navigation');
    });

    it('should expose exactly one navigation landmark (no nested <nav>)', () => {
      // Host carries role="navigation"; the inner bar must be a plain <div>.
      const landmarks = fixture.nativeElement.querySelectorAll(
        '[role="navigation"]',
      );
      expect(landmarks.length).toBe(1);
      expect(fixture.nativeElement.querySelectorAll('nav').length).toBe(0);
    });

    it('should not show More button when items <= 5', () => {
      const moreBtn = fixture.nativeElement.querySelector(
        '.mlv-bottom-nav__more',
      );
      expect(moreBtn).toBeFalsy();
    });

    it('should show More button and limit visible items when > 5 items', async () => {
      fixture.componentInstance.items.set([
        { icon: 'home', label: 'Home', route: '/home' },
        { icon: 'search', label: 'Search', route: '/search' },
        { icon: 'bell', label: 'Alerts', route: '/alerts' },
        { icon: 'calendar', label: 'Calendar', route: '/calendar' },
        { icon: 'user', label: 'Profile', route: '/profile' },
        { icon: 'help-circle', label: 'Help', route: '/help' },
      ]);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      await fixture.whenStable();

      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      // 4 regular items + 1 More button = 5
      expect(items.length).toBe(5);

      const moreBtn = fixture.nativeElement.querySelector(
        '.mlv-bottom-nav__more',
      );
      expect(moreBtn).toBeTruthy();
      expect(moreBtn.textContent.trim()).toContain('More');
    });

    it('should render the More button as a button element with menu trigger', async () => {
      fixture.componentInstance.items.set([
        { icon: 'home', label: 'Home', route: '/home' },
        { icon: 'search', label: 'Search', route: '/search' },
        { icon: 'bell', label: 'Alerts', route: '/alerts' },
        { icon: 'calendar', label: 'Calendar', route: '/calendar' },
        { icon: 'user', label: 'Profile', route: '/profile' },
        { icon: 'help-circle', label: 'Help', route: '/help' },
      ]);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      await fixture.whenStable();

      const moreBtn = fixture.nativeElement.querySelector(
        '.mlv-bottom-nav__more',
      );
      expect(moreBtn.tagName.toLowerCase()).toBe('button');
      expect(moreBtn.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('should render disabled items as buttons in router mode', () => {
      fixture.componentInstance.items.set([
        { icon: 'home', label: 'Home', route: '/home' },
        { icon: 'search', label: 'Search', route: '/search', disabled: true },
        { icon: 'settings', label: 'Settings', route: '/settings' },
      ]);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      // First and third should be <a>, second should be <button>
      expect(items[0].tagName.toLowerCase()).toBe('a');
      expect(items[1].tagName.toLowerCase()).toBe('button');
      expect(items[1].disabled).toBe(true);
      expect(
        items[1].classList.contains('mlv-bottom-nav__item--disabled'),
      ).toBe(true);
      expect(items[2].tagName.toLowerCase()).toBe('a');
    });
  });

  describe('managed mode', () => {
    let fixture: ComponentFixture<ManagedHostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ManagedHostComponent, RouterModule.forRoot([])],
        providers: lucideProviders,
      }).compileComponents();

      fixture = TestBed.createComponent(ManagedHostComponent);
      fixture.detectChanges();
    });

    it('should render items as button elements', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      for (const item of items) {
        expect(item.tagName.toLowerCase()).toBe('button');
      }
    });

    it('should apply active class to the item matching activeIndex', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      expect(items[0].classList.contains('mlv-bottom-nav__item--active')).toBe(
        true,
      );
      expect(items[1].classList.contains('mlv-bottom-nav__item--active')).toBe(
        false,
      );
    });

    it('should set aria-current="page" only on the active item', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      expect(items[0].getAttribute('aria-current')).toBe('page');
      expect(items[1].getAttribute('aria-current')).toBeNull();

      fixture.componentInstance.activeIndex.set(1);
      fixture.detectChanges();
      expect(items[0].getAttribute('aria-current')).toBeNull();
      expect(items[1].getAttribute('aria-current')).toBe('page');
    });

    it('should emit itemClick and update active on click', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      items[1].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.lastClickedIndex).toBe(1);
      expect(items[1].classList.contains('mlv-bottom-nav__item--active')).toBe(
        true,
      );
      expect(items[0].classList.contains('mlv-bottom-nav__item--active')).toBe(
        false,
      );
    });

    it('should render disabled item with disabled attribute and class', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      // Third item (index 2) is disabled
      expect(items[2].disabled).toBe(true);
      expect(
        items[2].classList.contains('mlv-bottom-nav__item--disabled'),
      ).toBe(true);
      expect(items[2].getAttribute('aria-disabled')).toBe('true');
    });

    it('should not emit itemClick for disabled items', () => {
      const items = fixture.nativeElement.querySelectorAll(
        '.mlv-bottom-nav__item',
      );
      fixture.componentInstance.lastClickedIndex = null;

      // Click the disabled item — native disabled prevents the event
      items[2].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.lastClickedIndex).toBe(null);
    });
  });
});
