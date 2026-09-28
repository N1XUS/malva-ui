import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvCard, MlvCardHeader, MlvCardHeaderDef } from '@malva-ui/core/card';
import { MlvBadge } from '@malva-ui/core/badge';

interface LogEntry {
  time: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

@Component({
  selector: 'docs-scrollbar-card-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrollbar, MlvCard, MlvCardHeaderDef, MlvCardHeader, MlvBadge],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ScrollbarCardExampleComponent {
  readonly logs: LogEntry[] = [
    { time: '10:42:01', level: 'info', message: 'Application started' },
    { time: '10:42:03', level: 'info', message: 'Connected to database' },
    { time: '10:42:11', level: 'info', message: 'Loaded 1 204 records' },
    {
      time: '10:43:07',
      level: 'warning',
      message: 'Response time exceeded 800 ms',
    },
    {
      time: '10:43:22',
      level: 'info',
      message: 'Cache warmed up successfully',
    },
    {
      time: '10:44:05',
      level: 'error',
      message: 'Failed to reach analytics endpoint',
    },
    {
      time: '10:44:06',
      level: 'info',
      message: 'Retrying analytics (attempt 1/3)',
    },
    {
      time: '10:44:08',
      level: 'info',
      message: 'Retrying analytics (attempt 2/3)',
    },
    {
      time: '10:44:10',
      level: 'warning',
      message: 'Analytics degraded — using fallback',
    },
    { time: '10:45:00', level: 'info', message: 'Scheduled sync completed' },
    { time: '10:46:33', level: 'info', message: 'User session 7f3a started' },
    { time: '10:47:12', level: 'error', message: 'Disk usage above 90%' },
  ];
}
