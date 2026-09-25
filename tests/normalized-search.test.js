import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  normalizeEntitySearchParts,
  normalizeEntitySearchText,
  normalizeSearchText,
} from '../src/shared/domain/search/normalizedSearch';

test('cached search preserves accent-insensitive matching and invalidates edited fields', () => {
  const note = { title: 'Café', body: 'Mercado central' };
  assert.equal(normalizeSearchText(' Café '), 'cafe');
  assert.equal(
    normalizeEntitySearchText(note, `${note.title} ${note.body}`),
    'cafe mercado central',
  );
  assert.equal(normalizeEntitySearchParts(note, note.title, note.body), 'cafe mercado central');
  note.body = 'Librería';
  assert.equal(normalizeEntitySearchParts(note, note.title, note.body), 'cafe libreria');
  assert.equal(normalizeEntitySearchText(note, 'José'), 'jose');
});
