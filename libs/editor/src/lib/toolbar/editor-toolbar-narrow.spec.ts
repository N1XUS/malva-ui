import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MlvEditor } from '../editor/editor';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { MlvEditorToolbarRoot } from './editor-toolbar-root';

@Component({
  imports: [MlvEditor],
  template: `
    <mlv-editor
      label="Doc"
      [extensions]="extensions()"
      [toolbarAppearance]="appearance()"
      [(value)]="value"
    />
  `,
})
class NarrowHost {
  value = '<p>Alpha beta</p>';
  readonly extensions = signal<Extensions>(mlvEditorDefaultExtensions());
  readonly appearance = signal<'bar' | 'floating'>('bar');
  readonly editor = viewChild.required(MlvEditor);
}

interface Mounted {
  readonly host: HTMLElement;
  settle(): Promise<void>;
  openOverflow(): Promise<HTMLElement[]>;
}

async function mount(configure?: (host: NarrowHost) => void): Promise<Mounted> {
  await TestBed.configureTestingModule({
    imports: [NarrowHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(NarrowHost);
  configure?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const host = fixture.nativeElement as HTMLElement;
  const rootDebug = fixture.debugElement.query(
    By.directive(MlvEditorToolbarRoot),
  );
  rootDebug?.injector.get(MlvEditorToolbarRoot).narrow.set(true);
  await settle();
  const openOverflow = async (): Promise<HTMLElement[]> => {
    (
      host.querySelector(
        '.mlv-editor-toolbar__overflow button[aria-label="More formatting"]',
      ) as HTMLButtonElement
    ).click();
    await settle();
    return menuItems(document.querySelector('.mlv-menu__panel'));
  };
  return { host, settle, openOverflow };
}

/** The menu items directly owned by one menu panel. */
function menuItems(panel: Element | null): HTMLElement[] {
  return [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
}

const labels = (items: readonly HTMLElement[]): string[] =>
  items.map((item) => item.textContent?.trim() ?? '');

describe('narrow toolbar overflow (#514)', () => {
  it('hides the text-style groups and keeps colour, highlight and link on the row', async () => {
    const { host } = await mount();
    const display = (selector: string): string =>
      getComputedStyle(host.querySelector(selector) as HTMLElement).display;
    for (const selector of [
      'mlv-editor-font-family',
      'mlv-editor-font-size',
      'mlv-editor-line-height',
      'mlv-editor-clear-formatting',
      'mlv-editor-inline-marks',
    ]) {
      expect(display(selector), selector).toBe('none');
    }
    for (const selector of [
      'mlv-editor-text-color',
      'mlv-editor-highlight',
      'mlv-editor-link',
    ]) {
      expect(display(selector), selector).not.toBe('none');
    }
  });

  it('lists the text-style items and submenus in toolbar order', async () => {
    const { openOverflow } = await mount();
    expect(labels(await openOverflow())).toEqual([
      'Font',
      'Font size',
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Inline code',
      'Subscript',
      'Superscript',
      'Clear formatting',
      'Align left',
      'Align center',
      'Align right',
      'Justify',
      'Line height',
      'Blockquote',
      'Code block',
      'Horizontal rule',
    ]);
  });

  it('opens a size submenu that marks the current size and applies another', async () => {
    const { openOverflow, settle } = await mount();
    const items = await openOverflow();
    const sizeTrigger = items.find(
      (item) => item.textContent?.trim() === 'Font size',
    );
    expect(sizeTrigger?.getAttribute('aria-haspopup')).toBe('menu');
    sizeTrigger?.click();
    await settle();
    const panels = document.querySelectorAll('.mlv-menu__panel');
    const submenu = menuItems(panels[panels.length - 1]);
    expect(labels(submenu)).toEqual([
      'Default',
      '12',
      '14',
      '16',
      '18',
      '20',
      '24',
      '30',
      '36',
    ]);
    expect(submenu[0].getAttribute('aria-current')).toBe('true');
    await expectNoAxeViolations(document.body);
  });

  it('offers only the items whose commands the extension set registers', async () => {
    const { openOverflow } = await mount((host) =>
      host.extensions.set([StarterKit]),
    );
    expect(labels(await openOverflow())).toEqual([
      'Bold',
      'Italic',
      'Strike-through',
      'Underline',
      'Inline code',
      'Blockquote',
      'Code block',
      'Horizontal rule',
    ]);
  });

  it('has no axe violations with the overflow open', async () => {
    const { openOverflow } = await mount();
    expect((await openOverflow()).length).toBeGreaterThan(0);
    await expectNoAxeViolations(document.body);
  });
});

describe('selection bubble with the text-style controls (#514)', () => {
  it('renders the shared toolbar, new controls included, and passes axe', async () => {
    await TestBed.configureTestingModule({
      imports: [NarrowHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NarrowHost);
    fixture.componentInstance.appearance.set('floating');
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = fixture.componentInstance.editor().editor();
    if (!editor) throw new Error('Expected a browser editor.');
    const settle = async (): Promise<void> => {
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    (
      fixture.nativeElement.querySelector('.ProseMirror') as HTMLElement
    ).focus();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    await settle();
    const bubble = document.querySelector<HTMLElement>('.mlv-editor-bubble');
    expect(bubble?.classList.contains('mlv-editor-bubble--hidden')).toBe(false);
    for (const selector of [
      'mlv-editor-font-family',
      'mlv-editor-font-size',
      'mlv-editor-line-height',
      'mlv-editor-clear-formatting',
      'mlv-editor-inline-marks button[aria-label="Subscript"]',
    ]) {
      expect(bubble?.querySelector(selector), selector).not.toBeNull();
    }
    await expectNoAxeViolations(document.body);
  });
});
