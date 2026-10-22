// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { prepareReviewedTranslation } from '../scripts/prepare-reviewed-translation.mjs';

const valid = () => ({
  bookId: '11111111-1111-4111-8111-111111111111',
  sourceLanguage: 'en', targetLanguage: 'hi', accessTier: 'free',
  reviewedBy: 'Booknomics editorial', approved: true,
  sourceSections: { overview: 'One clear, factual example about a reader and their decision.'.repeat(3) },
  translatedSections: { overview: 'एक पाठक और उसके निर्णय के बारे में एक स्पष्ट और तथ्यपूर्ण उदाहरण।'.repeat(3) },
});

describe('no-API editorial translation import', () => {
  it('prepares approved SQL and hash without translating or making network calls', () => {
    const result = prepareReviewedTranslation(valid());
    expect(result.fields).toEqual(['overview']);
    expect(result.sql).toContain('review_status');
    expect(result.sql).toContain("'approved'");
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('does not allow unpublished/unreviewed content to become live', () => {
    expect(() => prepareReviewedTranslation({ ...valid(), approved: false })).toThrow('approved: true');
    expect(() => prepareReviewedTranslation({ ...valid(), reviewedBy: '' })).toThrow('reviewer');
  });
  it('rejects summarization, unchanged English and unsafe premium fields', () => {
    expect(() => prepareReviewedTranslation({ ...valid(), translatedSections: { overview: 'बहुत छोटा' } })).toThrow('suspiciously short');
    expect(() => prepareReviewedTranslation({ ...valid(), translatedSections: { overview: valid().sourceSections.overview } })).toThrow('verbatim');
    expect(() => prepareReviewedTranslation({ ...valid(), translatedSections: { ...valid().translatedSections, action_system: 'secret' } })).toThrow('Unauthorized');
  });
});
