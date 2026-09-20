/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["playcanvas"],
  ...(process.env.NEXT_PUBLIC_BASE_PATH
    ? { assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH }
    : {}),
};

module.exports = nextConfig;
