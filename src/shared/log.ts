/**
 * Logs estruturados (espec. 4.8; dívida S0 #27): uma linha JSON por evento no stdout, com LISTA DE CAMPOS
 * PERMITIDOS (revisão do plano S3): o que não está na lista é descartado — e-mail, telefone, nome ou texto livre do
 * usuário nunca chegam ao log, mesmo por engano.
 */
export type LogLevel = "info" | "warn" | "error";
export const LOG_FIELDS = ["area", "task", "model", "status", "reason", "restaurantId", "ms", "count", "code", "err", "attempts", "sha", "signal"] as const;
type Field = (typeof LOG_FIELDS)[number];
export type LogFields = Partial<Record<Field, string | number | boolean | null>>;

export function formatLog(level: LogLevel, msg: string, fields: Record<string, unknown> = {}, at = new Date()): string {
  const out: Record<string, unknown> = { at: at.toISOString(), level, msg: msg.slice(0, 200) };
  for (const k of LOG_FIELDS) {
    const v = fields[k];
    if (v === undefined) continue;
    out[k] = typeof v === "string" ? v.slice(0, 200) : typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v).slice(0, 200);
  }
  return JSON.stringify(out);
}

export const log = {
  info: (msg: string, f?: LogFields) => console.info(formatLog("info", msg, f)),
  warn: (msg: string, f?: LogFields) => console.warn(formatLog("warn", msg, f)),
  error: (msg: string, f?: LogFields) => console.error(formatLog("error", msg, f)),
};
