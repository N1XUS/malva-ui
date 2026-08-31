import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { MlvButton } from '@malva-ui/core/button';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvLoader } from '@malva-ui/core/loader';
import {
  MlvToastDescription,
  MlvToastIcon,
  MlvToastTitle,
  MlvToastRef,
  MlvToastService,
  type MlvToastTemplateContext,
} from '@malva-ui/core/toast';

interface ShareToastData {
  name: string;
  avatarUrl: string;
  file: string;
}

/**
 * Component content: a long-running job. It owns its leading spinner through
 * `[mlvToastIcon]`, swaps it for a result state, and closes itself through the
 * injected `MlvToastRef`.
 */
@Component({
  selector: 'docs-printing-toast-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvLoader, MlvToastTitle, MlvToastIcon],
  template: `
    @if (done()) {
      <mlv-loader
        mlvToastIcon
        variant="circle"
        tone="success"
        [size]="16"
        [strokeWidth]="2"
        [value]="100"
        ariaLabel="Finished"
      />
      <span mlvToastTitle>Sent to printer</span>
    } @else {
      <mlv-loader
        mlvToastIcon
        variant="circle"
        indeterminate
        [size]="16"
        [strokeWidth]="2"
        ariaLabel="Sending to printer"
      />
      <span mlvToastTitle>Sending to printer</span>
      <button
        mlvButton
        variant="transparent"
        mlvDensity="compact"
        (click)="restart()"
      >
        Restart
      </button>
    }
  `,
})
export class PrintingToastContentComponent {
  readonly ref = inject(MlvToastRef);

  /** @private Ties each simulated run to this component's lifetime. */
  private readonly _destroyRef = inject(DestroyRef);

  /** Whether the simulated print job has finished. */
  readonly done = signal(false);

  constructor() {
    this._run();
  }

  /** Restarts the simulated job, returning the toast to its pending state. */
  restart(): void {
    this.done.set(false);
    this._run();
  }

  /** @private Completes the simulated job after a delay, cancelling on destroy. */
  private _run(): void {
    timer(2500)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.done.set(true));
  }
}

@Component({
  selector: 'docs-toast-programmatic-content-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvAvatar,
    MlvBadge,
    MlvToastTitle,
    MlvToastDescription,
    MlvToastIcon,
  ],
  templateUrl: './index.html',
})
export default class ToastProgrammaticContentExampleComponent {
  private readonly _toastService = inject(MlvToastService);
  private _activeRef: MlvToastRef | null = null;

  /** Plain string content — escaped, and eligible for the built-in tone icon. */
  openString(): void {
    this._activeRef = this._toastService.open('Profile changes saved.', {
      displayTime: 0,
      tone: 'success',
      icon: true,
      shape: 'pill',
    });
  }

  /** Template content: avatar, title, an action, and the built-in close button. */
  openAvatarTemplate(
    template: TemplateRef<MlvToastTemplateContext<ShareToastData>>,
  ): void {
    this._activeRef = this._toastService.open<ShareToastData>(template, {
      displayTime: 0,
      shape: 'pill',
      data: {
        name: 'Amelia Ross',
        avatarUrl: 'https://i.pravatar.cc/64?img=47',
        file: 'Q3-forecast.xlsx',
      },
    });
  }

  /** Template content: a badge marker plus wrapped multi-line text. */
  openBadgeTemplate(template: TemplateRef<MlvToastTemplateContext>): void {
    this._activeRef = this._toastService.open(template, {
      displayTime: 0,
    });
  }

  /** Component content that drives its own leading spinner and result state. */
  openComponent(): void {
    this._activeRef = this._toastService.open(PrintingToastContentComponent, {
      displayTime: 0,
      shape: 'pill',
    });
  }

  closeActive(): void {
    this._activeRef?.close();
    this._activeRef = null;
  }
}
