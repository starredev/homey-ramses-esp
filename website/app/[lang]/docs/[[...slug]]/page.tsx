import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { gitConfig } from '@/lib/shared';

export default async function Page(props: PageProps<'/[lang]/docs/[[...slug]]'>) {
  const { lang, slug } = await props.params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // Relative links like ./gateway.mdx. Fumadocs looks them up without the language folder, while page.path
            // still starts with it (nl/installation.mdx), so strip it or every link stays a raw .mdx href.
            a: createRelativeLink(source, { ...page, path: page.path.slice(lang.length + 1) }),
          })}
        />
      </DocsBody>
      <EditOnGitHub
        href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/website/content/docs/${page.path}`}
      />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/[lang]/docs/[[...slug]]'>): Promise<Metadata> {
  const { lang, slug } = await props.params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
