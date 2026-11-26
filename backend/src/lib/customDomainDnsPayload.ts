/**
 * Payload `pending_dns` devolvido ao afiliado (lista/criar domínio + erros de «Verificar»).
 * Fonte única para API e testes.
 */
import { verificationTxtRecordName, verificationTxtValue } from "./customDomainDns";

import {
  vercelCnameHint,
  type VercelVerificationChallenge,
} from "./vercelProjectDomains";

export function buildPendingDnsPayload(
  hostname: string,
  token: string,
  opts: {
    vercel: boolean;
    vercelVerification: VercelVerificationChallenge[];
    vercelVerifiedImmediately: boolean;
  },
) {
  const cname = vercelCnameHint(hostname);

  if (opts.vercel) {
    // Duas provas são obrigatórias: a da Vercel (roteamento/SSL) e a nossa (`_dclickora-verify`),
    // que prova que quem gere o DNS é quem criou o domínio na conta. Sem a nossa, um CNAME
    // já apontado para a Vercel de outra conta (takeover) ficaria verificado sem prova de posse.
    return {
      mode: "vercel" as const,
      cname,
      vercel_txt: opts.vercelVerification.map((v) => ({
        type: v.type,
        name: v.domain,
        value: v.value,
        reason: v.reason,
      })),
      txt_name: verificationTxtRecordName(hostname),
      txt_value: verificationTxtValue(token),
      vercel_verified_immediately: opts.vercelVerifiedImmediately,
      note: "Cole o CNAME/A e o TXT de posse abaixo no painel do domínio e clique em Verificar.",
    };
  }

  return {
    mode: "dclickora" as const,
    txt_name: verificationTxtRecordName(hostname),
    txt_value: verificationTxtValue(token),
    note: "Cole Nome e Valor abaixo no painel do domínio. Depois clique em Verificar.",
  };
}
