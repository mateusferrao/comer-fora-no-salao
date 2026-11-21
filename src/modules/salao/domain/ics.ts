/**
 * "Adicionar à agenda" (S5.2, D169: 1 evento, sem repetição): iCalendar (RFC 5545) com CRLF, horários em UTC,
 * escape de `\ ; , \n` e linhas dobradas em 75 octetos sem cortar caracteres UTF-8.
 */
const enc = new TextEncoder();

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Dobra a linha: a 1ª com até 75 octetos, as seguintes com 1 espaço + até 74. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = " ";
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function inviteIcs(p: { uid: string; restaurant: string; address: string | null; gain: string; window: { start: Date; end: Date }; journeyUrl: string; now: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Comer Fora no Salao//Convite//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${p.uid}`,
    `DTSTAMP:${utc(p.now)}`,
    `DTSTART:${utc(p.window.start)}`,
    `DTEND:${utc(p.window.end)}`,
    `SUMMARY:${escape(`${p.gain} · ${p.restaurant}`)}`,
    ...(p.address ? [`LOCATION:${escape(p.address)}`] : []),
    `DESCRIPTION:${escape(`Chegando ao restaurante, faça check-in no app e mostre ao garçom o código do benefício.\nVer o convite: ${p.journeyUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
