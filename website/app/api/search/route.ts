import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// The default multilingual tokenizer covers both English and Dutch.
export const { staticGET: GET } = createFromSource(source);
