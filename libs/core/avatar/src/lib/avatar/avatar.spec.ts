import { Component, viewChildren } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvAvatar, deriveInitials } from './avatar';

describe('MlvAvatar', () => {
  let component: MlvAvatar;
  let fixture: ComponentFixture<MlvAvatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvAvatar],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvAvatar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('deriveInitials', () => {
  it('should derive initials from two-part name', () => {
    expect(deriveInitials('John Doe')).toBe('JD');
  });

  it('should derive initial from single-part name', () => {
    expect(deriveInitials('Alice')).toBe('A');
  });

  it('should take only first two parts from multi-part name', () => {
    expect(deriveInitials('John Michael Doe')).toBe('JM');
  });

  it('should return empty string for empty input', () => {
    expect(deriveInitials('')).toBe('');
  });

  it('should handle whitespace-only input', () => {
    expect(deriveInitials('   ')).toBe('');
  });

  it('should uppercase initials', () => {
    expect(deriveInitials('john doe')).toBe('JD');
  });

  it('should handle leading/trailing whitespace', () => {
    expect(deriveInitials('  Jane Smith  ')).toBe('JS');
  });
});

/**
 * Accessibility sweep.
 *
 * The avatar's whole a11y contract is the host `role="img"` + `aria-label`
 * pair, which is conditional: `_accessibleName()` is `name || label || null`,
 * and a `null` name must drop the role rather than emit a nameless
 * `role="img"`. Everything inside the visual is `aria-hidden` (skeleton,
 * `<img alt="">`, initials), so each content mode changes what axe sees.
 * The four modes swept below are the four the docs page promotes
 * (`apps/docs/src/app/pages/avatar/examples/1..4`): name-derived initials with
 * a label, an image, projected icon content, and explicit initials — plus the
 * icon-only avatar with neither `name` nor `label`, which is the only render
 * that is deliberately role-less.
 */
describe('MlvAvatar accessibility', () => {
  @Component({
    imports: [MlvAvatar],
    template: `
      <!-- examples/1: name-derived initials, sized, labelled. -->
      <mlv-avatar size="xs" shape="circle" name="John Doe" label="xs" />
      <mlv-avatar size="xxl" shape="square" name="Jane Smith" label="xxl" />

      <!-- examples/2: an image. jsdom never fires the load event, so this
           renders the skeleton plus the aria-hidden img, which is the state a
           real user sees first too. -->
      <mlv-avatar
        size="l"
        src="https://example.com/a.jpg"
        name="Ada Lovelace"
        label="Ada Lovelace"
      />

      <!-- examples/3: projected icon content with a label. -->
      <mlv-avatar size="m" label="Profile">
        <svg data-testid="icon" aria-hidden="true"></svg>
      </mlv-avatar>

      <!-- examples/4: explicit initials. -->
      <mlv-avatar size="l" initials="QA" label="Quinn Ash" />

      <!-- Not promoted, but the only role-less render: no name, no label. -->
      <mlv-avatar size="m" id="anonymous">
        <svg data-testid="anon-icon" aria-hidden="true"></svg>
      </mlv-avatar>
    `,
  })
  class AvatarA11yHost {}

  it('has no axe violations across every content mode', async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(AvatarA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: five named avatars expose `role="img"`; the nameless one does not,
    // so there is no nameless `role="img"` for `aria-allowed-attr` to catch.
    const named = host.querySelectorAll('mlv-avatar[role="img"]');
    expect(named).toHaveLength(5);
    expect([...named].map((el) => el.getAttribute('aria-label'))).toEqual([
      'John Doe',
      'Jane Smith',
      'Ada Lovelace',
      'Profile',
      'Quinn Ash',
    ]);
    const anonymous = host.querySelector('#anonymous') as HTMLElement;
    expect(anonymous.getAttribute('role')).toBeNull();
    expect(anonymous.getAttribute('aria-label')).toBeNull();

    await expectNoAxeViolations(host);
  });
});

/**
 * #302: the default avatar used to paint `--mlv-text-secondary` inline under
 * 0.8-opacity `--mlv-palette-neutral-800` initials (1.72:1 in light). With no
 * `color`, nothing is bound inline and `avatar.scss`'s theme pair
 * (`--mlv-background-neutral-1` / `--mlv-text-primary`) applies — measured by
 * `libs/styles/src/lib/tone-contrast.spec.mjs`. A `color` tint is theme-
 * independent, so it carries a theme-independent foreground, measured over the
 * pipe's whole palette in `color-from-text.pipe.spec.ts`.
 *
 * The bound values are read off the component rather than off
 * `element.style`: jsdom's `cssstyle` drops any `var()` value on
 * `background-color` / `color` (so an inline `var(--mlv-text-secondary)` reads
 * back as `''` and the old defect would pass a DOM assertion) and mis-parses
 * `hsl()`. The values are strings, never the instance, inside `expect`.
 *
 * The raw `style` attribute is no way round that: cssstyle serialises the
 * attribute from the same parsed declarations, so a tinted `__visual` reads
 * `background-color: rgb(173, 173, 173);` with no `color` at all. What reaches
 * the DOM is therefore recorded at the `CSSStyleDeclaration` `color` setter —
 * Angular writes a dash-free style binding through `el.style.color = value` —
 * so dropping the template's `[style.color]` binding goes red even though the
 * component signal still holds the value.
 */
describe('MlvAvatar colour pair', () => {
  @Component({
    imports: [MlvAvatar],
    template: `
      <mlv-avatar name="Ann Lee" />
      <mlv-avatar name="Ann Lee" color="hsl(253, 60%, 80%)" />
    `,
  })
  class AvatarColourHost {
    readonly avatars = viewChildren(MlvAvatar);
  }

  /** The inline background and foreground an avatar binds, as strings. */
  const boundPair = (avatar: MlvAvatar): string =>
    `${String(avatar['_backgroundColor']())} / ${String(avatar['_foregroundColor']())}`;

  let avatars: readonly MlvAvatar[];

  /** Every inline `color` written, keyed by the declaration it was written to. */
  let colourWrites: Map<CSSStyleDeclaration, string[]>;

  /** Each avatar's `.mlv-avatar__visual`, in template order. */
  let visuals: HTMLElement[];

  beforeEach(async () => {
    colourWrites = new Map();
    const native = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      'color',
    );
    vi.spyOn(CSSStyleDeclaration.prototype, 'color', 'set').mockImplementation(
      function (this: CSSStyleDeclaration, value: string) {
        colourWrites.set(this, [...(colourWrites.get(this) ?? []), value]);
        native?.set?.call(this, value);
      },
    );
    await TestBed.configureTestingModule({
      imports: [AvatarColourHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(AvatarColourHost);
    fixture.detectChanges();
    await fixture.whenStable();
    avatars = fixture.componentInstance.avatars();
    visuals = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mlv-avatar__visual',
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The inline `color` values written to one `__visual`, joined. */
  const writtenColour = (visual: HTMLElement): string =>
    (colourWrites.get(visual.style) ?? []).join(' | ');

  it('binds no inline colours on an un-tinted avatar', () => {
    expect(boundPair(avatars[0])).toBe('null / null');
    expect(writtenColour(visuals[0])).toBe('');
  });

  it('binds the tint and a fixed dark foreground on a tinted avatar', () => {
    expect(boundPair(avatars[1])).toBe(
      'hsl(253, 60%, 80%) / var(--mlv-palette-neutral-800)',
    );
  });

  it('writes the fixed dark foreground onto the tinted avatar’s visual', () => {
    expect(writtenColour(visuals[1])).toContain('neutral-800');
  });
});
