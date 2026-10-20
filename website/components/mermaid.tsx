'use client';

import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

/** Renders a Mermaid diagram in the site's neutral theme, following light and dark mode. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import('mermaid');

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
      });

      const result = await mermaid.render(`mermaid-${id}`, chart.trim());

      if (!cancelled) {
        setSvg(result.svg);
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  return <div className="not-prose my-6 flex justify-center [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
