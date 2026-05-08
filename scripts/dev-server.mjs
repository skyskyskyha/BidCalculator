import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const server = await createServer({
  cacheDir: 'node_modules/.vite-run',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();
