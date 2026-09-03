import {
  MINUTES_PER_DAY,
  clampMinutes,
  isBusinessSlot,
  minutesFromOffset,
  parseTime,
  slotCount,
  snapMinutes,
} from './scheduler-time';

describe('scheduler-time', () => {
  it('parses HH:mm including 24:00', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('24:00')).toBe(MINUTES_PER_DAY);
    expect(() => parseTime('9:30')).toThrow(/HH:mm/);
    expect(() => parseTime('24:01')).toThrow(/HH:mm/);
    expect(() => parseTime('12:60')).toThrow(/HH:mm/);
  });

  it('snaps to the nearest multiple and clamps', () => {
    expect(snapMinutes(37, 15)).toBe(30);
    expect(snapMinutes(38, 15)).toBe(45);
    expect(snapMinutes(37, 0)).toBe(37);
    expect(clampMinutes(-5, 0, 1440)).toBe(0);
    expect(clampMinutes(1500, 0, 1440)).toBe(1440);
  });

  it('maps a pixel offset inside a column to snapped minutes of day', () => {
    // 8:00–18:00 window (600 min) over 600 px → 1 px per minute
    expect(minutesFromOffset(0, 600, 480, 1080, 30)).toBe(480);
    expect(minutesFromOffset(97, 600, 480, 1080, 30)).toBe(570); // 8:00 + 97 → 9:37 → 9:30
    expect(minutesFromOffset(-40, 600, 480, 1080, 30)).toBe(480);
    expect(minutesFromOffset(900, 600, 480, 1080, 30)).toBe(1080);
    expect(minutesFromOffset(97, 0, 480, 1080, 30)).toBe(480); // degenerate height
  });

  it('counts slots', () => {
    expect(slotCount(0, 1440, 30)).toBe(48);
    expect(slotCount(480, 1080, 15)).toBe(40);
    expect(slotCount(480, 490, 30)).toBe(1);
  });

  it('evaluates business hours with the Mon–Fri default', () => {
    const hours = { start: '09:00', end: '17:00' };
    expect(isBusinessSlot(1, 540, hours)).toBe(true);
    expect(isBusinessSlot(1, 1020, hours)).toBe(false); // 17:00 is exclusive
    expect(isBusinessSlot(0, 600, hours)).toBe(false); // Sunday
    expect(isBusinessSlot(0, 600, { ...hours, days: [0] })).toBe(true);
    expect(isBusinessSlot(1, 600, null)).toBe(false);
  });
});
