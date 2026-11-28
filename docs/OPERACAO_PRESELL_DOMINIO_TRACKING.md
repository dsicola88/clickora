# Operação actual — presell, domínio e tracking

**Actualizado:** 2026-11-26  
**Fonte:** código em `frontend/` e `backend/` nesta data (não o relatório forense, que é um retrato da investigação).  
**Para quem:** afiliado que opera a conta e programador que altera o funil.

O domínio `www.dclickora.com` é o site e o painel do SaaS. As páginas que o Google Ads visita são sempre o domínio do assinante (ou um domínio técnico isolado). O salto para a oferta da rede passa por `/track/r/` nesse mesmo domínio.

---

## 1. Fluxo do dia a dia

1. Na conta dclickora, o assinante liga um domínio próprio (Hostinger ou outro DNS).
2. Cola no DNS o que a app mostra: apontamento para a Vercel (CNAME ou A) e o TXT de posse `_dclickora-verify`.
3. Clica em **Verificar**. O domínio fica `verified` e, quando o HTTPS está pronto, entra na URL de anúncio.
4. Cria a presell (Black, Super Presell ou Espelho), publica, e copia a URL do domínio próprio.
5. No Google Ads cola a **URL final** sem query. Os UTMs e `{keyword}` vão no **sufixo**. O `gclid` não se cola à mão: o auto-tagging do Google acrescenta-o no clique.
6. O clique pago abre a presell no domínio do assinante (HTTP 200, o mesmo HTML para pessoa e para AdsBot).
7. O CTA (e, só se a opção estiver ligada, o botão Aceitar dos cookies) abre `/track/r/` nesse domínio. A Clickora regista o clique e envia o visitante ao hoplink da rede.
8. A venda volta por postback. Os relatórios separam tráfego real e tráfego filtrado.

Sem domínio verificado e sem `PUBLIC_PRESELL_HOST`, a app não gera URL pública. Não há fallback para `www.dclickora.com`.

---

## 2. Onde cada coisa é servida

| Host | O que o visitante vê | O que não existe aqui |
|------|----------------------|------------------------|
| `dclickora.com` / `www.dclickora.com` | Site, login, painel, preview **privado** do dono (sessão do mesmo tenant) | Presell pública, slug público, `/api/track/r/`, `/api/track/rot/` |
| Domínio verificado do assinante | Presell em `/{slug}`, `/p/:id` ou `/l/:id`; hop `/api/track/r/` | Painel do SaaS (esses caminhos voltam para dclickora) |
| `PUBLIC_PRESELL_HOST` (opcional) | O mesmo que um domínio de assinante, num host só de páginas publicadas | Não pode ser `dclickora.com` — esse valor é ignorado |
| `localhost` / preview Vercel | Desenvolvimento | Não é URL de anúncio |

A decisão depende só do host e, no domínio principal, da sessão. User-Agent, IP e bot não mudam o HTML nem o destino do hop.

No domínio principal, presell ou hop sem sessão respondem **404** (`PRESELL_NOT_PUBLIC_ON_MAIN_HOST`), com `Cache-Control: private, no-store` e `X-Robots-Tag: noindex, nofollow`. Com sessão do dono, a API devolve a página como preview privado.

Código:

- `frontend/middleware.js` — borda Vercel (404 de presell e de `/api/track/r/` no domínio principal).
- `backend/src/lib/publicPresellHost.ts` — o que conta como domínio principal e o host técnico.
- `backend/src/lib/presellHostAccess.ts` — `evaluatePublicPresellAccess`.
- `frontend/src/lib/publicPresellOrigin.ts` — URL que a UI copia para o anúncio.

---

## 3. Três formas de criar a página

No assistente, o nicho é `black` ou `white`. No white há ainda o modo da página.

| O que o afiliado escolhe | Campo gravado | O que o visitante vê |
|--------------------------|---------------|----------------------|
| **Black** | `generationNiche: "black"` | Página informativa da Clickora. Usa nome e fotos lidas na origem. Não reproduz a sales page nem as promessas dela. O hoplink fica no CTA. |
| **White → Super Presell** (recomendado para Google) | `generationNiche: "white"` e `importPresentation: "essentials"` | Layout da Clickora com imagem, título e texto extraídos. CTA via `/track/r/`. O HTML da sales page não é clonado. O texto público fala do produto, sem aviso de que o autor é afiliado. |
| **White → Espelho** | `generationNiche: "white"` e `importPresentation: "mirror"` | HTML importado (visual próximo da origem). O JavaScript da origem não corre. Links de compra viram `<a href>` para `/track/r/`. Maior risco de «site comprometido» no Google. |

O hoplink da rede (Knownwalk, BuyGoods, MaxWeb, Digistore, etc.) fica em `affiliate_link` e é o destino do hop. Se a sales page bloquear o servidor, a presell ainda pode ser criada a partir do hop; o segundo campo do assistente aceita o URL da página do produto.

Tipos agressivos (`fantasma`, `sexo`, `idade`, `captcha`, `modelos`, …) existem no Black e ficam ocultos no White. Default: cookies no Black, TSL no White.

Código: `CreatePresellWizardPage.tsx`, `presellGenerationNiche.ts`, `presellImportPresentation.ts`, `presellImportMode.ts`, `presellImporter.ts`.

---

## 4. URL pública e Google Ads

Ordem da origem pública (`getPublicPresellOriginForPresell`):

1. Domínio da presell, se estiver verificado e pronto para HTTPS.
2. Domínio padrão da conta (ou o mais antigo) nas mesmas condições.
3. Em desenvolvimento, `localhost`.
4. `VITE_PUBLIC_PRESELL_HOST`, se existir e não for o domínio da plataforma.
5. Domínio verificado ainda sem HTTPS (a checklist avisa).
6. String vazia — não há onde publicar.

No domínio do assinante, com slug, o caminho é `/{slug}`. Sem slug, tipos simples usam `/l/:id` (HTML lite) e tipos com gate (cookies, idade, VSL, desconto, fantasma, builder, …) usam `/p/:id`.

A UI parte isto em dois campos:

| Campo no Google Ads | Conteúdo |
|---------------------|----------|
| URL final | `https://dominio-do-assinante/slug` — sem query |
| Sufixo da URL final | `utm_source`, `utm_medium=cpc`, `utm_campaign`, `utm_term={keyword}`, `utm_content={adgroupid}` |

`gclid`, `gbraid`, `wbraid`, `gad_source` e os click ids de outras redes **não** entram no sufixo gerado. O Google acrescenta-os no clique. A presell e o hop têm de os preservar até à rede.

Código: `frontend/src/lib/googleAdsPresellUrl.ts`, `GoogleAdsPresellUrlBlock.tsx`.

---

## 5. Domínio próprio (conta + DNS)

A app regista o hostname no projecto Vercel e devolve `pending_dns`. O assinante só mexe em dois sítios: **Definições → domínio** na dclickora, e o painel DNS (Hostinger ou outro).

Com Vercel ligado, são obrigatórios:

- **Apontamento:** subdomínio → CNAME `cname.vercel-dns.com`; apex → A `76.76.21.21` (ou ALIAS, conforme o registrador).
- **Posse dclickora:** TXT `_dclickora-verify.<hostname>` = `dclickora-verification=<token>`. Sem este TXT, um CNAME já apontado para a Vercel de outra conta não fica verificado.
- **TXT que a Vercel pedir** (quando a API os devolver).

Depois: **Verificar**. `status: verified` e `https_ready` (ou SSL próprio, fora da Vercel) é que tornam o domínio utilizável como URL final. Domínio só de tracking (`purpose=tracking`) não serve de lander.

Código: `customDomainDnsPayload.ts`, `customDomainDnsDisplay.ts`, `customDomain.controller.ts`.

---

## 6. Cookies

Barra inferior, não bloqueia scroll nem CTAs.

| Acção | Efeito |
|-------|--------|
| **Aceitar**, opção desligada (defeito) | Grava consentimento «todos». A página fica. A compra é nos CTAs. |
| **Aceitar**, opção «Aceitar cookies → ir à oferta» ligada | Grava consentimento e abre a oferta **só por esse clique**, via `/track/r/` (UTMs e gclid da landing). |
| **Fechar** | Só cookies essenciais. Nunca navega. |

A opção vive em `settings.cookieRedirectToOffer` (também `cookie_redirect_to_offer`). Valores que ligam: `true`, `1`, `"true"`, `"1"`. Aparece nas opções do tipo quando o tipo é `cookies`.

O que não existe: redirect ao mexer o rato, ao scroll, ao toque, ou ao fechar o banner / o overlay de desconto. O tipo fantasma também não navega por movimento.

Código: `PresellTypeControls.tsx` (`cookieConsentNavigation`, `isCookieRedirectToOfferEnabled`), `CookieBannerWidget.tsx`, `presellExportHtml.ts`, `presellVisualEdit.ts` (`bakePublicOfferHrefs`), `DiscountPresellOverlay.tsx`.

**Divergência nos testes (26 Nov):** `cookieConsentNavigation.test.ts` e o caso «cookies» de `presellExportHtml.noforcedredirect.test.ts` ainda afirmam que Aceitar nunca navega e que `cookieRedirectToOffer` é sempre ignorado. O código da UI, o export e os textos i18n (`cookieDirectTitle` / `cookieDirectHint`) implementam o opt-in descrito nesta secção. Quem alterar cookies deve alinhar esses dois testes ao comportamento do código, ou o contrário — não deixar os dois contratos ao mesmo tempo.

---

## 7. Tracking (`/track/r/`)

- O hop só responde no domínio do assinante (ou no domínio técnico). No domínio principal o middleware responde 404, para qualquer User-Agent.
- CTAs gravados com `https://www.dclickora.com/api/track/…` são reescritos para a base do domínio que está a servir a página (`rehomePlatformTrackUrls`).
- Antifraude (bot, proxy, listas, rate-limit) actua no hop e no pixel. Não troca o HTML da URL final.
- `isIntentionalPublicPageCloakReason` devolve sempre `false`: não há página «segura» diferente para crawler.
- Um proxy com `gclid` / `wbraid` / `gbraid` / `gad_source` real pode seguir para a oferta (`shouldBypassProxyBlockForPaidClick`), porque o clique do anúncio já foi cobrado. Isto não muda o HTML da landing.
- Pixel, impressão e o hop não dependem do consentimento de marketing.

Código: `track.controller.ts`, `trackingGuardPolicy.ts`, `trackGuard.ts`, `frontend/middleware.js`.

---

## 8. Regras que este funil não pode violar

1. AdsBot, Googlebot e a ferramenta de inspecção vêem a mesma URL final que a pessoa, com HTTP 200.
2. Medição (`/track/r/`, pixel, impressão) não espera pelo banner de cookies.
3. Nenhuma lista, país ou bot substitui o HTML da landing. A filtragem fica no hop e nos relatórios.
4. Navegação para a oferta é um clique num link (`<a href>` para `/track/r/`), incluindo o espelho importado.
5. O domínio principal não hospeda presells públicas nem saltos de oferta.

Estas regras estão também em `.cursor/rules/affiliate-platform-gate.mdc`.

---

## 9. Variáveis

| Variável | Onde | Função |
|----------|------|--------|
| `PUBLIC_PRESELL_HOST` | Backend | Host técnico só de páginas publicadas. Ignorado se for `dclickora.com` ou `www.dclickora.com`. |
| `VITE_PUBLIC_PRESELL_HOST` | Frontend (build) | O mesmo host, para a UI gerar o link quando a conta ainda não tem domínio próprio. |
| `VITE_PUBLIC_SITE_ORIGIN` | Frontend | Origem do **site** institucional. Não é origem de presell. |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | Backend | Registo do domínio do assinante e SSL. |

As duas variáveis de host técnico têm de coincidir. Exemplos comentados em `backend/.env.example` e `frontend/.env.example`.

---

## 10. Mapa rápido de ficheiros

| Tema | Ficheiros |
|------|-----------|
| Host / 404 no SaaS | `frontend/middleware.js`, `presellHostAccess.ts`, `publicPresellHost.ts`, `publicSpaOrigin.ts` |
| URL copiada para Ads | `publicPresellOrigin.ts`, `googleAdsPresellUrl.ts` |
| DNS | `customDomainDnsPayload.ts`, `customDomainDnsDisplay.ts`, `CustomDomainSettings.tsx` |
| Importação | `presellImporter.ts`, `presellImportMode.ts`, `presellImportPresentation.ts`, `presellGenerationNiche.ts` |
| Página pública | `PublicPresell.tsx`, `presell.controller.ts`, `presellLiteHtml.ts` |
| Cookies | `PresellTypeControls.tsx`, `CookieBannerWidget.tsx`, `presellExportHtml.ts` |
| Hop | `track.controller.ts`, `trackingGuardPolicy.ts` |
| Espelho | `presellOfferHrefBake.ts`, `ImportedPageMirrorIframe.tsx` |

---

## 11. Relação com a auditoria forense

A auditoria forense interna (não versionada: o repositório é público) descreve a investigação de 26 Nov **antes** das correcções de isolamento, redirects e modos de página. O comportamento em produção a seguir é o deste documento.

O que essa investigação mostrou e o que o código passou a fazer:

- Presells e hops deixaram de ser públicos em `www.dclickora.com`.
- A landing deixou de ser trocada por IP, lista ou User-Agent.
- Redirects por movimento do rato, scroll ou «fechar» foram retirados.
- O espelho navega por links nativos para `/track/r/`.
- Super Presell (essentials) é o modo white que não clona o HTML da sales page.

Uma URL de presell que o Google qualifica (exemplo observado nesse dia: página no domínio próprio do assinante, produto sem alegações de saúde, modo que não espelha a sales page) confirma o funil deste documento. Não garante aprovação de outras páginas: alegações do anúncio, conteúdo do espelho e reputação do domínio continuam a ser revistos pelo Google à parte.
