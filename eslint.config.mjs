import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".claude/**", ".next/**", "node_modules/**", "drizzle/**", "tests/fixtures/**", "public/vendor/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
];

export default config;
