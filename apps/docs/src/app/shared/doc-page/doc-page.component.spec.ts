import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { ShikiHighlightService } from '../shiki-highlight.service';
import { DocPageComponent } from './doc-page.component';

describe('DocPageComponent', () => {
  const createFixture = (header: string) => {
    const fixture = TestBed.configureTestingModule({
      imports: [DocPageComponent],
      providers: [
        provideRouter([]),
        provideMlvI18nTesting(),
        {
          provide: MlvThemeService,
          useValue: { currentTheme: () => 'light' },
        },
        {
          provide: ShikiHighlightService,
          useValue: { highlight: () => Promise.resolve('<pre />') },
        },
      ],
    }).createComponent(DocPageComponent);
    fixture.componentRef.setInput('meta', { title: 'Data table' });
    fixture.componentRef.setInput('header', header);
    fixture.componentRef.setInput('examples', [1, 2]);
    return fixture;
  };

  it('links only the first example using a display-header alias', () => {
    const fixture = createFixture('Data Table');
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll(
      '.example-container__open-full',
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain(
      '/showcases/project-workspace',
    );
  });

  it('does not link examples when the display header has no route alias', () => {
    const fixture = createFixture('Skeleton');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.example-container__open-full'),
    ).toBeNull();
  });
});
