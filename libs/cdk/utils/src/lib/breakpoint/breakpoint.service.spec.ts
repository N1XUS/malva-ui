// libs/cdk/utils/src/lib/breakpoint/breakpoint.service.spec.ts
import { TestBed } from '@angular/core/testing';
import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { MlvBreakpointService } from './breakpoint.service';
import { MLV_BREAKPOINT_CONFIG } from './breakpoint.config';

describe('MlvBreakpointService', () => {
  let service: MlvBreakpointService;
  let observeSubject: Subject<BreakpointState>;

  beforeEach(() => {
    observeSubject = new Subject<BreakpointState>();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => observeSubject.asObservable(),
          },
        },
        {
          provide: MLV_BREAKPOINT_CONFIG,
          useValue: { md: 768, lg: 1200 },
        },
      ],
    });

    service = TestBed.inject(MlvBreakpointService);
  });

  it('should default to sm', () => {
    expect(service.breakpoint()).toBe('sm');
  });

  it('should report md when md query matches', () => {
    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': false,
      },
    });
    expect(service.breakpoint()).toBe('md');
    expect(service.isMd()).toBe(true);
    expect(service.isSm()).toBe(false);
    expect(service.isLg()).toBe(false);
  });

  it('should report lg when both queries match', () => {
    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': true,
      },
    });
    expect(service.breakpoint()).toBe('lg');
    expect(service.isLg()).toBe(true);
  });

  it('should report sm when no query matches', () => {
    observeSubject.next({
      matches: false,
      breakpoints: {
        '(min-width: 768px)': false,
        '(min-width: 1200px)': false,
      },
    });
    expect(service.breakpoint()).toBe('sm');
    expect(service.isSm()).toBe(true);
  });

  it('isUp should return correct signals', () => {
    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': false,
      },
    });
    expect(service.isUp('sm')()).toBe(true);
    expect(service.isUp('md')()).toBe(true);
    expect(service.isUp('lg')()).toBe(false);
  });

  it('isDown should return correct signals', () => {
    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': false,
      },
    });
    expect(service.isDown('sm')()).toBe(false);
    expect(service.isDown('md')()).toBe(false);
    expect(service.isDown('lg')()).toBe(true);
  });

  it('should use custom breakpoint config', () => {
    const customSubject = new Subject<BreakpointState>();
    let observedQueries: string[] = [];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (queries: string[]) => {
              observedQueries = queries;
              return customSubject.asObservable();
            },
          },
        },
        {
          provide: MLV_BREAKPOINT_CONFIG,
          useValue: { md: 900, lg: 1440 },
        },
      ],
    });

    TestBed.inject(MlvBreakpointService);
    expect(observedQueries).toEqual([
      '(min-width: 900px)',
      '(min-width: 1440px)',
    ]);
  });
});
