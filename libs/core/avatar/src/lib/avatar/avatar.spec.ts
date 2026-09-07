import { Component } from '@angular/core';
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
