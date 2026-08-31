import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { LucidePause, LucidePlay } from '@lucide/angular';
import { MLV_CHAT_I18N } from '@malva-ui/i18n';
import { MlvButton } from '@malva-ui/core/button';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvSlider, type MlvSliderValue } from '@malva-ui/core/slider';
import type { MlvChatAttachment } from '../chat.types';
import { formatChatDuration } from '../chat-format';
import { MlvChatAudioService, type MlvChatAudioHandle } from './chat-audio.service';

/** Creates the `HTMLAudioElement` a player drives; overridable in tests. */
export const MLV_CHAT_AUDIO_FACTORY = new InjectionToken<(src: string) => HTMLAudioElement>(
  'MLV_CHAT_AUDIO_FACTORY',
  { providedIn: 'root', factory: () => (src: string) => new Audio(src) },
);

/**
 * Internal player for an audio attachment: play/pause, a seek slider, and the
 * elapsed/total time. Playback is exclusive per `mlv-chat` when the container
 * provides {@link MlvChatAudioService}.
 */
@Component({
  selector: 'mlv-chat-audio',
  templateUrl: './chat-audio.html',
  styleUrl: './chat-audio.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePause, LucidePlay, MlvButton, MlvProgress, MlvSlider],
  host: {
    class: 'mlv-chat-audio',
    '[class.mlv-chat-audio--uploading]': '_uploading()',
  },
})
export class MlvChatAudio implements MlvChatAudioHandle {
  /** The audio attachment to play. */
  readonly attachment = input.required<MlvChatAttachment>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @private Creates the underlying audio element on first playback. */
  private readonly _audioFactory = inject(MLV_CHAT_AUDIO_FACTORY);

  /** @private Container-scoped playback coordinator; null for a standalone player. */
  private readonly _playback = inject(MlvChatAudioService, { optional: true });

  /** @private Lazily created audio element; null until the first play. */
  private _audio: HTMLAudioElement | null = null;

  /** @internal True while the element is playing. */
  protected readonly _playing = signal(false);

  /** @internal Playback position in seconds. */
  protected readonly _currentTime = signal(0);

  /** @private Duration reported by the element once metadata has loaded. */
  private readonly _metadataDuration = signal<number | null>(null);

  /** @internal Total duration: element metadata wins over the declared value. */
  protected readonly _duration = computed(
    () => this._metadataDuration() ?? this.attachment().duration ?? 0,
  );

  /** @internal True while the attachment is still uploading; playback is blocked. */
  protected readonly _uploading = computed(() => {
    const progress = this.attachment().uploadProgress;
    return progress !== undefined && progress !== null;
  });

  /** @internal Formats seconds as `m:ss` for the elapsed/total readout. */
  protected readonly _formatDuration = formatChatDuration;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._audio?.pause();
      this._playback?.release(this);
    });
  }

  /** Pauses playback. Called by the container coordinator when another player starts. */
  pause(): void {
    this._audio?.pause();
    this._playing.set(false);
  }

  /** @internal Toggles between play and pause. */
  protected _toggle(): void {
    if (this._playing()) {
      this.pause();
      this._playback?.release(this);
      return;
    }
    const audio = this._ensureAudio();
    this._playback?.requestPlay(this);
    void audio.play();
    this._playing.set(true);
  }

  /**
   * @internal Seeks to the given position in seconds. The slider emits the shared
   * `MlvSliderValue` union; only the scalar form is used here (no range thumbs).
   */
  protected _seek(value: MlvSliderValue): void {
    const seconds = Array.isArray(value) ? value[0] : value;
    this._currentTime.set(seconds);
    if (this._audio) this._audio.currentTime = seconds;
  }

  /** @private Creates the audio element and wires its listeners on first use. */
  private _ensureAudio(): HTMLAudioElement {
    if (this._audio) return this._audio;

    const audio = this._audioFactory(this.attachment().src);
    audio.addEventListener('timeupdate', () => this._currentTime.set(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) this._metadataDuration.set(audio.duration);
    });
    audio.addEventListener('ended', () => {
      this._playing.set(false);
      this._currentTime.set(0);
      this._playback?.release(this);
    });
    this._audio = audio;
    return audio;
  }
}
