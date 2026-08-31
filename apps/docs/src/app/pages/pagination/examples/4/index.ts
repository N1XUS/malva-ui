import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { MlvPagination } from '@malva-ui/core/pagination';

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
}

const ALL_EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: 'Alice Martin',
    department: 'Engineering',
    role: 'Frontend Dev',
  },
  { id: 2, name: 'Bob Chen', department: 'Engineering', role: 'Backend Dev' },
  { id: 3, name: 'Carol White', department: 'Design', role: 'UX Designer' },
  { id: 4, name: 'David Lee', department: 'Product', role: 'PM' },
  { id: 5, name: 'Eva Rodriguez', department: 'Engineering', role: 'DevOps' },
  { id: 6, name: 'Frank Kim', department: 'Design', role: 'Visual Designer' },
  {
    id: 7,
    name: 'Grace Patel',
    department: 'Engineering',
    role: 'QA Engineer',
  },
  { id: 8, name: 'Henry Brown', department: 'Marketing', role: 'Content Lead' },
  { id: 9, name: 'Iris Zhang', department: 'Engineering', role: 'Tech Lead' },
  { id: 10, name: 'James Wilson', department: 'Sales', role: 'Account Exec' },
  {
    id: 11,
    name: 'Karen Scott',
    department: 'Engineering',
    role: 'Mobile Dev',
  },
  {
    id: 12,
    name: "Liam O'Brien",
    department: 'Product',
    role: 'Product Analyst',
  },
  { id: 13, name: 'Mia Thompson', department: 'Design', role: 'Illustrator' },
  {
    id: 14,
    name: 'Noah Davis',
    department: 'Engineering',
    role: 'Data Engineer',
  },
  { id: 15, name: 'Olivia Taylor', department: 'HR', role: 'Recruiter' },
  {
    id: 16,
    name: 'Peter Johnson',
    department: 'Engineering',
    role: 'Platform Eng',
  },
  { id: 17, name: 'Quinn Adams', department: 'Finance', role: 'Controller' },
  {
    id: 18,
    name: 'Rachel Green',
    department: 'Engineering',
    role: 'Security Eng',
  },
  { id: 19, name: 'Sam Harris', department: 'Sales', role: 'Sales Manager' },
  {
    id: 20,
    name: 'Tina Clark',
    department: 'Marketing',
    role: 'SEO Specialist',
  },
];

@Component({
  selector: 'docs-pagination-table-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPagination],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class PaginationTableExampleComponent {
  readonly availableOptions = [5, 10, 20, Infinity];
  readonly allEmployees = ALL_EMPLOYEES;
  readonly currentPage = signal(1);
  readonly activeItemsPerPage = signal(5);

  readonly shownStart = computed(
    () => (this.currentPage() - 1) * this.activeItemsPerPage() + 1,
  );

  readonly shownEnd = computed(() =>
    Math.min(
      this.currentPage() * this.activeItemsPerPage(),
      this.allEmployees.length,
    ),
  );

  readonly shownCount = computed(() => this.shownEnd() - this.shownStart() + 1);

  readonly visibleRows = computed(() =>
    this.allEmployees.slice(this.shownStart() - 1, this.shownEnd()),
  );
}
