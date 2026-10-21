import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the build rooted in this folder; the repo root has its own package.json.
  turbopack: { root: dir },
  outputFileTracingRoot: dir,
};

export default nextConfig;
