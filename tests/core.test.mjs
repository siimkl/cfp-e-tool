import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseUrl,
  normaliseText,
  fingerprint,
  duplicateEvidence,
  mergeFields,
  isPast,
  isNew,
  validateItem,
  validDate,
} from '../shared/core.js';
export const example = {
  item_type: 'CFP',
  category: 'Ühiskond ja sotsiaalteadused',
  title: 'AI and Digital Sovereignty',
  journal: 'Policy Journal',
  organiser: null,
  summary: null,
  deadline: '2027-02-15',
  event_start: null,
  event_end: null,
  event_mode: 'UNKNOWN',
  location: null,
  homepage_url: 'https://example.org/cfp',
  topics: ['policy'],
};
test('canonical URLs remove tracking, fragments and trailing slashes; preserve meaningful queries', () => {
  assert.equal(
    normaliseUrl('https://EXAMPLE.org/cfp/?utm_source=mail&issue=4&b=2#top'),
    'https://example.org/cfp?b=2&issue=4',
  );
  for (const url of [
    'javascript:alert(1)',
    'mailto:a@example.org',
    'https://user:pass@example.org',
    'https://example.org\\@evil.org',
  ])
    assert.equal(normaliseUrl(url), null);
});
test('fingerprints normalise Unicode text and distinguish event from CFP', () => {
  assert.equal(normaliseText('  Études:  AI! '), 'études ai');
  assert.equal(
    fingerprint(example),
    fingerprint({ ...example, title: '  AI and Digital Sovereignty! ' }),
  );
  assert.notEqual(
    fingerprint(example),
    fingerprint({ ...example, item_type: 'EVENT' }),
  );
});
test('dates are inclusive and ongoing events remain current until their end', () => {
  assert.equal(isPast(example, '2027-02-15'), false);
  assert.equal(isPast(example, '2027-02-16'), true);
  assert.equal(
    isPast(
      {
        item_type: 'EVENT',
        event_start: '2027-02-10',
        event_end: '2027-02-17',
      },
      '2027-02-15',
    ),
    false,
  );
  assert.equal(
    isPast({ item_type: 'EVENT', event_start: '2027-02-10' }, '2027-02-15'),
    true,
  );
  assert.equal(isPast({ ...example, deadline: null }, '2099-01-01'), false);
  assert.equal(
    isNew(
      { created_at: '2027-02-08T12:00:00Z' },
      new Date('2027-02-15T12:00:00Z'),
    ),
    true,
  );
  assert.equal(
    isNew(
      { created_at: '2027-02-16T12:00:00Z' },
      new Date('2027-02-15T12:00:00Z'),
    ),
    false,
  );
});
test('duplicate evidence distinguishes recurring calls and requires extension evidence', () => {
  assert.equal(
    duplicateEvidence(example, {
      ...example,
      title: 'AI and Digital Sovereignty!',
    }),
    true,
  );
  assert.equal(
    duplicateEvidence(example, { ...example, deadline: '2028-02-15' }),
    false,
  );
  assert.equal(
    duplicateEvidence(example, { ...example, deadline: '2027-03-15' }),
    false,
  );
  assert.equal(
    duplicateEvidence(example, {
      ...example,
      deadline: '2027-03-15',
      deadline_extended: true,
    }),
    true,
  );
  assert.equal(
    duplicateEvidence(example, {
      ...example,
      title: 'Completely different conference',
    }),
    false,
  );
});
test('merge fills blanks, preserves edits, unions topics and extends only explicitly', () => {
  const patch = mergeFields(
    { ...example, summary: 'Editor text' },
    {
      ...example,
      summary: 'AI text',
      location: 'Tallinn',
      topics: ['policy', 'AI'],
      deadline: '2027-03-15',
      deadline_extended: false,
    },
  );
  assert.equal(patch.summary, undefined);
  assert.equal(patch.location, 'Tallinn');
  assert.equal(patch.deadline, undefined);
  assert.deepEqual(patch.topics, ['policy', 'AI']);
});
test('validation rejects impossible dates, reversed ranges and wrong type combinations', () => {
  assert.equal(validDate('2027-02-30'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.doesNotThrow(() => validateItem(example));
  assert.throws(() => validateItem({ ...example, title: '   ' }));
  assert.throws(() =>
    validateItem({
      ...example,
      item_type: 'EVENT',
      deadline: null,
      event_start: '2027-02-17',
      event_end: '2027-02-15',
    }),
  );
  assert.throws(() => validateItem({ ...example, event_start: '2027-02-17' }));
});
