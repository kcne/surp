const createNextIntlPlugin = require("next-intl/plugin")

const r2PublicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL

function buildRemotePatterns() {
  if (!r2PublicBaseUrl) {
    return []
  }

  try {
    const url = new URL(r2PublicBaseUrl)
    return [
      {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        port: url.port,
        pathname: "/**",
      },
    ]
  } catch {
    return []
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: buildRemotePatterns(),
  },
}

// Points next-intl at the request config; locale resolution itself lives in
// `i18n/resolve-locale.ts`.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

module.exports = withNextIntl(nextConfig)









