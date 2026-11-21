/** "Ana Souza" → "Ana S." (só primeiro nome + inicial); sem nome (dados apagados ou perfil pendente) → "Cliente". */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Cliente";
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.` : parts[0]!;
}
