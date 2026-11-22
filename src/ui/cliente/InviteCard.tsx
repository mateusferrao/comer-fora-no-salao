import type { InviteView } from "@/src/modules/salao/application/views";
import { inviteSentence, inviteValidity, inviteWhen, TXT } from "./textos";

/** 2º card do convite (espec. 3.5.4): só para convite REAL; o holdout nunca recebe este componente. */
export function InviteCard({ invite, animate = false, regionLabel, agenda = false }: { invite: InviteView; animate?: boolean; regionLabel?: string; agenda?: boolean }) {
  const heading = invite.state === "usar_hoje" ? "Seu convite vale hoje" : invite.state === "lembrete" ? "Seu convite continua valendo" : "Seu convite";
  const when = inviteWhen(invite);
  return (
    <section aria-label={regionLabel ?? heading} className={`rounded-xl border-2 border-red-text bg-white p-4 text-left ${animate ? "motion-safe:animate-[aparece_400ms_ease-out_both]" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-red-text">{heading}</p>
      <p className="mt-2 text-lg font-semibold leading-6 text-ink">
        <span aria-hidden="true">{inviteSentence(invite)}</span>
        <span className="sr-only">{invite.state === "usar_hoje" ? inviteSentence(invite) : `Volte ${when.long}${invite.offer ? ` e ganhe ${invite.offer.gain}` : ""}`}</span>
      </p>
      <p className="mt-1 text-sm text-ink-muted">{inviteValidity(invite)}</p>
      {invite.message && (
        <div className="mt-3 border-t border-divider pt-3">
          {/* Texto do convite aprovado pelo dono (D122); sem rótulo, para não confundir com o recado do kit (revisão da S2). */}
          <p data-testid="invite-message" className="text-sm italic leading-5 text-ink">“{invite.message}”</p>
        </div>
      )}
      {invite.state !== "usar_hoje" && <p className="mt-3 text-sm leading-5 text-ink">{TXT.comoUsarConvite}</p>}
      {invite.liberatedToday && <p className="mt-3 text-sm text-ink-muted">Liberado hoje pelas ferramentas do avaliador.</p>}
      {/* S5.2 (flag copy_v2): .ics de 1 evento no próximo dia em que o código pode nascer. */}
      {agenda && invite.agendaUrl && invite.state !== "usar_hoje" && (
        <a href={invite.agendaUrl} download className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ink">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          Adicionar à agenda
        </a>
      )}
    </section>
  );
}
