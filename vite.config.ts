import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Split heavy, rarely-changing dependencies into their own chunks so
            // no single chunk trips Vite's 500 kB warning. Pure bundling change
            // (no lazy loading, no behavior change).
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('@google/genai')) return 'genai';
              if (id.includes('lucide-react')) return 'icons';
              if (id.includes('react') || id.includes('scheduler')) return 'react';
              return 'vendor';
            },
          },
        },
      }
    };
});
