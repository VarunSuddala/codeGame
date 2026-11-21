import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/');
          if (path.includes('/node_modules/monaco-editor/')) return 'monaco';
          if (path.includes('/node_modules/@monaco-editor/')) return 'monaco-react';
          if (
            /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(path)
          )
            return 'react';
        },
      },
    },
  },
});
