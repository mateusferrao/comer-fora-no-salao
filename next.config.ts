import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Sem includeSubDomains: o domínio é subdomínio de easypanel.host.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/**
 * CSP completa só em produção (S3, revisão T-I5): o `next dev` precisa de `eval` e de WebSocket (HMR).
 * `'unsafe-inline'` em scripts: o App Router injeta scripts inline; nonce exigiria renderização dinâmica (roadmap).
 */
const PROD_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
const csp = process.env.NODE_ENV === "production" ? PROD_CSP : "frame-ancestors 'self'";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // O CLAUDE.md é a fonte única de instruções; não gerar AGENTS.md.
  agentRules: false,
  // O CI roda `tsc --noEmit`; o build não repete a checagem (economia de memória na VPS).
  typescript: { ignoreBuildErrors: true },
  // Build com webpack (D102): ~0,9 GB de pico contra ~1,15 GB do Turbopack na VPS compartilhada.
  experimental: { cpus: 1, webpackMemoryOptimizations: true },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders, { key: "Content-Security-Policy", value: csp }] }];
  },
};

export default nextConfig;
