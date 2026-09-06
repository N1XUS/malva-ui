import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatMediaGrid } from './chat-media-grid';
import type { MlvChatAttachment } from '../chat.types';

const att = (
  id: string,
  extra: Partial<MlvChatAttachment> = {},
): MlvChatAttachment => ({
  id,
  kind: 'image',
  src: `${id}.png`,
  ...extra,
});

function setup(
  attachments: MlvChatAttachment[],
  inputs: Record<string, unknown> = {},
) {
  const fixture = TestBed.createComponent(MlvChatMediaGrid);
  fixture.componentRef.setInput('attachments', attachments);
  for (const [k, v] of Object.entries(inputs))
    fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

describe('MlvChatMediaGrid', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('renders one large cell for a single image with reserved aspect-ratio', () => {
    const el = setup([att('a', { width: 400, height: 300 })])
      .nativeElement as HTMLElement;
    const cell = el.querySelector<HTMLElement>('.mlv-chat-media-grid__cell');
    expect(el.classList).toContain('mlv-chat-media-grid--single');
    expect(cell?.style.aspectRatio).toBe('400 / 300');
  });

  it('renders at most 4 cells with a +N overlay', () => {
    const el = setup([
      att('a'),
      att('b'),
      att('c'),
      att('d'),
      att('e'),
      att('f'),
    ]).nativeElement as HTMLElement;
    expect(el.querySelectorAll('.mlv-chat-media-grid__cell')).toHaveLength(4);
    expect(
      el.querySelector('.mlv-chat-media-grid__more')?.textContent,
    ).toContain('2');
  });

  it('emits mediaClick with the clicked attachment', () => {
    const first = att('a');
    const fixture = setup([first, att('b')]);
    const spy = vi.fn();
    fixture.componentInstance.mediaClick.subscribe(spy);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mlv-chat-media-grid__cell')
      ?.click();
    expect(spy).toHaveBeenCalledWith(first);
  });

  it('falls back to the i18n alt text when an image has none', () => {
    const el = setup([att('a')]).nativeElement as HTMLElement;
    const img = el.querySelector<HTMLImageElement>('img');
    expect(
      el
        .querySelector('.mlv-chat-media-grid__cell')
        ?.getAttribute('aria-label'),
    ).toBe('Image attachment');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('uses the provided alt text', () => {
    const el = setup([att('a', { alt: 'A cat' })]).nativeElement as HTMLElement;
    expect(el.querySelector<HTMLImageElement>('img')?.getAttribute('alt')).toBe(
      'A cat',
    );
  });

  it('renders gif as a muted looping autoplay video', () => {
    const el = setup([att('a', { kind: 'gif', src: 'a.mp4' })])
      .nativeElement as HTMLElement;
    const video = el.querySelector<HTMLVideoElement>('video');
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
  });

  it('renders video as poster + play badge + duration chip', () => {
    const el = setup([
      att('a', { kind: 'video', poster: 'p.jpg', duration: 75 }),
    ]).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-media-grid__play')).toBeTruthy();
    expect(
      el.querySelector('.mlv-chat-media-grid__duration')?.textContent,
    ).toContain('1:15');
    expect(el.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(
      'p.jpg',
    );
  });

  it('renders a video without a poster as a metadata-preload video element', () => {
    const el = setup([att('a', { kind: 'video', src: 'v.mp4' })])
      .nativeElement as HTMLElement;
    expect(
      el.querySelector<HTMLVideoElement>('video')?.getAttribute('preload'),
    ).toBe('metadata');
  });

  it('mutes every video through the live property, not the attribute alone', async () => {
    // In the engines this library runs on today, a `muted` content attribute
    // set after creation does not reach the live `muted` property: a
    // client-rendered `<video>` is `createElement` + `setAttribute`, which
    // leaves `muted === false` (measured in Chrome 152; jsdom 22, the runtime
    // of this suite, agrees). So the static attribute that keeps the server
    // payload muted (#136) cannot be the whole fix, and `MlvChatMutedVideo`
    // writes the property on creation. This asserts both halves, so dropping
    // either turns it red.
    //
    // It is a *current-engine* assertion, not a spec one: the HTML Standard
    // now defines a tristate `muted state` under which the attribute alone
    // would suffice, and Gecko shipped that in Firefox 153. When Chromium and
    // jsdom follow, the `.muted` column here will pass on the attribute alone
    // and the directive can go — see `chat-muted-video.ts`.
    const fixture = setup([
      att('a', { kind: 'gif', src: 'a.mp4' }),
      att('b', { kind: 'video', src: 'b.mp4' }),
    ]);
    await fixture.whenStable();

    const videos = [
      ...(
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLVideoElement>('video'),
    ];

    expect(videos).toHaveLength(2);
    expect(videos.map((video) => video.muted)).toEqual([true, true]);
    expect(videos.map((video) => video.hasAttribute('muted'))).toEqual([
      true,
      true,
    ]);
  });

  it('mutes a video that only appears on a later render', async () => {
    // A chat is a live feed, so a media cell can arrive long after the grid
    // first rendered — an upload completing, or an edit adding an attachment.
    // Muting from the directive covers that for free (a later cell is a new
    // element with its own directive instance); a one-shot hook on the grid
    // would not.
    const fixture = setup([att('a')]);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('video'),
    ).toBeNull();

    fixture.componentRef.setInput('attachments', [
      att('a'),
      att('b', { kind: 'gif', src: 'b.mp4' }),
    ]);
    await fixture.whenStable();

    const video = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
  });

  it('shows the upload overlay while uploadProgress is set', () => {
    const el = setup([att('a', { uploadProgress: 40 })])
      .nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-media-grid__upload')).toBeTruthy();
    expect(
      el.querySelector('.mlv-chat-media-grid__cell--uploading'),
    ).toBeTruthy();
  });

  it('hides the upload overlay once uploadProgress is cleared', () => {
    const el = setup([att('a')]).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-media-grid__upload')).toBeNull();
  });

  it('renders a skeleton until the image load event fires', () => {
    const fixture = setup([att('a')]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mlv-skeleton')).toBeTruthy();
    el.querySelector('img')?.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(el.querySelector('mlv-skeleton')).toBeNull();
  });

  it('quote mode renders only the first attachment', () => {
    const el = setup([att('a'), att('b')], { quote: true })
      .nativeElement as HTMLElement;
    expect(el.querySelectorAll('.mlv-chat-media-grid__cell')).toHaveLength(1);
    expect(el.classList).toContain('mlv-chat-media-grid--quote');
    expect(el.querySelector('.mlv-chat-media-grid__more')).toBeNull();
  });
});
