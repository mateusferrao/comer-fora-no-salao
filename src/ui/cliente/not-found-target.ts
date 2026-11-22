/** Telas do cliente (QR, Jornada, e-mail): o 404 volta para Sua jornada, nunca para a página do dono (S9). */
const CUSTOMER_PATHS = ["/r", "/app", "/cliente"];

export function isCustomerPath(path: string): boolean {
  return CUSTOMER_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function notFoundTarget(path: string): { href: string; label: string } {
  return isCustomerPath(path) ? { href: "/app/jornada", label: "Ver Sua jornada" } : { href: "/", label: "Voltar ao início" };
}
