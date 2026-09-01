// libs/cdk/utils/src/lib/breakpoint/breakpoint.service.spec.ts
import { TestBed } from '@angular/core/testing';
import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { MlvBreakpointService } from './breakpoint.service';
import { MLV_BREAKPOINT_CONFIG, type MlvBreakpoint } from './breakpoint.config';

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

  it('isUp should return the same signal instance for the same breakpoint', () => {
    expect(service.isUp('md')).toBe(service.isUp('md'));
    expect(service.isUp('sm')).toBe(service.isUp('sm'));
    expect(service.isUp('lg')).toBe(service.isUp('lg'));
  });

  it('isDown should return the same signal instance for the same breakpoint', () => {
    expect(service.isDown('md')).toBe(service.isDown('md'));
    expect(service.isDown('sm')).toBe(service.isDown('sm'));
    expect(service.isDown('lg')).toBe(service.isDown('lg'));
  });

  it('should not share signal instances across breakpoints or directions', () => {
    const distinct = new Set([
      service.isUp('sm'),
      service.isUp('md'),
      service.isUp('lg'),
      service.isDown('sm'),
      service.isDown('md'),
      service.isDown('lg'),
    ]);
    expect(distinct.size).toBe(6);
  });

  it('a cached isDown signal should track later breakpoint changes', () => {
    const isDownLg = service.isDown('lg');
    expect(isDownLg()).toBe(true); // initial 'sm'

    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': true,
      },
    });

    // Same instance, new value — the cache must memoize the signal, not the value.
    expect(service.isDown('lg')).toBe(isDownLg);
    expect(isDownLg()).toBe(false);

    observeSubject.next({
      matches: false,
      breakpoints: {
        '(min-width: 768px)': false,
        '(min-width: 1200px)': false,
      },
    });
    expect(isDownLg()).toBe(true);
  });

  it('a cached isUp signal should track later breakpoint changes', () => {
    const isUpLg = service.isUp('lg');
    expect(isUpLg()).toBe(false); // initial 'sm'

    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': true,
      },
    });

    expect(service.isUp('lg')).toBe(isUpLg);
    expect(isUpLg()).toBe(true);
  });

  // An out-of-union breakpoint resolves to `indexOf === -1`. Hoisting that
  // lookup out of the reactive body moved *when* it resolves (call time rather
  // than read time) but must not change the result: `isUp` stays permanently
  // true (`current >= -1`) and `isDown` permanently false (`current < -1`).
  // The service deliberately neither validates nor throws.
  it('should preserve the -1 semantics of an unknown breakpoint', () => {
    const bogus = 'xl' as MlvBreakpoint;

    expect(service.isUp(bogus)()).toBe(true);
    expect(service.isDown(bogus)()).toBe(false);

    observeSubject.next({
      matches: true,
      breakpoints: {
        '(min-width: 768px)': true,
        '(min-width: 1200px)': true,
      },
    });
    expect(service.isUp(bogus)()).toBe(true);
    expect(service.isDown(bogus)()).toBe(false);

    observeSubject.next({
      matches: false,
      breakpoints: {
        '(min-width: 768px)': false,
        '(min-width: 1200px)': false,
      },
    });
    expect(service.isUp(bogus)()).toBe(true);
    expect(service.isDown(bogus)()).toBe(false);
  });

  it('should not alias an unknown breakpoint onto the sm signal', () => {
    // `sm` is index 0 and an unknown breakpoint is index -1, so they must be
    // distinct nodes. Clamping the hoisted lookup (`Math.max(0, indexOf(bp))`)
    // would collapse them onto one entry. That clamp is invisible through the
    // boolean value -- `current` is 0..2, so `>= -1` and `>= 0` agree -- but it
    // breaks the stable-identity contract this cache introduces, and it also
    // diverges in value if `BREAKPOINT_ORDER` is ever emptied at runtime.
    const bogus = 'xl' as MlvBreakpoint;
    expect(service.isUp(bogus)).not.toBe(service.isUp('sm'));
    expect(service.isDown(bogus)).not.toBe(service.isDown('sm'));
  });

  it('should collapse every unknown breakpoint onto one cached signal', () => {
    // Keyed by the resolved index, so the cache stays bounded even if a caller
    // casts arbitrary strings in.
    expect(service.isUp('xl' as MlvBreakpoint)).toBe(
      service.isUp('nonsense' as MlvBreakpoint),
    );
    expect(service.isDown('xl' as MlvBreakpoint)).toBe(
      service.isDown('nonsense' as MlvBreakpoint),
    );
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
