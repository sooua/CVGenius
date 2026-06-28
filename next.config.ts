import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keep server-only native/CJS libs out of the bundler:
  // - mammoth (.docx) bundles jszip with dynamic requires
  // - @napi-rs/canvas is a native addon used to rasterize scanned PDFs for OCR
  serverExternalPackages: ["mammoth", "@napi-rs/canvas"],
  experimental: {
    // Allow up to 5MB uploads in Server Actions (default is 1MB). Used by /upload.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default withNextIntl(nextConfig);
