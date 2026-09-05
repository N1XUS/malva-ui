// eslint-disable-next-line @nx/enforce-module-boundaries -- verifies the published package root contract.
import type {
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
  MlvTaskboardItemDefContext,
} from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly status: string;
}
const canDrop: MlvTaskboardCanDropFn<Ticket> = () => true;
const todo: MlvTaskboardColumn = { id: 'todo', label: 'Todo' };
const itemContext: MlvTaskboardItemDefContext<Ticket> = {
  $implicit: { id: '1', status: 'todo' },
  card: { id: '1', status: 'todo' },
  column: todo,
  swimlane: undefined,
  location: { columnId: 'todo', index: 0 },
  selected: false,
  wip: { count: 1, limit: 3, remaining: 2 },
};
void canDrop;
void todo;
void itemContext;
