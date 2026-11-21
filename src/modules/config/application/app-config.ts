/**
 * Configuração ao vivo (D58, D138; planejamento S3 §4.7): versões imutáveis + ponteiro (`app_config`).
 * Sem ponteiro, vale o texto do código (versão 0). Publicar cria a versão N+1 sob lock; voltar só move o ponteiro.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import type { Executor } from "@/src/db/executor";
import { appConfig, appConfigVersions } from "@/src/db/schema";
import { KIT_INSTRUCTIONS } from "@/src/modules/ia/tasks/kit";
import { MENU_INSTRUCTIONS } from "@/src/modules/ia/tasks/menu";
import { PACKAGE_INSTRUCTIONS } from "@/src/modules/ia/tasks/package";
import { FLAG_DEFAULTS, FLAGS, PROMPT_MAX_CHARS, type Flag, type Flags, type PromptTask } from "../domain/flags";

export const CODE_PROMPTS: Record<PromptTask, string> = { pacote: PACKAGE_INSTRUCTIONS, plano: PACKAGE_INSTRUCTIONS, kit: KIT_INSTRUCTIONS, cardapio: MENU_INSTRUCTIONS };
const key = (t: PromptTask) => `prompt:${t}`;

export type ActivePrompt = { instructions: string; version: number };

export async function getActivePrompt(ex: Executor, task: PromptTask): Promise<ActivePrompt> {
  const [row] = await ex
    .select({ version: appConfig.version, value: appConfigVersions.value })
    .from(appConfig)
    .innerJoin(appConfigVersions, and(eq(appConfigVersions.key, appConfig.key), eq(appConfigVersions.version, appConfig.version)))
    .where(eq(appConfig.key, key(task)))
    .limit(1);
  const text = (row?.value as { text?: string } | undefined)?.text;
  return row && text ? { instructions: text, version: row.version } : { instructions: CODE_PROMPTS[task], version: 0 };
}

/** Sufixo da versão do prompt gravada em `ai_calls` e no rastro (ex.: `plano-v2@cfg3+tom`). */
export function promptSuffix(p: ActivePrompt, opts: { tone?: boolean; examples?: boolean; about?: boolean; avoid?: boolean } = {}): string {
  return `${p.version ? `@cfg${p.version}` : ""}${opts.tone ? "+tom" : ""}${opts.examples ? "+ex" : ""}${opts.about ? "+sobre" : ""}${opts.avoid ? "+evitar" : ""}`;
}

export type PromptVersionRow = { version: number; text: string; note: string | null; createdAt: string; current: boolean };

export async function listPromptVersions(ex: Executor, task: PromptTask): Promise<PromptVersionRow[]> {
  const cur = await getActivePrompt(ex, task);
  const rows = await ex.select().from(appConfigVersions).where(eq(appConfigVersions.key, key(task))).orderBy(desc(appConfigVersions.version));
  return [
    ...rows.map((r) => ({ version: r.version, text: (r.value as { text: string }).text, note: r.note, createdAt: r.createdAt.toISOString(), current: r.version === cur.version })),
    { version: 0, text: CODE_PROMPTS[task], note: "texto original do código", createdAt: "", current: cur.version === 0 },
  ];
}

export async function publishPrompt(db: Db, task: PromptTask, text: string, note?: string): Promise<{ ok: true; version: number } | { ok: false; erro: "vazio" | "longo" }> {
  const t = text.trim();
  if (t.length < 10) return { ok: false, erro: "vazio" };
  if (t.length > PROMPT_MAX_CHARS) return { ok: false, erro: "longo" };
  return db.transaction(async (tx) => {
    // Lock por chave: duas publicações simultâneas não disputam a mesma versão (revisão do plano S3).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key(task)}))`);
    const [{ v }] = (await tx.select({ v: sql<number | null>`max(${appConfigVersions.version})` }).from(appConfigVersions).where(eq(appConfigVersions.key, key(task)))) as [{ v: number | null }];
    const version = (v ?? 0) + 1;
    await tx.insert(appConfigVersions).values({ key: key(task), version, value: { text: t }, note: note?.trim().slice(0, 120) || null });
    await tx.insert(appConfig).values({ key: key(task), version }).onConflictDoUpdate({ target: appConfig.key, set: { version, updatedAt: new Date() } });
    return { ok: true as const, version };
  });
}

export async function rollbackPrompt(db: Db, task: PromptTask, version: number): Promise<{ ok: true } | { ok: false; erro: "nao_encontrado" }> {
  if (version === 0) {
    await db.delete(appConfig).where(eq(appConfig.key, key(task)));
    return { ok: true };
  }
  const [row] = await db.select({ v: appConfigVersions.version }).from(appConfigVersions).where(and(eq(appConfigVersions.key, key(task)), eq(appConfigVersions.version, version)));
  if (!row) return { ok: false, erro: "nao_encontrado" };
  await db.insert(appConfig).values({ key: key(task), version }).onConflictDoUpdate({ target: appConfig.key, set: { version, updatedAt: new Date() } });
  return { ok: true };
}

export async function getFlags(ex: Executor): Promise<Flags> {
  const [row] = await ex
    .select({ value: appConfigVersions.value })
    .from(appConfig)
    .innerJoin(appConfigVersions, and(eq(appConfigVersions.key, appConfig.key), eq(appConfigVersions.version, appConfig.version)))
    .where(eq(appConfig.key, "flags"))
    .limit(1);
  const v = (row?.value ?? {}) as Partial<Flags>;
  return Object.fromEntries(FLAGS.map((f) => [f, v[f] ?? FLAG_DEFAULTS[f]])) as Flags;
}

export async function setFlag(db: Db, flag: Flag, on: boolean): Promise<Flags> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('flags'))`);
    const next = { ...(await getFlags(tx)), [flag]: on };
    const [{ v }] = (await tx.select({ v: sql<number | null>`max(${appConfigVersions.version})` }).from(appConfigVersions).where(eq(appConfigVersions.key, "flags"))) as [{ v: number | null }];
    const version = (v ?? 0) + 1;
    await tx.insert(appConfigVersions).values({ key: "flags", version, value: next, note: `${flag}=${on ? "ligado" : "desligado"}` });
    await tx.insert(appConfig).values({ key: "flags", version }).onConflictDoUpdate({ target: appConfig.key, set: { version, updatedAt: new Date() } });
    return next;
  });
}
