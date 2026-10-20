import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

// The anchor follows the heading on the installation page, which is translated too.
const labels: Record<string, { docs: string; gateway: string; gatewayAnchor: string }> = {
  en: { docs: 'Documentation', gateway: 'Gateways', gatewayAnchor: 'which-gateway' },
  nl: { docs: 'Documentatie', gateway: 'Gateways', gatewayAnchor: 'welke-gateway' },
};

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const label = labels[lang] ?? labels.en;

  return (
    <HomeLayout
      {...baseOptions(lang)}
      links={[
        { text: label.docs, url: `/${lang}/docs` },
        { text: label.gateway, url: `/${lang}/docs/installation#${label.gatewayAnchor}` },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
