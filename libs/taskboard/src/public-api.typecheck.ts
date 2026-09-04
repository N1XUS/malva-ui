// eslint-disable-next-line @nx/enforce-module-boundaries -- verifies the published package root contract.
import type {
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
} from '@malva-ui/taskboard';

interface Ticket {
  readonly id: string;
  readonly status: string;
}
const canDrop: MlvTaskboardCanDropFn<Ticket> = () => true;
const todo: MlvTaskboardColumn = { id: 'todo', label: 'Todo' };
void canDrop;
void todo;
