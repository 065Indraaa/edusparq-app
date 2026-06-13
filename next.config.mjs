/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // TODO: re-enable ESLint in build after lint cleanup
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
