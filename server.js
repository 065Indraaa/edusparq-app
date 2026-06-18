const path = require('path');
const dir = path.join(__dirname);

process.env.NODE_ENV = 'production';
process.chdir(__dirname);

// Fix Unix Socket port for cPanel Passenger
const currentPort = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';

let nextConfig;
try {
  nextConfig = require('./.next/required-server-files.json').config;
} catch (e) {
  console.error("Gagal membaca konfigurasi Next.js. Pastikan 'npm run build' berhasil.");
  process.exit(1);
}

// Injeksi konfigurasi standalone agar Next.js mau melayani file static dari root direktori
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

require('next');
const { startServer } = require('next/dist/server/lib/start-server');

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout: 5000,
}).catch((err) => {
  console.error('CRITICAL ERROR:', err);
  process.exit(1);
});
