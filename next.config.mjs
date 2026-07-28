/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@tuya/tuya-connector-nodejs',
    ],
  },
};

export default nextConfig;
