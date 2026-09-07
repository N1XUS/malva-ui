import { ApplicationInitStatus, ApplicationRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { SupportInboxShowcaseComponent } from './support-inbox';
import { AGENT_BY_ID, TICKETS, type SupportTicket } from './support-inbox.data';

interface Rendered {
  readonly fixture: ComponentFixture<SupportInboxShowcaseComponent>;
  readonly component: SupportInboxShowcaseComponent;
  readonly root: HTMLElement;
}

async function settle(rendered: Rendered): Promise<void> {
  rendered.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  rendered.fixture.detectChanges();
}

async function render(): Promise<Rendered> {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      media: query,
      matches: true,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  await TestBed.configureTestingModule({
    imports: [SupportInboxShowcaseComponent],
    providers: [
      provideAnimationsAsync('noop'),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const fixture = TestBed.createComponent(SupportInboxShowcaseComponent);
  const rendered: Rendered = {
    fixture,
    component: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
  await settle(rendered);
  return rendered;
}

function rows(rendered: Rendered): HTMLElement[] {
  return Array.from(
    rendered.root.querySelectorAll<HTMLElement>('.support-inbox__row'),
  );
}

/** Matches on the subject, which is unique per fixture — two requesters own two tickets each. */
function rowFor(rendered: Rendered, subject: string): HTMLElement {
  const match = rows(rendered).find((row) =>
    row.textContent?.includes(subject),
  );
  if (!match) throw new Error(`No conversation row for "${subject}"`);
  return match;
}

function activeTicket(rendered: Rendered): SupportTicket {
  const ticket = rendered.component.activeTicket();
  if (!ticket) throw new Error('No conversation is open');
  return ticket;
}

function ticketById(id: string): SupportTicket {
  const ticket = TICKETS.find((item) => item.id === id);
  if (!ticket) throw new Error(`No fixture ticket ${id}`);
  return ticket;
}

describe('SupportInboxShowcaseComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('seeds the whole inbox and opens the first conversation', async () => {
    const rendered = await render();

    expect(rows(rendered)).toHaveLength(TICKETS.length);
    expect(rendered.component.activeTicket()?.id).toBe(TICKETS[0].id);
    expect(rendered.root.querySelector('.support-inbox__details')).toBeTruthy();
  });

  it('exposes the conversation list as a single-select listbox', async () => {
    const rendered = await render();
    const list = rendered.root.querySelector('mlv-list');
    const [first] = rows(rendered);

    expect(list?.getAttribute('role')).toBe('listbox');
    expect(list?.getAttribute('aria-label')).toBe('Conversations');
    expect(first.getAttribute('role')).toBe('option');
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(rows(rendered)[1].getAttribute('aria-selected')).toBe('false');
  });

  it('clears the unread counter of the conversation it opens', async () => {
    const rendered = await render();
    const unreadTicket = TICKETS.find(
      (ticket) => ticket.unread > 0 && ticket.id !== TICKETS[0].id,
    );
    if (!unreadTicket) throw new Error('Fixtures have no second unread ticket');

    rowFor(rendered, unreadTicket.subject).click();
    await settle(rendered);

    expect(activeTicket(rendered).id).toBe(unreadTicket.id);
    expect(activeTicket(rendered).unread).toBe(0);
  });

  it('matches the search against every documented field', async () => {
    const rendered = await render();
    const ids = () => rendered.component.visibleTickets().map((t) => t.id);

    rendered.component.query.set('CS-4815');
    await settle(rendered);
    expect(ids()).toEqual(['CS-4815']);

    rendered.component.query.set('countersigned');
    await settle(rendered);
    expect(ids()).toContain('CS-4796');

    rendered.component.query.set('amara');
    await settle(rendered);
    expect(ids()).toEqual(expect.arrayContaining(['CS-4821', 'CS-4788']));

    rendered.component.query.set('northwind');
    await settle(rendered);
    expect(
      rendered.component
        .visibleTickets()
        .every((ticket) => ticket.account.name === 'Northwind Labs'),
    ).toBe(true);

    rendered.component.query.set('saml');
    await settle(rendered);
    expect(ids()).toContain('CS-4821');
  });

  it('narrows the list by rail view and status filter', async () => {
    const rendered = await render();

    rendered.component.selectView('breached');
    await settle(rendered);
    expect(
      rendered.component
        .visibleTickets()
        .every((ticket) => ticket.sla.resolutionState === 'breached'),
    ).toBe(true);

    rendered.component.selectView('agent:agent-lindqvist');
    await settle(rendered);
    expect(
      rendered.component
        .visibleTickets()
        .every((ticket) => ticket.assigneeId === 'agent-lindqvist'),
    ).toBe(true);

    rendered.component.selectView('all');
    rendered.component.statusFilter.set('pending');
    await settle(rendered);
    const pending = rendered.component.visibleTickets();
    expect(
      pending.every((t) => t.status === 'pending' || t.status === 'on-hold'),
    ).toBe(true);
    expect(pending.some((t) => t.status === 'on-hold')).toBe(true);

    rendered.component.statusFilter.set('solved');
    await settle(rendered);
    expect(
      rendered.component
        .visibleTickets()
        .every((t) => t.status === 'solved' || t.status === 'closed'),
    ).toBe(true);
  });

  it('orders the list by each sort mode', async () => {
    const rendered = await render();
    const ids = () => rendered.component.visibleTickets().map((t) => t.id);

    rendered.component.sort.set('newest');
    await settle(rendered);
    const newest = ids();
    rendered.component.sort.set('oldest');
    await settle(rendered);
    expect(ids()).toEqual([...newest].reverse());

    rendered.component.sort.set('priority');
    await settle(rendered);
    expect(rendered.component.visibleTickets()[0].priority).toBe('urgent');

    rendered.component.sort.set('sla');
    await settle(rendered);
    expect(rendered.component.visibleTickets()[0].sla.resolutionState).toBe(
      'breached',
    );
  });

  it('resets the composer when a view change swaps the open conversation', async () => {
    const rendered = await render();
    rendered.component.draft.set('Half-written reply');
    rendered.component.composerMode.set('note');

    rendered.component.selectView('solved');
    await settle(rendered);

    expect(activeTicket(rendered).id).not.toBe(TICKETS[0].id);
    expect(rendered.component.draft()).toBe('');
    expect(rendered.component.composerMode()).toBe('reply');
    expect(activeTicket(rendered).unread).toBe(0);
  });

  it('leaves the open conversation alone when it survives the view change', async () => {
    const rendered = await render();
    rendered.component.draft.set('Still typing');

    rendered.component.selectView('breached');
    await settle(rendered);

    expect(activeTicket(rendered).id).toBe(TICKETS[0].id);
    expect(rendered.component.draft()).toBe('Still typing');
  });

  it('empties the reading pane when a view matches nothing', async () => {
    const rendered = await render();

    rendered.component.query.set('no-such-conversation');
    await settle(rendered);
    rendered.component.selectView('mine');
    await settle(rendered);

    expect(rendered.component.activeTicket()).toBeNull();
    expect(rows(rendered)).toHaveLength(0);
    expect(
      rendered.root.querySelector('.support-inbox__list-empty'),
    ).toBeTruthy();
  });

  it('appends a sent reply and hands the conversation back to the customer', async () => {
    const rendered = await render();
    const before = activeTicket(rendered);
    const messageCount = before.conversation.length;

    rendered.component.draft.set('Rolling the hotfix now.');
    rendered.component.sendReply();
    await settle(rendered);

    const after = activeTicket(rendered);
    const sent = after.conversation[after.conversation.length - 1];
    expect(after.conversation).toHaveLength(messageCount + 1);
    expect(sent?.text).toBe('Rolling the hotfix now.');
    expect(sent?.id).toBe(`${before.id}-m${messageCount + 1}`);
    expect(sent?.authorId).toBe(rendered.component.chatSelfId());
    expect(after.waitingOn).toBe('customer');
    expect(rendered.component.snippetFor(after)).toBe(
      'Rolling the hotfix now.',
    );
    expect(rendered.component.draft()).toBe('');
  });

  it('keeps existing agent replies on the agent side after a reassignment', async () => {
    const rendered = await render();
    const before = activeTicket(rendered);
    const agentSideBefore = rendered.component.chatSelfId();
    const target = rendered.component.agents.find(
      (agent) => agent.id !== before.assigneeId,
    );
    if (!target) throw new Error('No teammate to reassign to');

    rendered.component.assignTo(target);
    await settle(rendered);

    const after = activeTicket(rendered);
    expect(after.assigneeId).toBe(target.id);
    expect(rendered.component.chatSelfId()).toBe(agentSideBefore);
    expect(
      after.conversation
        .filter((message) => AGENT_BY_ID.has(message.authorId))
        .every((message) => message.authorId === agentSideBefore),
    ).toBe(true);
  });

  it('adds an internal note without touching the customer-visible thread', async () => {
    const rendered = await render();
    const before = activeTicket(rendered);

    rendered.component.composerMode.set('note');
    rendered.component.noteDraft.set('Do not send the cookie-clearing macro.');
    rendered.component.addNote();
    await settle(rendered);

    const after = activeTicket(rendered);
    expect(after.notes).toHaveLength(before.notes.length + 1);
    expect(after.notes[after.notes.length - 1]?.text).toBe(
      'Do not send the cookie-clearing macro.',
    );
    expect(after.conversation).toHaveLength(before.conversation.length);
    expect(rendered.component.noteDraft()).toBe('');
    expect(rendered.component.showDetails()).toBe(true);
  });

  it('records every mutating action in the activity trail', async () => {
    const rendered = await render();
    const before = activeTicket(rendered).activity.length;

    rendered.component.toggleStar();
    rendered.component.setPriority('low');
    rendered.component.setStatus('solved');
    await settle(rendered);

    const after = activeTicket(rendered);
    expect(after.activity).toHaveLength(before + 3);
    expect(after.starred).toBe(!ticketById(after.id).starred);
    expect(after.priority).toBe('low');
    expect(after.status).toBe('solved');
    // `activeActivity` is newest-first for the timeline.
    expect(rendered.component.activeActivity()[0].action).toBe(
      'Set status to solved',
    );
  });

  it('shows the requester as typing only briefly after opening their conversation', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    const waiting = TICKETS.find(
      (ticket) =>
        ticket.requester.online &&
        ticket.waitingOn === 'agent' &&
        ticket.id !== TICKETS[0].id,
    );
    if (!waiting)
      throw new Error('Fixtures have no second waiting conversation');

    rendered.component.selectTicket(waiting);
    expect(rendered.component.typingUsers()).toEqual([waiting.requester.id]);

    vi.advanceTimersByTime(3300);
    expect(rendered.component.typingUsers()).toEqual([]);
  });

  it('stops the typing indicator as soon as the agent replies', async () => {
    vi.useFakeTimers();
    const rendered = await render();
    const waiting = TICKETS.find(
      (ticket) => ticket.requester.online && ticket.waitingOn === 'agent',
    );
    if (!waiting) throw new Error('Fixtures have no waiting conversation');

    rendered.component.selectTicket(waiting);
    expect(rendered.component.typingUsers()).not.toEqual([]);

    rendered.component.draft.set('On it.');
    rendered.component.sendReply();
    expect(rendered.component.typingUsers()).toEqual([]);
  });

  it('counts rail views and hides empty badges', async () => {
    const rendered = await render();

    expect(rendered.component.badgeFor('all')).toBe(TICKETS.length);
    expect(rendered.component.badgeFor('unassigned')).toBe(
      TICKETS.filter((ticket) => ticket.assigneeId === null).length,
    );
    expect(rendered.component.badgeFor('no-such-view')).toBeNull();
  });

  it('retries a failed message', async () => {
    const rendered = await render();
    const failed = TICKETS.find((ticket) =>
      ticket.conversation.some((message) => message.status === 'failed'),
    );
    if (!failed) throw new Error('Fixtures have no failed message');
    const target = failed.conversation.find((m) => m.status === 'failed');
    if (!target) throw new Error('unreachable');

    rendered.component.selectTicket(failed);
    await settle(rendered);
    rendered.component.onRetry(target);
    await settle(rendered);

    expect(
      activeTicket(rendered).conversation.find((m) => m.id === target.id)
        ?.status,
    ).toBe('sending');
  });

  it('pushes the thread pane when a conversation is opened and pops it on back', async () => {
    const rendered = await render();
    expect(rendered.component.pane()).toBe('list');

    rowFor(rendered, TICKETS[1].subject).click();
    await settle(rendered);
    expect(rendered.component.pane()).toBe('thread');
    expect(
      rendered.root.querySelector('.support-inbox--pane-thread'),
    ).toBeTruthy();

    rendered.component.backToList();
    await settle(rendered);
    expect(rendered.component.pane()).toBe('list');
    expect(
      rendered.root.querySelector('.support-inbox--pane-list'),
    ).toBeTruthy();
  });

  it('returns to the list pane when a view leaves nothing to show', async () => {
    const rendered = await render();
    rendered.component.selectTicketId(TICKETS[1].id);
    await settle(rendered);
    expect(rendered.component.pane()).toBe('thread');

    rendered.component.query.set('no-such-conversation');
    rendered.component.selectView('mine');
    await settle(rendered);

    expect(rendered.component.activeTicket()).toBeNull();
    expect(rendered.component.pane()).toBe('list');
  });

  it('clears the search and the status filter from the empty state', async () => {
    const rendered = await render();
    rendered.component.query.set('no-such-conversation');
    rendered.component.statusFilter.set('solved');
    await settle(rendered);

    rendered.component.clearFilters();
    await settle(rendered);

    expect(rendered.component.query()).toBe('');
    expect(rendered.component.statusFilter()).toBe('all');
    expect(rows(rendered)).toHaveLength(TICKETS.length);
  });

  it('folds the unread count into the option label', async () => {
    const rendered = await render();
    const unread = TICKETS.find((ticket) => ticket.unread > 0);
    if (!unread) throw new Error('Fixtures have no unread ticket');
    const read = TICKETS.find((ticket) => ticket.unread === 0);
    if (!read) throw new Error('Fixtures have no read ticket');

    expect(rendered.component.rowLabel(unread)).toContain(
      `${unread.unread} unread`,
    );
    expect(rendered.component.rowLabel(read)).not.toContain('unread');
  });

  it('never reports the details pane open without a conversation', async () => {
    const rendered = await render();
    rendered.component.showDetails.set(true);
    rendered.component.activeTicketId.set(null);
    await settle(rendered);

    expect(rendered.component.detailsOpen()).toBe(false);

    rendered.component.onDetailsOpenedChange(false);
    await settle(rendered);
    expect(rendered.component.showDetails()).toBe(false);
  });

  it('keeps the composition axe-clean with and without the details panel', async () => {
    const rendered = await render();
    await expectNoAxeViolations(rendered.root);

    rendered.component.toggleDetails();
    await settle(rendered);
    expect(rendered.root.querySelector('.support-inbox__details')).toBeNull();
    await expectNoAxeViolations(rendered.root);
  });
});
