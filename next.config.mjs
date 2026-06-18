/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // TODO: re-enable ESLint in build after lint cleanup
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: "standalone",
};

export default nextConfig;
