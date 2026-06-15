import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // pnpm 모노레포: standalone 파일 트레이싱 루트를 워크스페이스 루트로 고정
  // → 산출물이 apps/web/server.js 로 일관 생성(Dockerfile COPY 경로와 정합).
  outputFileTracingRoot: path.join(dirname, '..', '..'),
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
