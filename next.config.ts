import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (.docx parsing) is CommonJS and bundles jszip with dynamic
  // requires — keep it external so the server bundler doesn't break it.
  serverExternalPackages: ["mammoth"],
  experimental: {
    // Allow up to 5MB uploads in Server Actions (default is 1MB). Used by /upload.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
