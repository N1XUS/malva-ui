import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocPageComponent } from './doc-page';
import { ExamplePipe } from './example-pipe';

describe('ExamplePipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DocPageComponent, useValue: { header: signal('test'), type: signal(undefined) } },
      ],
    });
    const pipe = TestBed.runInInjectionContext(() => new ExamplePipe());
    expect(pipe).toBeTruthy();
  });
});
