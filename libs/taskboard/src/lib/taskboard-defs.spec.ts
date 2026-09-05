import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  MlvTaskboardCardAddDef,
  type MlvTaskboardCardAddDefContext,
  MlvTaskboardColumnContentDef,
  MlvTaskboardColumnGroupDef,
  MlvTaskboardColumnHeaderDef,
  MlvTaskboardDragPreviewDef,
  type MlvTaskboardDragPreviewDefContext,
  MlvTaskboardDropIndicatorDef,
  type MlvTaskboardDropIndicatorDefContext,
  MlvTaskboardEmptyStateDef,
  MlvTaskboardHeaderDef,
  MlvTaskboardItemDef,
  type MlvTaskboardItemDefContext,
  MlvTaskboardSwimlaneDef,
} from './taskboard-defs';
import { provideTaskboardTesting } from './testing/taskboard-test-context';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

@Component({
  imports: [
    MlvTaskboardHeaderDef,
    MlvTaskboardColumnGroupDef,
    MlvTaskboardColumnHeaderDef,
    MlvTaskboardColumnContentDef,
    MlvTaskboardSwimlaneDef,
    MlvTaskboardItemDef,
    MlvTaskboardCardAddDef,
    MlvTaskboardDragPreviewDef,
    MlvTaskboardEmptyStateDef,
    MlvTaskboardDropIndicatorDef,
  ],
  template: `
    <ng-template mlvTaskboardHeaderDef let-columns="columns">{{
      columns[0]?.label
    }}</ng-template>
    <ng-template mlvTaskboardColumnGroupDef let-group let-wip="wip"
      >{{ group.label }} {{ wip.count }}</ng-template
    >
    <ng-template mlvTaskboardColumnHeaderDef let-column let-wip="wip"
      >{{ column.label }} {{ wip.count }}</ng-template
    >
    <ng-template
      mlvTaskboardColumnContentDef
      [mlvTaskboardColumnContentDefFrom]="item"
      let-items
      let-column="column"
      let-lane="swimlane"
      >{{ items.length }} {{ column.label }} {{ lane?.label }}</ng-template
    >
    <ng-template mlvTaskboardSwimlaneDef let-lane let-wip="wip"
      >{{ lane.label }} {{ wip.count }}</ng-template
    >
    <ng-template
      mlvTaskboardItemDef
      [mlvTaskboardItemDefFrom]="item"
      let-card
      let-column="column"
      let-lane="swimlane"
      >{{ card.title }} {{ column.label }} {{ lane?.label }}</ng-template
    >
    <ng-template mlvTaskboardCardAddDef let-requestAdd="requestAdd"
      ><button type="button" (click)="requestAdd()">Add</button></ng-template
    >
    <ng-template
      mlvTaskboardDragPreviewDef
      [mlvTaskboardDragPreviewDefFrom]="item"
      let-card
      let-location="location"
      >{{ card.title }} {{ location.index }}</ng-template
    >
    <ng-template
      mlvTaskboardEmptyStateDef
      let-column="column"
      let-lane="swimlane"
      >{{ column.label }} {{ lane?.label }}</ng-template
    >
    <ng-template
      mlvTaskboardDropIndicatorDef
      [mlvTaskboardDropIndicatorDefFrom]="item"
      let-valid="valid"
      let-target="target"
      >{{ valid }} {{ target.index }}</ng-template
    >
  `,
})
class TaskboardDefsHost {
  readonly item: Ticket = { id: 'ticket-1', title: 'Typed card' };

  readonly headerDef = viewChild.required(MlvTaskboardHeaderDef);
  readonly columnGroupDef = viewChild.required(MlvTaskboardColumnGroupDef);
  readonly columnHeaderDef = viewChild.required(MlvTaskboardColumnHeaderDef);
  readonly columnContentDef = viewChild.required(MlvTaskboardColumnContentDef);
  readonly swimlaneDef = viewChild.required(MlvTaskboardSwimlaneDef);
  readonly itemDef = viewChild.required(MlvTaskboardItemDef);
  readonly cardAddDef = viewChild.required(MlvTaskboardCardAddDef);
  readonly dragPreviewDef = viewChild.required(MlvTaskboardDragPreviewDef);
  readonly emptyStateDef = viewChild.required(MlvTaskboardEmptyStateDef);
  readonly dropIndicatorDef = viewChild.required(MlvTaskboardDropIndicatorDef);
}

describe('taskboard template definitions', () => {
  it('recognizes every structural projection selector and injects its template reference', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [TaskboardDefsHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaskboardDefsHost);
    fixture.detectChanges();

    expect(consoleError).not.toHaveBeenCalled();
    expect(fixture.componentInstance.headerDef().templateRef).toBeTruthy();
    expect(fixture.componentInstance.columnGroupDef().templateRef).toBeTruthy();
    expect(
      fixture.componentInstance.columnHeaderDef().templateRef,
    ).toBeTruthy();
    expect(
      fixture.componentInstance.columnContentDef().templateRef,
    ).toBeTruthy();
    expect(fixture.componentInstance.swimlaneDef().templateRef).toBeTruthy();
    expect(fixture.componentInstance.itemDef().templateRef).toBeTruthy();
    expect(fixture.componentInstance.cardAddDef().templateRef).toBeTruthy();
    expect(fixture.componentInstance.dragPreviewDef().templateRef).toBeTruthy();
    expect(fixture.componentInstance.emptyStateDef().templateRef).toBeTruthy();
    expect(
      fixture.componentInstance.dropIndicatorDef().templateRef,
    ).toBeTruthy();
    consoleError.mockRestore();
  });

  it('exposes the stable item, add, drag-preview, and drop-indicator contexts', () => {
    const column = { id: 'todo', label: 'Todo' };
    const swimlane = { id: 'engineering', label: 'Engineering' };
    const wip = { count: 1, limit: 3, remaining: 2 };
    const location = { columnId: 'todo', swimlaneId: 'engineering', index: 0 };
    const card: Ticket = { id: 'ticket-1', title: 'Fix test' };
    const itemContext: MlvTaskboardItemDefContext<Ticket> = {
      $implicit: card,
      card,
      column,
      swimlane,
      location,
      selected: true,
      wip,
    };
    const addContext: MlvTaskboardCardAddDefContext = {
      $implicit: () => undefined,
      requestAdd: () => undefined,
      column,
      swimlane,
      wip,
    };
    const dragPreviewContext: MlvTaskboardDragPreviewDefContext<Ticket> = {
      $implicit: card,
      card,
      column,
      swimlane,
      location,
      selected: true,
      wip,
    };
    const dropIndicatorContext: MlvTaskboardDropIndicatorDefContext<Ticket> = {
      $implicit: true,
      valid: true,
      target: { column, swimlane, index: 0, items: [card], wip },
    };

    expect(
      MlvTaskboardItemDef.ngTemplateContextGuard<Ticket>(
        undefined as never,
        itemContext,
      ),
    ).toBe(true);
    expect(
      MlvTaskboardCardAddDef.ngTemplateContextGuard(
        undefined as never,
        addContext,
      ),
    ).toBe(true);
    expect(
      MlvTaskboardDragPreviewDef.ngTemplateContextGuard<Ticket>(
        undefined as never,
        dragPreviewContext,
      ),
    ).toBe(true);
    expect(
      MlvTaskboardDropIndicatorDef.ngTemplateContextGuard<Ticket>(
        undefined as never,
        dropIndicatorContext,
      ),
    ).toBe(true);
  });
});
