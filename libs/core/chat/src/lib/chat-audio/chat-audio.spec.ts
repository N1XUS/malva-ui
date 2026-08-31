import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatAudio, MLV_CHAT_AUDIO_FACTORY } from './chat-audio';
import { MlvChatAudioService } from './chat-audio.service';
import type { MlvChatAttachment } from '../chat.types';

interface FakeAudio {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  currentTime: number;
  duration: number;
  src: string;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  fire: (type: string) => void;
}

function createFakeAudio(): FakeAudio {
  const listeners = new Map<string, Set<() => void>>();
  return {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    currentTime: 0,
    duration: Number.NaN,
    src: '',
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(cb);
    },
    removeEventListener(type, cb) {
      listeners.get(type)?.delete(cb);
    },
    fire(type) {
      for (const cb of listeners.get(type) ?? []) cb();
    },
  };
}

const audioAttachment = (extra: Partial<MlvChatAttachment> = {}): MlvChatAttachment => ({
  id: 'a1',
  kind: 'audio',
  src: 'voice.mp3',
  duration: 75,
  ...extra,
});

describe('MlvChatAudio', () => {
  let fake: FakeAudio;

  function setup(attachment: MlvChatAttachment = audioAttachment()) {
    const fixture = TestBed.createComponent(MlvChatAudio);
    fixture.componentRef.setInput('attachment', attachment);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    fake = createFakeAudio();
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_CHAT_AUDIO_FACTORY, useValue: () => fake as unknown as HTMLAudioElement },
      ],
    });
  });

  it('renders the duration from attachment metadata', () => {
    const el = setup().nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain('1:15');
  });

  it('plays on toggle and switches the accessible label', () => {
    const fixture = setup();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle');
    expect(btn?.getAttribute('aria-label')).toBe('Play audio message');
    btn?.click();
    fixture.detectChanges();
    expect(fake.play).toHaveBeenCalled();
    expect(btn?.getAttribute('aria-label')).toBe('Pause audio message');
  });

  it('pauses on a second toggle', () => {
    const fixture = setup();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.mlv-chat-audio__toggle',
    );
    btn?.click();
    fixture.detectChanges();
    btn?.click();
    fixture.detectChanges();
    expect(fake.pause).toHaveBeenCalled();
  });

  it('updates the elapsed time on timeupdate', () => {
    const fixture = setup();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')?.click();
    fake.currentTime = 30;
    fake.fire('timeupdate');
    fixture.detectChanges();
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain('0:30');
  });

  it('adopts the element duration once metadata loads', () => {
    const fixture = setup(audioAttachment({ duration: undefined }));
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')?.click();
    fake.duration = 42;
    fake.fire('loadedmetadata');
    fixture.detectChanges();
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain('0:42');
  });

  it('resets to the paused state when playback ends', () => {
    const fixture = setup();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle');
    btn?.click();
    fixture.detectChanges();
    fake.fire('ended');
    fixture.detectChanges();
    expect(btn?.getAttribute('aria-label')).toBe('Play audio message');
  });

  it('disables playback and shows progress while uploading', () => {
    const el = setup(audioAttachment({ uploadProgress: 50 })).nativeElement as HTMLElement;
    expect(el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')?.disabled).toBe(true);
    expect(el.querySelector('.mlv-chat-audio__upload')).toBeTruthy();
  });

  it('registers with the container playback service when one is provided', () => {
    TestBed.resetTestingModule();
    const service = new MlvChatAudioService();
    const requestPlay = vi.spyOn(service, 'requestPlay');
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_CHAT_AUDIO_FACTORY, useValue: () => fake as unknown as HTMLAudioElement },
        { provide: MlvChatAudioService, useValue: service },
      ],
    });
    const fixture = setup();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')
      ?.click();
    expect(requestPlay).toHaveBeenCalled();
  });
});

describe('MlvChatAudioService', () => {
  it('pauses the previous player when a new one starts', () => {
    const service = new MlvChatAudioService();
    const a = { pause: vi.fn() };
    const b = { pause: vi.fn() };
    service.requestPlay(a);
    service.requestPlay(b);
    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();
  });

  it('does not pause a player that requests play twice', () => {
    const service = new MlvChatAudioService();
    const a = { pause: vi.fn() };
    service.requestPlay(a);
    service.requestPlay(a);
    expect(a.pause).not.toHaveBeenCalled();
  });

  it('clears the active slot on release without pausing it later', () => {
    const service = new MlvChatAudioService();
    const a = { pause: vi.fn() };
    service.requestPlay(a);
    service.release(a);
    service.requestPlay({ pause: vi.fn() });
    expect(a.pause).not.toHaveBeenCalled();
  });

  it('ignores release from a player that is not active', () => {
    const service = new MlvChatAudioService();
    const a = { pause: vi.fn() };
    const b = { pause: vi.fn() };
    service.requestPlay(a);
    service.release(b);
    service.requestPlay(b);
    expect(a.pause).toHaveBeenCalledTimes(1);
  });
});
