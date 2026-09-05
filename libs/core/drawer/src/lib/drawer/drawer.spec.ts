import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvDrawer } from './drawer';
import { DrawerBodyDirective } from '../drawer-body';
import { MlvDrawerContent } from '../drawer-content';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvDrawer', () => {
  let component: MlvDrawer;
  let fixture: ComponentFixture<MlvDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDrawer],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvDrawer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Focus management (declarative component mode)
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDrawer, MlvDrawerContent, DrawerBodyDirective],
  template: `
    <button class="trigger">Open</button>
    <mlv-drawer [(opened)]="open">
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody><button class="inside">Inside</button></div>
      </ng-template>
    </mlv-drawer>
  `,
})
class DrawerHostComponent {
  readonly open = signal(false);
}

describe('MlvDrawer — focus', () => {
  let fixture: ComponentFixture<DrawerHostComponent>;
  let host: DrawerHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.mlv-drawer');
  }

  function drawerInstance(): MlvDrawer {
    return fixture.debugElement.children.find(
      (d) => d.componentInstance instanceof MlvDrawer,
    )?.componentInstance as MlvDrawer;
  }

  it('captures the pre-open focused element as the restore target', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.trigger',
    ) as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      (drawerInstance() as unknown as { _triggerElement: HTMLElement | null })
        ._triggerElement,
    ).toBe(trigger);
  });

  it('restores focus to the trigger when the drawer closes', async () => {
    const trigger = fixture.nativeElement.querySelector(
      '.trigger',
    ) as HTMLButtonElement;
    trigger.focus();

    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    host.open.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    // Leave animation drives overlay disposal via animationend.
    panel()?.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(trigger);
  });

  it('does not set a dangling aria-labelledby on the drawer panel', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('uses the Malva scrollbar for the drawer body', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      panel()?.querySelector('.mlv-drawer__body-scrollbar.mlv-scrollbar'),
    ).toBeTruthy();
  });

  it('focuses the first content control rather than the panel chrome', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(panel()?.querySelector('.inside'));
  });
});

// ---------------------------------------------------------------------------
// Viewport clamping
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDrawer, MlvDrawerContent, DrawerBodyDirective],
  template: `
    <mlv-drawer
      [(opened)]="open"
      [position]="position()"
      [size]="size()"
      [minSize]="minSize()"
      [maxSize]="maxSize()"
      [resizable]="resizable()"
    >
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody>Body</div>
      </ng-template>
    </mlv-drawer>
  `,
})
class DrawerSizeHostComponent {
  readonly open = signal(false);
  readonly position = signal<'left' | 'right' | 'top' | 'bottom'>('right');
  readonly size = signal('36rem');
  readonly minSize = signal('0px');
  readonly maxSize = signal('100%');
  readonly resizable = signal(false);
}

describe('MlvDrawer — size clamping', () => {
  let fixture: ComponentFixture<DrawerSizeHostComponent>;
  let host: DrawerSizeHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerSizeHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerSizeHostComponent);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  async function openDrawer(): Promise<HTMLElement> {
    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return document.querySelector('.mlv-drawer') as HTMLElement;
  }

  it('clamps a fixed width to the viewport for side drawers', async () => {
    const panel = await openDrawer();

    expect(panel.style.width).toBe('36rem');
    expect(panel.style.maxWidth).toBe('100dvw');
    expect(panel.style.maxHeight).toBe('100dvh');
  });

  it('clamps a fixed height to the viewport for top/bottom drawers', async () => {
    host.position.set('bottom');
    const panel = await openDrawer();

    expect(panel.style.height).toBe('36rem');
    expect(panel.style.maxHeight).toBe('100dvh');
    expect(panel.style.maxWidth).toBe('100dvw');
  });

  it('honours maxSize on the non-resizable path, still capped by the viewport', async () => {
    host.maxSize.set('20rem');
    const panel = await openDrawer();

    expect(panel.style.maxWidth).toBe('min(20rem, 100dvw)');
  });

  it('honours maxSize on the resizable path', async () => {
    host.resizable.set(true);
    host.maxSize.set('30rem');
    host.position.set('bottom');
    const panel = await openDrawer();

    expect(panel.style.maxHeight).toBe('min(30rem, 100dvh)');
  });

  it('binds minSize as the width floor of a resizable side drawer', async () => {
    // The drag directive writes the axis size through a custom property;
    // `min-width` is what stops it from shrinking the panel below the floor.
    host.resizable.set(true);
    host.minSize.set('18rem');
    const panel = await openDrawer();

    expect(panel.style.minWidth).toBe('min(18rem, 100dvw)');
    expect(panel.style.minHeight).toBe('');
  });

  it('binds minSize as the height floor of a top/bottom drawer', async () => {
    host.position.set('top');
    host.minSize.set('12rem');
    const panel = await openDrawer();

    expect(panel.style.minHeight).toBe('min(12rem, 100dvh)');
    expect(panel.style.minWidth).toBe('');
  });
});
