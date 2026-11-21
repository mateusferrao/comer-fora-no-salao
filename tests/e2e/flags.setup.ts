import { test as setup } from "@playwright/test";
import pg from "pg";
import { PROD, S5_FLAGS, S6_FLAGS, S8_FLAGS } from "./helpers";

/**
 * Estado das flags da S5 para cada passada (S5 §6, revisão técnica B2). As flags são globais e as specs rodam em
 * paralelo: a passada `chromium` (desligadas) roda inteira antes da `flags-on`. Local: grava direto no banco de
 * teste (mesma forma de `setFlag`: nova versão de `flags` + ponteiro em `app_config`), sem gastar o limite de login
 * dos Bastidores. Produção: não há senha no GitHub (D139); quem escolhe as asserções é `E2E_FLAGS`.
 */
const DB = process.env.DATABASE_URL ?? "postgres://salao:salao@localhost:5432/salao_test";

for (const on of [false, true]) {
  setup(`flags da S5 e da S6 ${on ? "ligadas" : "desligadas"}`, async () => {
    setup.skip(PROD, "em produção as flags são ligadas pelos Bastidores; E2E_FLAGS escolhe as asserções");
    setup.skip((setup.info().project.name === "setup-on") !== on, "outro estado");
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    try {
      await c.query("begin");
      await c.query("select pg_advisory_xact_lock(hashtext('flags'))");
      const cur = await c.query(
        `select v.value from app_config a join app_config_versions v on v.key = a.key and v.version = a.version where a.key = 'flags'`,
      );
      const value = { ...((cur.rows[0]?.value as Record<string, boolean>) ?? {}), ...Object.fromEntries([...S5_FLAGS, ...S6_FLAGS, ...S8_FLAGS].map((f) => [f, on])), agendador: false };
      const max = await c.query(`select coalesce(max(version), 0) + 1 as v from app_config_versions where key = 'flags'`);
      const version = Number(max.rows[0].v);
      await c.query(`insert into app_config_versions (key, version, value, note) values ('flags', $1, $2, $3)`, [version, JSON.stringify(value), `E2E: S5 ${on ? "ligadas" : "desligadas"}`]);
      await c.query(`insert into app_config (key, version) values ('flags', $1) on conflict (key) do update set version = excluded.version, updated_at = now()`, [version]);
      await c.query("commit");
    } finally {
      await c.end();
    }
  });
}
