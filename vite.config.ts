import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Dynamically read version from package.json without hard-coded fallbacks
const packageJsonPath = path.resolve(import.meta.dirname, './package.json');
if (!fs.existsSync(packageJsonPath)) {
  throw new Error(`vite.config.ts: package.json not found at ${packageJsonPath}`);
}
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
if (!packageJson || typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
  throw new Error('vite.config.ts: package.json is missing a valid "version" property.');
}

const appVersion: string = packageJson.version;
const buildTimestamp: number = Date.now();

/**
 * Custom Vite plugin that generates dist/version.json with the exact build timestamp.
 * Allows client sessions to query and detect new deployments with 0-byte caching.
 */
function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            version: appVersion,
            buildTime: buildTimestamp,
          },
          null,
          2
        ),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(buildTimestamp),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    versionManifestPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'sounds/*.mp3'],
      manifest: {
        name: 'Schada • Strategy Board Game',
        short_name: 'Schada',
        description: 'Play Schada online - the classic abstract strategy game where the 64 squares dictate piece movement.',
        theme_color: '#161512',
        background_color: '#161512',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,json}'],
        globIgnores: ['**/version.json'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('canvas-confetti')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
