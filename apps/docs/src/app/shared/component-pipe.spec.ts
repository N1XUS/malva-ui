import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocPageComponent } from './doc-page';
import { ComponentPipe } from './component-pipe';

describe('ComponentPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DocPageComponent, useValue: { header: signal('test'), type: signal(undefined) } },
      ],
    });
    const pipe = TestBed.runInInjectionContext(() => new ComponentPipe());
    expect(pipe).toBeTruthy();
  });
});
