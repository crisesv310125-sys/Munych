import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @munych/ui se publica como fuente TS/CSS sin build propio: Next debe transpilarlo.
  transpilePackages: ['@munych/ui'],
};

export default nextConfig;
