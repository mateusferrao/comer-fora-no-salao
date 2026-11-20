import type { InviteView } from "@/src/modules/salao/application/views";
import { ddmm, inviteSentence, inviteWhen, TXT } from "./textos";
import { TestAdvance } from "./TestAdvance";

/** 2º card do convite (espec. 3.5.4): só para convite REAL; o holdout nunca recebe este componente. */
export function InviteCard({ invite, animate = false, regionLabel }: { invite: InviteView; animate?: boolean; regionLabel?: string }) {
  const heading = invite.state === "usar_hoje" ? "Seu convite vale hoje" : invite.state === "lembrete" ? "Seu convite continua valendo" : "Seu convite";
  const when = inviteWhen(invite);
  return (
    <section aria-label={regionLabel ?? heading} className={`rounded-xl border-2 border-red-text bg-white p-4 text-left ${animate ? "motion-safe:animate-[aparece_400ms_ease-out_both]" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-red-text">{heading}</p>
      <p className="mt-2 text-lg font-semibold leading-6 text-ink">
        <span aria-hidden="true">{inviteSentence(invite)}</span>
        <span className="sr-only">{`Volte ${when.long}${invite.offer ? ` e ganhe ${invite.offer.gain}` : ""}`}</span>
      </p>
      <p className="mt-1 text-sm text-ink-muted">Válido até {ddmm(invite.untilDay)}</p>
      {invite.message && (
        <div className="mt-3 border-t border-divider pt-3">
          {/* Texto do convite aprovado pelo dono (D122); sem rótulo, para não confundir com o recado do kit (revisão da S2). */}
          <p data-testid="invite-message" className="text-sm italic leading-5 text-ink">“{invite.message}”</p>
        </div>
      )}
      {invite.state !== "usar_hoje" && <p className="mt-3 text-sm leading-5 text-ink">{TXT.comoUsarConvite}</p>}
      {invite.test && (invite.test.canAdvance || invite.test.liberatedToday) && <TestAdvance inviteId={invite.test.inviteId} canAdvance={invite.test.canAdvance} liberatedToday={invite.test.liberatedToday} />}
    </section>
  );
}
