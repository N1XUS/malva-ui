import { DOCUMENT } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Extensions } from '@tiptap/core';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import {
  i18nTestProvider,
  provideMlvI18nTesting,
} from '@malva-ui/i18n/testing';
import { MlvEditor, mlvEditorDefaultExtensions } from '../..';

@Component({
  imports: [MlvEditor],
  template: `<mlv-editor [extensions]="extensions()" />`,
})
class DocumentHost {
  readonly extensions = signal<Extensions | undefined>(undefined);
}

describe('MlvEditorTableControls document binding', () => {
  it('tracks the pointer on the injected document rather than the ambient global', async () => {
    const seen: string[] = [];
    // Delegates every member to the real document so CDK and Tiptap keep
    // working, and records only what is registered *through this reference*.
    // Code reaching for the bare global writes nothing here.
    const recording = new Proxy(document, {
      get(target, property) {
        if (property === 'addEventListener') {
          return (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions,
          ) => {
            seen.push(type);
            return target.addEventListener(type, listener, options);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    await TestBed.configureTestingModule({
      imports: [DocumentHost],
      providers: [
        provideMlvI18nTesting(),
        i18nTestProvider(MLV_EDITOR_I18N),
        { provide: DOCUMENT, useValue: recording },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DocumentHost);
    fixture.componentInstance.extensions.set(mlvEditorDefaultExtensions());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(seen.filter((type) => type.startsWith('pointer')).sort()).toEqual([
      'pointerleave',
      'pointermove',
    ]);

    fixture.destroy();
  });
});
