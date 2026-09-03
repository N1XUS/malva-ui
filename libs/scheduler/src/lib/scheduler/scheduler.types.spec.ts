import type { MlvSchedulerEvent, MlvSchedulerView } from './scheduler.types';

describe('scheduler public types', () => {
  it('accept a plain Date event with the documented optional fields', () => {
    const view: MlvSchedulerView = 'week';
    const event: MlvSchedulerEvent = {
      id: '1',
      title: 'Standup',
      start: new Date(2026, 8, 2, 9),
      end: new Date(2026, 8, 2, 9, 30),
      tone: 'info',
      draggable: false,
    };
    expect(view).toBe('week');
    expect(event.draggable).toBe(false);
    expect(event.allDay).toBeUndefined();
  });
});
