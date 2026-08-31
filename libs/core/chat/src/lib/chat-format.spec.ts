import { formatChatDuration } from './chat-format';

describe('formatChatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatChatDuration(75)).toBe('1:15');
    expect(formatChatDuration(9)).toBe('0:09');
    expect(formatChatDuration(0)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(formatChatDuration(59.9)).toBe('0:59');
  });

  it('clamps negative and non-finite input to 0:00', () => {
    expect(formatChatDuration(-3)).toBe('0:00');
    expect(formatChatDuration(Number.NaN)).toBe('0:00');
    expect(formatChatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});
