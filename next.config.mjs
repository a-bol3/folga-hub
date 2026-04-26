// next.config.mjs
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["tesseract.js", "pdf-parse", "xlsx", "canvas", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "canvas",
      ];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);