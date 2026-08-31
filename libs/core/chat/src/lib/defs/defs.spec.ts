import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvChatAuthorDef } from './chat-author-def';
import { MlvChatDateDef } from './chat-date-def';
import { MlvChatMessageDef } from './chat-message-def';

@Component({
  imports: [MlvChatAuthorDef, MlvChatDateDef, MlvChatMessageDef],
  template: `
    <ng-template mlvChatMessageDef mlvChatMessageDefType="poll">poll</ng-template>
    <ng-template mlvChatAuthorDef>author</ng-template>
    <ng-template mlvChatDateDef>date</ng-template>
  `,
})
class DefsHost {
  readonly messageDef = viewChild.required(MlvChatMessageDef);
  readonly authorDef = viewChild.required(MlvChatAuthorDef);
  readonly dateDef = viewChild.required(MlvChatDateDef);
}

describe('chat template defs', () => {
  function setup(): DefsHost {
    const fixture = TestBed.createComponent(DefsHost);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('exposes the message template and its registered type', () => {
    const host = setup();
    expect(host.messageDef().templateRef).toBeTruthy();
    expect(host.messageDef().mlvChatMessageDefType()).toBe('poll');
  });

  it('exposes the author template', () => {
    expect(setup().authorDef().templateRef).toBeTruthy();
  });

  it('exposes the date template', () => {
    expect(setup().dateDef().templateRef).toBeTruthy();
  });

  it('defaults the message def type to an empty string', () => {
    @Component({
      imports: [MlvChatMessageDef],
      template: `<ng-template mlvChatMessageDef>untyped</ng-template>`,
    })
    class UntypedHost {
      readonly def = viewChild.required(MlvChatMessageDef);
    }

    const fixture = TestBed.createComponent(UntypedHost);
    fixture.detectChanges();
    expect(fixture.componentInstance.def().mlvChatMessageDefType()).toBe('');
  });
});
