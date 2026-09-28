import { MLV_FIT_EPSILON_PX } from './overflow-fit';
import { mlvOverflowRevealGuard } from './overflow-reveal-guard';

describe('mlvOverflowRevealGuard', () => {
  let now = 0;

  beforeEach(() => {
    now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => vi.restoreAllMocks());

  it('always admits a hide', () => {
    const guard = mlvOverflowRevealGuard(100);
    expect(guard.admit(3, 1, 200)).toBe(true);
  });

  it('admits a reveal nothing has refused', () => {
    const guard = mlvOverflowRevealGuard(100);
    expect(guard.admit(1, 3, 200)).toBe(true);
  });

  it('admits a split that changes nothing', () => {
    const guard = mlvOverflowRevealGuard(100);
    expect(guard.admit(2, 2, 200)).toBe(true);
  });

  it('refuses a reveal that undid itself within the window, at that width or narrower', () => {
    const guard = mlvOverflowRevealGuard(100);
    expect(guard.admit(0, 2, 300)).toBe(true); // reveal everything
    now += 50;
    expect(guard.admit(1, 0, 290)).toBe(true); // …and it did not fit

    now += 500;
    expect(guard.admit(0, 1, 300)).toBe(false);
    expect(guard.admit(0, 1, 280)).toBe(false);
    // A smaller reveal was never shown not to fit.
    expect(guard.admit(1, 2, 300)).toBe(true);
  });

  it('forgets a refusal once the row is wider than the width that failed', () => {
    const guard = mlvOverflowRevealGuard(100);
    guard.admit(0, 2, 300);
    now += 50;
    guard.admit(1, 0, 290);

    expect(guard.admit(0, 1, 300 + MLV_FIT_EPSILON_PX)).toBe(false);
    expect(guard.admit(0, 1, 300 + MLV_FIT_EPSILON_PX + 0.01)).toBe(true);
  });

  it('does not refuse a reveal whose hide came after the window', () => {
    const guard = mlvOverflowRevealGuard(100);
    guard.admit(0, 2, 300);
    now += 101;
    guard.admit(1, 0, 290);

    expect(guard.admit(0, 1, 300)).toBe(true);
  });

  it('forgets everything on reset()', () => {
    const guard = mlvOverflowRevealGuard(100);
    guard.admit(0, 2, 300);
    now += 50;
    guard.admit(1, 0, 290);

    guard.reset();
    expect(guard.admit(0, 1, 300)).toBe(true);
  });
});
