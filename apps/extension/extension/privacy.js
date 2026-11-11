/* Masks phone numbers on this machine, using the same rule as apps/api/app/pipeline/privacy.py. */
(function (global) {
  "use strict";

  const PHONE = /(?<![\d+])(?:\+\s?84|0)(?:[\s.\-]{0,2}\d){8,10}(?!\d)/gu;
  const maskPhones = text => String(text).replace(PHONE, "[SĐT]");

  global.TroPrivacy = { maskPhones };
})(globalThis);
