import { defineI18n } from 'fumadocs-core/i18n';

/**
 * English and Dutch. Pages live in content/docs/en and content/docs/nl under the same file names, so the language
 * switcher keeps you on the same page. Every URL carries its language (/en/..., /nl/...): a static export has no
 * middleware to hide it.
 */
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'nl'],
  parser: 'dir',
});

export type Language = (typeof i18n.languages)[number];
