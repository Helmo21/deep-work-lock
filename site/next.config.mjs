/** @type {import('next').NextConfig} */
const text = [
  { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
  { key: 'Cache-Control', value: 'no-cache' },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/install.sh', headers: text },
      { source: '/uninstall.sh', headers: text },
      { source: '/policies.py', headers: text },
      {
        source: '/releases/:file*',
        headers: [
          { key: 'Content-Type', value: 'application/x-xpinstall' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      { source: '/updates.json', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ]
  },
}

export default nextConfig
