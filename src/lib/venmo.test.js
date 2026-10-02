// src/lib/venmo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketNote, venmoLinks, clampQty } from './venmo.js';

test('clampQty keeps quantity between 1 and max, defaulting bad input to 1', () => {
  assert.equal(clampQty(3), 3);
  assert.equal(clampQty(0), 1);
  assert.equal(clampQty(-4), 1);
  assert.equal(clampQty(99), 20);
  assert.equal(clampQty('abc'), 1);
  assert.equal(clampQty('2'), 2);
  assert.equal(clampQty(2.7), 2);
});

test('ticketNote includes quantity, event and buyer name', () => {
  assert.equal(ticketNote(2, 'Pat Guerin'), 'Dinner Dance 2026 – 2 tickets – Pat Guerin');
  assert.equal(ticketNote(1, 'Pat'), 'Dinner Dance 2026 – 1 ticket – Pat');
});

test('ticketNote omits the name when blank', () => {
  assert.equal(ticketNote(1, '   '), 'Dinner Dance 2026 – 1 ticket');
});

test('venmoLinks prefills recipient, amount and note for app and web', () => {
  const { app, web } = venmoLinks({ user: 'brooklyn-shamrocksgfc', amount: 300, note: 'A & B' });
  assert.equal(
    app,
    'venmo://paycharge?txn=pay&recipients=brooklyn-shamrocksgfc&amount=300&note=A%20%26%20B'
  );
  assert.equal(
    web,
    'https://venmo.com/brooklyn-shamrocksgfc?txn=pay&amount=300&note=A%20%26%20B'
  );
});
