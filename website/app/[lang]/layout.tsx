import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Provider } from '@/components/provider';
import { i18n } from '@/lib/i18n';
import { i18nUI } from '@/lib/layout.shared';
import '../global.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

const descriptions: Record<string, string> = {
  en: 'Homey app for 868 MHz RAMSES II ventilation: Orcon, Itho, Vasco and ClimaRad through a ramses_esp gateway over MQTT.',
  nl: 'Homey-app voor 868 MHz RAMSES II-ventilatie: Orcon, Itho, Vasco en ClimaRad via een ramses_esp-gateway over MQTT.',
};

export async function generateMetadata(props: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await props.params;

  return {
    metadataBase: new URL('https://starredev.github.io/homey-ramses-esp/'),
    title: {
      template: '%s · RAMSES ESP for Homey',
      default: 'RAMSES ESP for Homey',
    },
    description: descriptions[lang] ?? descriptions.en,
  };
}

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  return (
    <html lang={lang} className={`${sans.variable} ${mono.variable} ${sans.className}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider i18n={i18nUI.provider(lang)}>{children}</Provider>
      </body>
    </html>
  );
}
