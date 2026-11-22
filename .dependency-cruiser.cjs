/** Fronteiras do monólito modular (D44): o domínio não conhece infraestrutura. */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-no-infra",
      severity: "error",
      comment:
        "src/modules/*/domain não conhece framework, banco, IA nem rastro, nem as camadas de fora (application, adapters, módulo ia, app/)",
      from: { path: "^src/modules/[^/]+/domain/" },
      to: {
        path: [
          "^next($|/)",
          "^drizzle-orm($|/)",
          "^ai($|/)",
          "^@openrouter/",
          "^pg($|/)",
          "^@langfuse/",
          "^@opentelemetry/",
          "^src/db/",
          "^src/modules/[^/]+/(application|adapters)/",
          "^src/modules/ia/",
          "^app/",
          "node_modules/(next|drizzle-orm|ai|pg|@openrouter/[^/]+|@langfuse/[^/]+|@opentelemetry/[^/]+)/",
        ],
      },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Nenhum ciclo de import entre arquivos (dívida da revisão S8, item 22: trava a regressão).",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(tests/fixtures|node_modules|\\.next)" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
