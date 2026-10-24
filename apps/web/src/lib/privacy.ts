// Phone masking applied again on every post the web loads, even though the extension
// must already have masked it (docs/03-system/05-extension.md, criterion E5).

// Vietnamese numbers: 0xxx… or +84xxx…, 9–10 digits after the prefix, separated by
// spaces, dots or dashes ("0123 456 789", "0123.456.789", "+84 123456789").
const PHONE = /(?<![\p{N}])(?:\+\s?84|84|0)(?:[\s.\-]?\d){8,10}(?![\p{N}])/gu;
// Partly hidden numbers that still leak a prefix ("09xx xxx xxx").
const PHONE_HIDDEN = /(?<![\p{L}\p{N}])0\d(?:[\s.\-]?[\dx*•]){8}(?![\p{L}\p{N}])/giu;

export const PHONE_MASK = '[SĐT]';

export function maskPhones(text: string): string {
  return text.replace(PHONE, PHONE_MASK).replace(PHONE_HIDDEN, PHONE_MASK);
}
