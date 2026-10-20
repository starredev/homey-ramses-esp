import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from './i18n';
import { appName, basePath, githubUrl } from './shared';

export const i18nUI = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  nl: {
    displayName: 'Nederlands',
    'Search(search trigger)': 'Zoeken',
    'Search(search dialog)': 'Zoeken',
    'No results found(search dialog)': 'Niets gevonden',
    'On this page(table of contents)': 'Op deze pagina',
    'No Headings(table of contents)': 'Geen koppen',
    'Table of Contents(inline table of contents)': 'Inhoud',
    'Next Page(pagination)': 'Volgende',
    'Previous Page(pagination)': 'Vorige',
    'Last updated on(page footer)': 'Laatst bijgewerkt op',
    'Choose a language(language switcher)': 'Kies een taal',
    'Language(language switcher)': 'Taal',
    'Edit on GitHub(edit page)': 'Bewerken op GitHub',
    'Theme(site menu)': 'Thema',
    'Page Not Found(404 not found page)': 'Pagina niet gevonden',
    'Back to Home(404 not found page)': 'Terug naar home',
  },
});

export function baseOptions(lang: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      url: `/${lang}`,
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <img src={`${basePath}/logo.svg`} alt="" width={22} height={22} className="dark:invert" />
          {appName}
        </span>
      ),
    },
    githubUrl,
  };
}
