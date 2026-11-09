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
    return {
      mode: "vercel" as const,
      cname,
      vercel_txt: opts.vercelVerification.map((v) => ({
        type: v.type,
        name: v.domain,
        value: v.value,
        reason: v.reason,
      })),
      vercel_verified_immediately: opts.vercelVerifiedImmediately,
      note: "Cole os valores abaixo no painel do domínio e clique em Verificar.",
    };
  }

  return {
    mode: "dclickora" as const,
    txt_name: verificationTxtRecordName(hostname),
    txt_value: verificationTxtValue(token),
    note: "Cole Nome e Valor abaixo no painel do domínio. Depois clique em Verificar.",
  };
}
