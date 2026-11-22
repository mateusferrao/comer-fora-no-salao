import Link from "next/link";
import { getDb } from "@/src/db/client";
import { getFlags } from "@/src/modules/config/application/app-config";

/**
 * Roteiro do avaliador (D153, D156, D172): fora das telas do produto — na página do link de avaliação e nas
 * Ferramentas do avaliador (Bastidores). Lê as flags: passo de recurso desligado não aparece (revisão S4–S6 — sem
 * beco sem saída para quem testa sozinho). S9: nome do bloco do painel conforme `painel_valor` e passo do assistente.
 */
export async function Roteiro({ className = "" }: { className?: string }) {
  const flags = await getFlags(getDb());
  return (
    <section aria-labelledby="roteiro-curto" className={`rounded-sm border border-border bg-white p-4 text-left text-sm leading-6 text-ink ${className}`}>
      <h2 id="roteiro-curto" className="mb-1 text-base font-semibold">
        Como testar sozinho
      </h2>
      <ol className="list-decimal pl-5">
        <li>No Portal, o restaurante de exemplo já tem 60 dias de histórico. Cadastre o seu em &quot;Cadastrar meu restaurante&quot;.</li>
        <li>Abra &quot;Ver minha página&quot; e faça check-in como cliente com o seu e-mail (o código chega por e-mail).</li>
        <li>
          Valide o código em &quot;Validar código&quot; e veja o check-in em &quot;{flags.painel_valor ? "Hoje no salão" : "Últimos check-ins de hoje"}&quot;, na
          Visão geral.
        </li>
        <li>
          Para ver a volta com convite hoje, use &quot;Avançar 1 dia&quot; nas{" "}
          <Link className="text-red-text underline" href="/bastidores/avaliador">
            Ferramentas do avaliador
          </Link>{" "}
          e faça check-in de novo.
        </li>
        {flags.resumo_email && (
          <li>
            Em &quot;Plano da semana&quot;, gere o plano se ainda não houver um esperando aprovação, abra &quot;Ver o e-mail desta semana&quot; e use o link
            &quot;Revisar e aprovar&quot; para aprovar o plano como o dono faria pelo e-mail.
          </li>
        )}
        {flags.copiloto && (
          <li>
            No restaurante de exemplo, abra o &quot;Assistente&quot; e toque em &quot;Trocar a oferta do convite…&quot;. O pedido vira um cartão com o antes, o
            depois e o custo calculado pelo sistema; nada muda até você tocar em &quot;Aplicar&quot;.
          </li>
        )}
        {flags.modo_garcom && <li>Em &quot;Validar código&quot;, crie o &quot;Link do garçom&quot; e abra no celular: ele valida códigos sem entrar no Portal.</li>}
        <li>Em &quot;Configurações&quot;, veja &quot;Avisos e automação&quot; e &quot;IA do restaurante&quot; (fatos, o que evitar e &quot;Ver como fica&quot;).</li>
      </ol>
      <p className="mt-2 text-ink-muted">
        1 em cada 10 clientes cai no grupo de controle e não recebe convite (é assim que o efeito é medido). Para testar outro cliente, saia em &quot;Sua
        jornada&quot; e entre com outro e-mail (ex.: seu+2@gmail.com).
      </p>
      <p className="mt-2">
        <Link className="text-red-text underline" href="/bastidores/como-funciona">
          Como este protótipo funciona
        </Link>
      </p>
    </section>
  );
}
