import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { Observable } from 'rxjs';
import { MlvResizeObserverService } from '../observers/resize-observer.service';
import { MlvFade } from './fade';

describe('MlvFade', () => {
  let component: MlvFade;
  let fixture: ComponentFixture<MlvFade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFade],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFade);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not subscribe to resize observation during server rendering', async () => {
    let subscriptions = 0;

    @Component({
      selector: 'mlv-fade-ssr-host',
      imports: [MlvFade],
      template: '<div mlvFade>Overflowing content</div>',
    })
    class FadeSsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          FadeSsrHost,
          {
            providers: [
              {
                provide: MlvResizeObserverService,
                useValue: {
                  observe: () =>
                    new Observable(() => {
                      subscriptions += 1;
                    }),
                },
              },
            ],
          },
          context,
        ),
      {
        document: '<mlv-fade-ssr-host></mlv-fade-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('mlv-fade');
    expect(subscriptions).toBe(0);
  });
});
