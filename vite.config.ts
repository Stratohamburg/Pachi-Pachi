import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function resolveBase() {
  const explicitBase = process.env.VITE_BASE_PATH;

  if (explicitBase) {
    return explicitBase.endsWith('/') ? explicitBase : `${explicitBase}/`;
  }

  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '/';
  }

  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository) {
    return '/';
  }

  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    return '/';
  }

  if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return '/';
  }

  return `/${repo}/`;
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});