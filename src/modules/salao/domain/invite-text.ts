/**
 * Texto do convite aprovado pelo dono (D122) mostrado ao cliente embaixo da 1ª linha, que o código já escreve
 * ("Volte {quando} e ganhe {oferta}"). S9: o texto modelo e o da IA costumam começar com a mesma frase; aí o cliente
 * vê só o que o dono acrescentou, sem a repetição.
 */
export function inviteExtra(message: string | null, gain: string | undefined): string | null {
  const text = message?.trim();
  if (!text) return null;
  if (!gain || !/^volte\b/i.test(text)) return text;
  const at = text.toLowerCase().indexOf(gain.toLowerCase());
  if (at < 0) return text;
  const rest = text
    .slice(at + gain.length)
    .replace(/^[\s:,;.–-]+/, "")
    .trim();
  if (rest.replace(/[.!?\s]/g, "").length < 3) return null;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
