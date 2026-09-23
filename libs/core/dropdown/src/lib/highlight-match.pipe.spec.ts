import { MlvHighlightMatchPipe } from './highlight-match.pipe';

describe('MlvHighlightMatchPipe', () => {
  const pipe = new MlvHighlightMatchPipe();

  it('returns an empty array for nullish labels', () => {
    expect(pipe.transform(null, 'x')).toEqual([]);
    expect(pipe.transform(undefined, 'x')).toEqual([]);
  });

  it('treats an empty-string label as a label, not as a missing one (#300)', () => {
    // Only nullish is "no label". An option labelled '' still gets its one
    // (empty) unmatched segment, exactly as `matchSegments` answers for it.
    expect(pipe.transform('', 'x')).toEqual([{ text: '', matched: false }]);
  });

  it('segments the label around the matched query', () => {
    expect(pipe.transform('Apple', 'pp')).toEqual([
      { text: 'A', matched: false },
      { text: 'pp', matched: true },
      { text: 'le', matched: false },
    ]);
  });

  it('returns one unmatched segment when the query is empty', () => {
    expect(pipe.transform('Apple', '')).toEqual([
      { text: 'Apple', matched: false },
    ]);
  });
});
