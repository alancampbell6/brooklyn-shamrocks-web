// src/lib/venmo.js
// Builds prefilled Venmo payment links. Venmo has no embeddable checkout for
// personal/club accounts, so we deep-link into the app (or venmo.com on
// desktop) with the recipient, amount and note already filled in.

export const MAX_TICKETS = 20;

export function clampQty(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_TICKETS);
}

export function ticketNote(qty, name) {
  const parts = ['Dinner Dance 2026', `${qty} ticket${qty === 1 ? '' : 's'}`];
  const trimmed = String(name ?? '').trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(' – ');
}

export function venmoLinks({ user, amount, note }) {
  const n = encodeURIComponent(note);
  return {
    app: `venmo://paycharge?txn=pay&recipients=${user}&amount=${amount}&note=${n}`,
    web: `https://venmo.com/${user}?txn=pay&amount=${amount}&note=${n}`,
  };
}
