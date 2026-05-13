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

module.exports = nextConfig









