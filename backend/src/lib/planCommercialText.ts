/**
 * Frases livres da página de vendas.
 * Um número de páginas, cliques ou domínios só pode viver nos campos do plano.
 * Se a frase o repetir, fica velha quando o superadmin muda o limite.
 */

const QUOTA_WORD = /cliques?|p[áa]ginas?|presells?|dom[íi]nios?/i;

export function freeTextEmbedsNumericQuota(text: string): boolean {
  return /\d/.test(text) && QUOTA_WORD.test(text);
}

const STALE_PHRASES: Record<string, string> = {
  "Até 3 presell pages · 1.000 cliques/mês (trial)":
    "Páginas e cliques deste plano são os números do cartão. Ao passar a quota de cliques, o anúncio continua.",
  "Postback de afiliados: upgrade para Pro Mensal ou Pro Anual":
    "O aviso de vendas da rede segue o interruptor deste plano.",
  "Até 25 presell pages · 50.000 cliques/mês":
    "Páginas e cliques deste plano são os números do cartão. Ao passar a quota de cliques, o anúncio continua.",
  "Todos os tipos de presell no editor · Sem branding dclickora no rodapé":
    "Todos os tipos de presell no editor. Retirar a marca depende do interruptor deste plano.",
  "Domínio personalizado: use Pro Anual (até 2) ou export HTML no Mensal":
    "Os domínios próprios são o número deste cartão.",
  "Presells e cliques com quotas amplas (uso razoável) durante o ano":
    "Páginas e cliques seguem os campos deste plano. Vazio significa sem máximo numérico. Ao passar uma quota de cliques, o anúncio continua.",
  "Até 2 domínios personalizados · Sem branding dclickora no rodapé":
    "Os domínios próprios são o número deste cartão. Retirar a marca depende do interruptor deste plano.",
  "Páginas, cliques e 1 domínio: os números do cartão":
    "Páginas, cliques e domínios deste plano são os números do cartão.",
  "Até 2 domínios próprios": "Os domínios próprios são o número deste cartão.",
  "Sem marca Clickora": "Pode retirar a marca",
  "Compare presells, cliques e o que cada plano inclui. Os números são os limites da conta, não uma previsão de vendas. O plano grátis não pede cartão nesta página.":
    "Compare o que cada plano inclui. O número de páginas é o máximo que a conta deixa criar. O número de cliques é a quota do mês no painel: o anúncio não é cortado ao passar essa quota. O plano grátis não pede cartão nesta página.",
  "A venda entra quando a rede a confirma.":
    "A venda entra nos planos que recebem o aviso da rede.",
  "Onde vale a pena gastar": "Campanha e venda juntas",
  "A campanha e a palavra-chave ficam ao lado da venda confirmada. Vê o que trouxe resultado e o que só gastou. A decisão de aumentar o orçamento é sua, com os dados juntos.":
    "A campanha e a palavra-chave ficam ao lado da venda confirmada, nos planos que recebem o aviso da rede. O custo do anúncio só entra quando o Google aceita a leitura. A decisão de aumentar o orçamento é sua.",
  "Nos planos pagos, o botão Compra abre o checkout Hotmart (se HOTMART_PRODUCT_URL ou HOTMART_PLAN_CHECKOUT_URLS estiver configurado no servidor). Após pagamento aprovado, o webhook Hotmart activa a assinatura — use o mesmo e-mail na Hotmart e na Clickora. Se o link não estiver configurado, verá um aviso em vez do redirect.":
    "Nos planos pagos, o botão abre o checkout da Hotmart. Depois do pagamento aprovado, a assinatura ativa se o e-mail da compra for o da conta. O preço escrito no cartão não é o valor que a Hotmart cobra: esse é o da oferta no checkout.",
  "Inclui o postback: a venda entra no painel quando a rede a confirma.":
    "O aviso de vendas e os anúncios seguem os interruptores de cada cartão.",
  "Inclui o aviso de vendas: a venda entra no painel quando a rede a confirma.":
    "O aviso de vendas e os anúncios seguem os interruptores de cada cartão.",
  "Para usar o ano inteiro, com domínio próprio.":
    "Para o ano inteiro. Domínios e anúncios seguem os números e os interruptores deste cartão.",
  "Para o ano inteiro, com 2 domínios e o módulo de anúncios.":
    "Para o ano inteiro. Domínios e anúncios seguem os números e os interruptores deste cartão.",
  "Para quem já anuncia e precisa de registar as vendas.":
    "Para quem já anuncia. O aviso de vendas segue o interruptor deste cartão.",
};

export function rewriteKnownStalePhrase(text: string): string {
  return STALE_PHRASES[text] ?? text;
}

export function rewriteCommercialTree<T>(value: T): T {
  if (typeof value === "string") return rewriteKnownStalePhrase(value) as T;
  if (Array.isArray(value)) return value.map((item) => rewriteCommercialTree(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteCommercialTree(item);
    }
    return out as T;
  }
  return value;
}

export function collectCommercialStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectCommercialStrings(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectCommercialStrings(item, out);
  }
  return out;
}

export const NUMERIC_QUOTA_IN_FREE_TEXT =
  "A frase não pode trazer um número de páginas, cliques ou domínios. Esses valores vêm dos campos do plano e mudam no cartão quando os alterar.";
