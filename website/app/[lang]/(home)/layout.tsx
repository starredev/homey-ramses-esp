import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

const labels: Record<string, { docs: string; gateway: string }> = {
  en: { docs: 'Documentation', gateway: 'Gateways' },
  nl: { docs: 'Documentatie', gateway: 'Gateways' },
};

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const label = labels[lang] ?? labels.en;

  return (
    <HomeLayout
      {...baseOptions(lang)}
      links={[
        { text: label.docs, url: `/${lang}/docs` },
        { text: label.gateway, url: `/${lang}/docs/installation#which-gateway` },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
