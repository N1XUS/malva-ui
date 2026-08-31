import { Injectable } from '@angular/core';

/** Minimal contract an audio player exposes to the playback coordinator. */
export interface MlvChatAudioHandle {
  /** Stops playback of this player. */
  pause(): void;
}

/**
 * Coordinates one-at-a-time playback across the audio bubbles of a single
 * `mlv-chat`. Provided by the container, never `providedIn: 'root'` — two
 * chats on one page keep independent playback.
 */
@Injectable()
export class MlvChatAudioService {
  /** @private The player currently allowed to play. */
  private _current: MlvChatAudioHandle | null = null;

  /** Registers `player` as the active one, pausing the previously active player. */
  requestPlay(player: MlvChatAudioHandle): void {
    if (this._current && this._current !== player) this._current.pause();
    this._current = player;
  }

  /** Clears the active slot when a player pauses or ends on its own. */
  release(player: MlvChatAudioHandle): void {
    if (this._current === player) this._current = null;
  }
}
