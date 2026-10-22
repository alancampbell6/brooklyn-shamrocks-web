// Serialise a value for an inline <script> block (JSON-LD).
//
// Plain JSON.stringify is not safe inside <script>: a string containing
// "</script>" (or "<!--") ends the block early, and the rest is parsed as
// HTML. Some JSON-LD carries third-party text (Foireann team and venue names
// on /matches), so escape the HTML-significant characters, plus U+2028/U+2029,
// as JSON unicode escapes. The output is still valid JSON with the same value.
export function jsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
