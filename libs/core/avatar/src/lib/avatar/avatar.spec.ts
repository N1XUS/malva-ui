import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
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
