// src/lib/json-ld.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonLd } from './json-ld.js';

const payload = "Opponent </script><script>document.title='x'</script> <!-- & \u2028\u2029";

test('jsonLd escapes characters that could end or confuse an inline script', () => {
  const out = jsonLd({ name: payload, location: { name: payload } });
  assert.doesNotMatch(out, /[<>&\u2028\u2029]/);
  assert.match(out, /\\u003c\/script\\u003e/);
  assert.match(out, /\\u0026/);
  assert.match(out, /\\u2028/);
  assert.match(out, /\\u2029/);
});

test('jsonLd output parses back to the original value', () => {
  const value = { '@type': 'SportsEvent', name: payload, list: [1, 'a<b', null] };
  assert.deepEqual(JSON.parse(jsonLd(value)), value);
});

test('jsonLd leaves ordinary JSON-LD unchanged', () => {
  const value = { '@context': 'https://schema.org', name: 'Brooklyn Shamrocks vs Cork' };
  assert.equal(jsonLd(value), JSON.stringify(value));
});
