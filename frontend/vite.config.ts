import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Listen on all network interfaces
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path, // Keep the /api prefix when forwarding
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable for debugging
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Group all vendor dependencies together to avoid React initialization issues
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            'recharts',
          ],
        },
      },
    },
  },
});
