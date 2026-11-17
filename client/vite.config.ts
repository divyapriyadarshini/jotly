import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail instead of silently picking another port. The server's CORS setting
    // only allows http://localhost:5173, so a different port would break API calls.
    strictPort: true,
  },
});
