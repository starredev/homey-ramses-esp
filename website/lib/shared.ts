export const appName = 'RAMSES ESP';
export const docsRoute = '/docs';

/** Prefix for files in public/ and static routes (GitHub Pages serves the site from a sub path). */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const gitConfig = {
  user: 'starredev',
  repo: 'homey-ramses-esp',
  branch: 'main',
};

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export const testVersionUrl = 'https://homey.app/a/io.github.starredev.ramses/test/';
