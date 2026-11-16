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

import { readableText } from '../src/policy.service';

describe('readableText', () => {
  it('removes the markdown heading and repeated title from the first sentence', () => {
    expect(readableText('# Sandcastle Motor Insurance (fictional) This is a synthetic policy.', 'Sandcastle Motor Insurance (fictional)'))
      .toBe('This is a synthetic policy.');
  });
  it('removes Arabic heading markers and keeps the body', () => {
    expect(readableText('# وثيقة تجريبية (خيالية) تبلغ نسبة التحمل ١٥ بالمائة.', 'وثيقة تجريبية (خيالية)'))
      .toBe('تبلغ نسبة التحمل ١٥ بالمائة.');
  });
  it('leaves text without headings unchanged', () => {
    expect(readableText('Windscreen repairs are covered.', 'Motor')).toBe('Windscreen repairs are covered.');
  });
});
