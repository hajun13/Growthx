/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // 워크스페이스 TS 패키지(소스 직참조)는 Next 가 트랜스파일해야 한다.
  transpilePackages: ['@growthx/contracts'],
  async rewrites() {
    const apiBase = process.env.API_PROXY_TARGET;
    if (!apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
