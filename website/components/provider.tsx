'use client';
import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ComponentProps, ReactNode } from 'react';

type I18nProps = ComponentProps<typeof RootProvider>['i18n'];

export function Provider({ children, i18n }: { children: ReactNode; i18n: I18nProps }) {
  return (
    <RootProvider search={{ SearchDialog }} i18n={i18n}>
      {children}
    </RootProvider>
  );
}
