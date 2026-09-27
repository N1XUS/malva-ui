import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, inject, signal, viewChild } from '@angular/core';
import { Directionality, type Direction } from '@angular/cdk/bidi';
import { MlvRtlService } from './rtl.service';
import { provideMlvScopedDirectionality } from './scoped-directionality';

/** Reads whatever `Directionality` its position in the tree resolves. */
@Component({
  selector: 'mlv-test-directionality-reader',
  template: '',
})
class DirectionalityReader {
  readonly directionality = inject(Directionality);
}

/** Provides the scoped instance to its view, as a template-level host would. */
@Component({
  selector: 'mlv-test-scoped-provider',
  imports: [DirectionalityReader],
  template: '<mlv-test-directionality-reader />',
  viewProviders: [provideMlvScopedDirectionality()],
})
class ScopedProvider {
  readonly reader = viewChild.required(DirectionalityReader);
}

@Component({
  imports: [ScopedProvider],
  template: `
    <section [attr.dir]="scopeDir()">
      @if (rendered()) {
        <mlv-test-scoped-provider />
      }
    </section>
  `,
})
class Host {
  readonly scopeDir = signal<Direction | null>(null);
  readonly rendered = signal(true);
  readonly provider = viewChild(ScopedProvider);
}

/**
 * A **static** `dir="rtl"` scope that exists before the provider is created,
 * with the provider inside an `@if`: an embedded view, whose nodes are
 * constructed detached and inserted afterwards. No `dir` attribute changes
 * after construction, so nothing would correct a direction read too early.
 */
@Component({
  imports: [ScopedProvider],
  template: `
    <section dir="rtl">
      @if (rendered()) {
        <mlv-test-scoped-provider />
      }
    </section>
  `,
})
class StaticScopeHost {
  readonly rendered = signal(true);
  readonly provider = viewChild(ScopedProvider);
}

describe('provideMlvScopedDirectionality', () => {
  let fixture: ComponentFixture<Host>;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    rtl = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** The scoped instance the provider's view resolved. */
  function scoped(): Directionality {
    const provider = fixture.componentInstance.provider();
    if (!provider) throw new Error('provider not rendered');
    return provider.reader().directionality;
  }

  /**
   * Writes the `[dir]` binding, then waits twice: the shared `dir` observer
   * reports the attribute in a microtask **after** the first `whenStable()`
   * has already resolved, and the change detection it schedules (which runs
   * the `change` effect) is what the second one waits for.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
  }

  it('is a separate instance from the root Directionality', () => {
    expect(scoped() === TestBed.inject(Directionality)).toBe(false);
  });

  it('reports a scoped [dir="rtl"] ancestor while the document stays LTR', async () => {
    fixture.componentInstance.scopeDir.set('rtl');
    await settle();

    expect(rtl.direction()).toBe('ltr');
    expect(TestBed.inject(Directionality).value).toBe('ltr');
    expect(scoped().value).toBe('rtl');
    expect(scoped().valueSignal()).toBe('rtl');
  });

  it('reads a flip through before any change detection runs', async () => {
    const section = fixture.nativeElement.querySelector(
      'section',
    ) as HTMLElement;
    const directionality = scoped();

    section.setAttribute('dir', 'rtl');
    // One microtask: the shared `dir` observer delivers, nothing else runs.
    await Promise.resolve();

    expect(directionality.valueSignal()).toBe('rtl');
    expect(directionality.value).toBe('rtl');
    section.removeAttribute('dir');
  });

  it('reports a [dir="ltr"] island inside an RTL document', async () => {
    rtl.setDirection('rtl');
    fixture.componentInstance.scopeDir.set('ltr');
    await settle();

    expect(TestBed.inject(Directionality).value).toBe('rtl');
    expect(scoped().value).toBe('ltr');
  });

  it('follows the global direction when no [dir] is scoped', async () => {
    expect(scoped().value).toBe('ltr');

    rtl.setDirection('rtl');
    await settle();

    expect(scoped().value).toBe('rtl');
  });

  it('emits change once per live flip and not for an unchanged direction', async () => {
    const seen: Direction[] = [];
    const subscription = scoped().change.subscribe((d) => seen.push(d));

    fixture.componentInstance.scopeDir.set('rtl');
    await settle();
    // Same resolved direction written again: no emission.
    fixture.componentInstance.scopeDir.set(null);
    rtl.setDirection('rtl');
    await settle();
    fixture.componentInstance.scopeDir.set('ltr');
    await settle();

    subscription.unsubscribe();
    expect(seen.join(',')).toBe('rtl,ltr');
  });

  it('completes change when the providing node is destroyed', async () => {
    const directionality = scoped();
    let completed = false;
    directionality.change.subscribe({ complete: () => (completed = true) });

    fixture.componentInstance.rendered.set(false);
    await settle();

    expect(completed).toBe(true);
  });
});

describe('provideMlvScopedDirectionality under a static scope', () => {
  afterEach(() => {
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('reports a static [dir="rtl"] to a provider constructed inside an @if', async () => {
    const fixture = TestBed.createComponent(StaticScopeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();

    const provider = fixture.componentInstance.provider();
    if (!provider) throw new Error('provider not rendered');
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(provider.reader().directionality.value).toBe('rtl');
    expect(provider.reader().directionality.valueSignal()).toBe('rtl');
  });

  it('reports it to an instance the @if creates after the first render', async () => {
    const fixture = TestBed.createComponent(StaticScopeHost);
    fixture.componentInstance.rendered.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.rendered.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const provider = fixture.componentInstance.provider();
    if (!provider) throw new Error('provider not rendered');
    expect(provider.reader().directionality.value).toBe('rtl');
  });
});
