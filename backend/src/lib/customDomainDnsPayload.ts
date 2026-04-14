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
      note:
        "O domínio foi registado automaticamente no projeto do site. Configure o CNAME (ou A no apex) e o(s) TXT abaixo; depois use «Verificar».",
    };
  }

  return {
    mode: "dclickora" as const,
    txt_name: verificationTxtRecordName(hostname),
    txt_value: verificationTxtValue(token),
    note:
      "Crie um único registo TXT: primeira linha = Nome/Host do registo; segunda linha = Valor/Conteúdo. Depois use «Verificar».",
  };
}
