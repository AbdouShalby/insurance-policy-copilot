import { normalizeArabic, tokenize } from '../src/index-store';

it('normalizes Arabic marks, tatweel, alef, ya and ta marbuta', () => {
  expect(normalizeArabic('أَإِآٱ مـدرسة على')).toBe('اااا مدرسه علي');
});
it('strips common prefixes only on longer tokens', () => {
  expect(tokenize('العلاج والعلاج بالعلاج كالعلاج فالعلاج للعلاج')).toEqual(Array(6).fill('علاج'));
  expect(tokenize('الى')).toEqual(['الي']);
});
it('preserves English tokenization', () => {
  expect(tokenize('The WINDSCREEN repairs, EGP 5000.')).toEqual(['the', 'windscreen', 'repairs', 'egp', '5000']);
});
