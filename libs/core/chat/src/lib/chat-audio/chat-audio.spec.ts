import { afterEveryRender } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvSlider } from '@malva-ui/core/slider';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatAudio, MLV_CHAT_AUDIO_FACTORY } from './chat-audio';
import { MlvChatAudioService } from './chat-audio.service';
import { formatChatDuration } from '../chat-format';
import type { MlvChatAttachment } from '../chat.types';

interface FakeAudio {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  currentTime: number;
  duration: number;
  src: string;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  /** Live listener count for `type` — lets a spec observe teardown, not just behaviour. */
  listenerCount: (type: string) => number;
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
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    fire(type) {
      for (const cb of [...(listeners.get(type) ?? [])]) cb();
    },
  };
}

const audioAttachment = (
  extra: Partial<MlvChatAttachment> = {},
): MlvChatAttachment => ({
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
        {
          provide: MLV_CHAT_AUDIO_FACTORY,
          useValue: () => fake as unknown as HTMLAudioElement,
        },
      ],
    });
  });

  it('renders the duration from attachment metadata', () => {
    const el = setup().nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain(
      '1:15',
    );
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
    const btn = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle');
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
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain(
      '0:30',
    );
  });

  it('adopts the element duration once metadata loads', () => {
    const fixture = setup(audioAttachment({ duration: undefined }));
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')?.click();
    fake.duration = 42;
    fake.fire('loadedmetadata');
    fixture.detectChanges();
    expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain(
      '0:42',
    );
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
    const el = setup(audioAttachment({ uploadProgress: 50 }))
      .nativeElement as HTMLElement;
    expect(
      el.querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')?.disabled,
    ).toBe(true);
    expect(el.querySelector('.mlv-chat-audio__upload')).toBeTruthy();
  });

  it('registers with the container playback service when one is provided', () => {
    TestBed.resetTestingModule();
    const service = new MlvChatAudioService();
    const requestPlay = vi.spyOn(service, 'requestPlay');
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MLV_CHAT_AUDIO_FACTORY,
          useValue: () => fake as unknown as HTMLAudioElement,
        },
        { provide: MlvChatAudioService, useValue: service },
      ],
    });
    const fixture = setup();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')
      ?.click();
    expect(requestPlay).toHaveBeenCalled();
  });

  describe('playback tick quantization', () => {
    /** Reads the component's `@internal` position signal without widening its API. */
    const positionOf = (fixture: ComponentFixture<MlvChatAudio>) =>
      (
        fixture.componentInstance as unknown as { _currentTime: () => number }
      )._currentTime();

    /** Starts playback, which is what lazily creates the element and wires its listeners. */
    function play(fixture: ComponentFixture<MlvChatAudio>): void {
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.mlv-chat-audio__toggle')
        ?.click();
      fixture.detectChanges();
    }

    /**
     * Raw `currentTime` values a real element can report, including the values
     * that make flooring observable at all (fractions either side of a second
     * boundary) and the non-finite/negative cases `formatChatDuration` guards.
     */
    const RAW_TIMES = [
      0,
      -0,
      0.4,
      0.999,
      1,
      1.5,
      59.9,
      60,
      61.2,
      599.99,
      -3.7,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ];
    const label = (raw: number) => (Object.is(raw, -0) ? '-0' : String(raw));

    it('formatChatDuration is invariant under Math.floor for every raw position', () => {
      for (const raw of RAW_TIMES) {
        expect(formatChatDuration(Math.floor(raw))).toBe(
          formatChatDuration(raw),
        );
      }
    });

    for (const raw of RAW_TIMES) {
      it(`renders the unquantized readout for currentTime ${label(raw)}`, () => {
        const fixture = setup();
        const el = fixture.nativeElement as HTMLElement;
        play(fixture);
        fake.currentTime = raw;
        fake.fire('timeupdate');
        fixture.detectChanges();
        expect(
          el.querySelector('.mlv-chat-audio__time')?.textContent?.trim(),
        ).toBe(`${formatChatDuration(raw)} / 1:15`);
      });
    }

    it('collapses timeupdate ticks inside one second into a single change-detection pass', async () => {
      const fixture = setup();
      play(fixture);
      await fixture.whenStable();

      let passes = 0;
      TestBed.runInInjectionContext(() => {
        afterEveryRender(() => {
          passes += 1;
        });
      });
      await fixture.whenStable();
      passes = 0;

      // Four ticks inside the same whole second: only the first changes the signal.
      for (const seconds of [1.1, 1.4, 1.7, 1.95]) {
        fake.currentTime = seconds;
        fake.fire('timeupdate');
        await fixture.whenStable();
      }
      expect(passes).toBe(1);

      // Crossing into the next second costs exactly one more pass.
      fake.currentTime = 2.2;
      fake.fire('timeupdate');
      await fixture.whenStable();
      expect(passes).toBe(2);

      // Every further tick inside that second is free again.
      for (const seconds of [2.5, 2.8]) {
        fake.currentTime = seconds;
        fake.fire('timeupdate');
        await fixture.whenStable();
      }
      expect(passes).toBe(2);
    });

    it('keeps the seek slider on-step while playing', () => {
      const fixture = setup();
      const el = fixture.nativeElement as HTMLElement;
      play(fixture);
      fake.currentTime = 61.2;
      fake.fire('timeupdate');
      fixture.detectChanges();
      expect(
        el
          .querySelector('.mlv-chat-audio__seek [role="slider"]')
          ?.getAttribute('aria-valuenow'),
      ).toBe('61');
    });

    it('seeks to the exact value the slider emits, on both the signal and the element', () => {
      const fixture = setup();
      play(fixture);
      const slider = fixture.debugElement.query(By.directive(MlvSlider))
        .componentInstance as MlvSlider;

      slider.value.set(12.34);
      fixture.detectChanges();

      expect(positionOf(fixture)).toBe(12.34);
      expect(fake.currentTime).toBe(12.34);
    });

    it('resets the position to exactly 0 and releases the coordinator when playback ends', () => {
      TestBed.resetTestingModule();
      const service = new MlvChatAudioService();
      const release = vi.spyOn(service, 'release');
      TestBed.configureTestingModule({
        providers: [
          provideMlvI18nTesting(),
          {
            provide: MLV_CHAT_AUDIO_FACTORY,
            useValue: () => fake as unknown as HTMLAudioElement,
          },
          { provide: MlvChatAudioService, useValue: service },
        ],
      });
      const fixture = setup();
      play(fixture);
      fake.currentTime = 30;
      fake.fire('timeupdate');
      fixture.detectChanges();
      expect(positionOf(fixture)).toBe(30);

      fake.fire('ended');
      fixture.detectChanges();

      expect(positionOf(fixture)).toBe(0);
      expect(release).toHaveBeenCalledWith(fixture.componentInstance);
    });

    it('ignores a non-finite element duration on loadedmetadata', () => {
      const fixture = setup();
      const el = fixture.nativeElement as HTMLElement;
      play(fixture);
      fake.duration = Number.POSITIVE_INFINITY;
      fake.fire('loadedmetadata');
      fixture.detectChanges();
      expect(el.querySelector('.mlv-chat-audio__time')?.textContent).toContain(
        '/ 1:15',
      );
    });

    it('removes every listener on destroy and stops writing the position', () => {
      const fixture = setup();
      play(fixture);
      fake.currentTime = 5;
      fake.fire('timeupdate');
      fixture.detectChanges();
      expect(positionOf(fixture)).toBe(5);
      expect(fake.listenerCount('timeupdate')).toBe(1);

      fixture.destroy();

      expect(fake.listenerCount('timeupdate')).toBe(0);
      expect(fake.listenerCount('loadedmetadata')).toBe(0);
      expect(fake.listenerCount('ended')).toBe(0);

      fake.currentTime = 9;
      expect(() => fake.fire('timeupdate')).not.toThrow();
      expect(positionOf(fixture)).toBe(5);
    });
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
