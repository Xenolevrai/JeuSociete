import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Le Gabo est servi sous /gabo/ par le même serveur que le Monopoly.
// En développement : `npx vite` ici (port 5174), le serveur de jeu sur 3000.
export default defineConfig({
  base: '/gabo/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
