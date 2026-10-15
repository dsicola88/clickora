/**
 * Identidade visual e editorial por tipo de presell.
 * Cada tipo deve ler-se como uma composição distinta (não um template genérico),
 * alinhada a transparência comercial e valor de página — sem prometer aprovação de ads.
 */

export type PresellTypeTheme = {
  id: string;
  /** Selo curto no topo (visitante). */
  badge: string;
  /** Uma linha de posicionamento editorial. */
  eyebrow: string;
  /** Classes Tailwind do plano de fundo do hero (não-espelho). */
  heroBg: string;
  /** Classes do selo. */
  badgeClass: string;
  /** Tom do CTA sugerido. */
  ctaSurface: "light" | "dark" | "warm" | "ink";
  /** Tom do chrome do espelho. */
  chromeClass: string;
  chromeLabelClass: string;
  chromeCtaClass: string;
};

const DEFAULT: PresellTypeTheme = {
  id: "default",
  badge: "Oferta",
  eyebrow: "Página independente para decidir com informação clara.",
  heroBg: "bg-gradient-to-b from-stone-100 via-stone-50/80 to-background dark:from-stone-950 dark:via-stone-900/40 dark:to-background",
  badgeClass: "bg-stone-900/90 text-stone-50",
  ctaSurface: "light",
  chromeClass: "border-border/70 bg-background/95 text-foreground",
  chromeLabelClass: "text-muted-foreground",
  chromeCtaClass: "border-stone-800/30 text-stone-900 hover:bg-stone-900/5",
};

const THEMES: Record<string, PresellTypeTheme> = {
  cookies: {
    id: "cookies",
    badge: "Consentimento",
    eyebrow: "Antes de continuar: preferências de cookies e privacidade.",
    heroBg: "bg-gradient-to-b from-sky-50 via-white to-background dark:from-sky-950/40 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-sky-800 text-sky-50",
    ctaSurface: "light",
    chromeClass: "border-sky-200/80 bg-sky-50/95 text-sky-950",
    chromeLabelClass: "text-sky-800/80",
    chromeCtaClass: "border-sky-700/40 text-sky-900 hover:bg-sky-800/10",
  },
  fantasma: {
    id: "fantasma",
    badge: "Redirect",
    eyebrow: "Uso avançado: redireciona no primeiro gesto. Avalie as regras da rede antes de anunciar.",
    heroBg: "bg-gradient-to-b from-zinc-200 via-zinc-100 to-background dark:from-zinc-900 dark:via-zinc-950 dark:to-background",
    badgeClass: "bg-zinc-800 text-zinc-100",
    ctaSurface: "ink",
    chromeClass: "border-zinc-700/60 bg-zinc-950/95 text-zinc-100",
    chromeLabelClass: "text-zinc-400",
    chromeCtaClass: "border-zinc-400/50 text-zinc-100 hover:bg-zinc-100/10",
  },
  tsl: {
    id: "tsl",
    badge: "Carta de vendas",
    eyebrow: "Leitura longa: contexto, benefícios declarados e decisão consciente.",
    heroBg: "bg-gradient-to-b from-amber-50 via-orange-50/40 to-background dark:from-amber-950/35 dark:via-stone-950 dark:to-background",
    badgeClass: "bg-amber-900 text-amber-50",
    ctaSurface: "warm",
    chromeClass: "border-amber-200/70 bg-[#fffaf3]/95 text-amber-950",
    chromeLabelClass: "text-amber-900/75",
    chromeCtaClass: "border-amber-800/40 text-amber-950 hover:bg-amber-900/10",
  },
  dtc: {
    id: "dtc",
    badge: "Directo ao consumidor",
    eyebrow: "Vitrine clara: produto, proposta e passo seguinte no site do vendedor.",
    heroBg: "bg-gradient-to-b from-teal-50 via-emerald-50/30 to-background dark:from-teal-950/40 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-teal-800 text-teal-50",
    ctaSurface: "light",
    chromeClass: "border-teal-200/70 bg-teal-50/90 text-teal-950",
    chromeLabelClass: "text-teal-800/80",
    chromeCtaClass: "border-teal-700/40 text-teal-950 hover:bg-teal-800/10",
  },
  review: {
    id: "review",
    badge: "Análise",
    eyebrow: "Perspectiva editorial independente — não somos o fabricante nem o checkout.",
    heroBg: "bg-gradient-to-b from-indigo-50 via-slate-50 to-background dark:from-indigo-950/30 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-indigo-900 text-indigo-50",
    ctaSurface: "light",
    chromeClass: "border-indigo-200/70 bg-indigo-50/90 text-indigo-950",
    chromeLabelClass: "text-indigo-900/75",
    chromeCtaClass: "border-indigo-800/40 text-indigo-950 hover:bg-indigo-900/10",
  },
  desconto: {
    id: "desconto",
    badge: "Promoção",
    eyebrow: "Confirme preço e condições no site do vendedor — não inventamos descontos.",
    heroBg: "bg-gradient-to-b from-rose-50 via-orange-50/50 to-background dark:from-rose-950/35 dark:via-stone-950 dark:to-background",
    badgeClass: "bg-rose-800 text-rose-50",
    ctaSurface: "warm",
    chromeClass: "border-rose-200/70 bg-rose-50/95 text-rose-950",
    chromeLabelClass: "text-rose-900/80",
    chromeCtaClass: "border-rose-800/40 text-rose-950 hover:bg-rose-900/10",
  },
  vsl: {
    id: "vsl",
    badge: "Vídeo",
    eyebrow: "Foque no vídeo. Depois confirme a oferta e o preço no destino.",
    heroBg: "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground",
    badgeClass: "bg-amber-400 text-slate-950",
    ctaSurface: "dark",
    chromeClass: "border-white/10 bg-slate-950/95 text-slate-100",
    chromeLabelClass: "text-amber-300/90",
    chromeCtaClass: "border-amber-400/80 text-amber-200 hover:bg-amber-400/10",
  },
  vsl_tsl: {
    id: "vsl_tsl",
    badge: "Vídeo + carta",
    eyebrow: "Vídeo no topo e leitura complementar abaixo — decisão com contexto.",
    heroBg: "bg-gradient-to-b from-slate-950 via-slate-900/95 to-background text-foreground",
    badgeClass: "bg-amber-300 text-slate-950",
    ctaSurface: "dark",
    chromeClass: "border-white/10 bg-slate-950/95 text-slate-100",
    chromeLabelClass: "text-amber-200/90",
    chromeCtaClass: "border-amber-300/80 text-amber-100 hover:bg-amber-300/10",
  },
  sexo: {
    id: "sexo",
    badge: "Qualificação",
    eyebrow: "Resposta rápida antes do link da oferta — experiência alinhada ao público.",
    heroBg: "bg-gradient-to-b from-fuchsia-50 via-white to-background dark:from-fuchsia-950/25 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-fuchsia-900 text-fuchsia-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  idade: {
    id: "idade",
    badge: "Idade",
    eyebrow: "Confirmação de idade mínima antes de seguir para a oferta.",
    heroBg: "bg-gradient-to-b from-cyan-50 via-white to-background dark:from-cyan-950/30 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-cyan-900 text-cyan-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  idade_sexo: {
    id: "idade_sexo",
    badge: "Idade + perfil",
    eyebrow: "Dois passos de qualificação antes do destino da oferta.",
    heroBg: "bg-gradient-to-b from-violet-50/80 via-white to-background dark:from-violet-950/25 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-violet-950 text-violet-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  idade_pais: {
    id: "idade_pais",
    badge: "Idade + país",
    eyebrow: "Elegibilidade por idade e localização antes do checkout do vendedor.",
    heroBg: "bg-gradient-to-b from-lime-50 via-white to-background dark:from-lime-950/25 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-lime-900 text-lime-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  sexo_pais: {
    id: "sexo_pais",
    badge: "Perfil + país",
    eyebrow: "Segmentação simples antes de abrir a oferta no site do vendedor.",
    heroBg: "bg-gradient-to-b from-pink-50 via-white to-background dark:from-pink-950/25 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-pink-900 text-pink-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  grupo_homem: {
    id: "grupo_homem",
    badge: "Faixa etária",
    eyebrow: "Escolha a faixa etária para ver a oferta adequada.",
    heroBg: "bg-gradient-to-b from-blue-50 via-slate-50 to-background dark:from-blue-950/30 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-blue-950 text-blue-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  grupo_mulher: {
    id: "grupo_mulher",
    badge: "Faixa etária",
    eyebrow: "Escolha a faixa etária para ver a oferta adequada.",
    heroBg: "bg-gradient-to-b from-rose-50 via-fuchsia-50/40 to-background dark:from-rose-950/30 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-rose-950 text-rose-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  pais: {
    id: "pais",
    badge: "País",
    eyebrow: "Indique o país para ver a oferta no contexto certo (envio, moeda, idioma).",
    heroBg: "bg-gradient-to-b from-emerald-50 via-white to-background dark:from-emerald-950/30 dark:via-slate-950 dark:to-background",
    badgeClass: "bg-emerald-900 text-emerald-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  captcha: {
    id: "captcha",
    badge: "Verificação",
    eyebrow: "Confirme que é humano antes de abrir o link da oferta.",
    heroBg: "bg-gradient-to-b from-neutral-100 via-white to-background dark:from-neutral-900 dark:via-neutral-950 dark:to-background",
    badgeClass: "bg-neutral-900 text-neutral-50",
    ctaSurface: "ink",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  modelos: {
    id: "modelos",
    badge: "Opções",
    eyebrow: "Escolha a apresentação que prefere antes de continuar.",
    heroBg: "bg-gradient-to-b from-orange-50 via-amber-50/40 to-background dark:from-orange-950/30 dark:via-stone-950 dark:to-background",
    badgeClass: "bg-orange-900 text-orange-50",
    ctaSurface: "warm",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
  builder: {
    id: "builder",
    badge: "Página manual",
    eyebrow: "Layout personalizado no editor — mantenha conteúdo útil e transparente.",
    heroBg: DEFAULT.heroBg,
    badgeClass: "bg-stone-800 text-stone-50",
    ctaSurface: "light",
    chromeClass: DEFAULT.chromeClass,
    chromeLabelClass: DEFAULT.chromeLabelClass,
    chromeCtaClass: DEFAULT.chromeCtaClass,
  },
};

export function getPresellTypeTheme(type: string | undefined | null): PresellTypeTheme {
  if (!type) return DEFAULT;
  return THEMES[type] || DEFAULT;
}

/** Blocos editoriais curtos (valor próprio) — sem inventar factos do produto. */
export function getPresellTypeEditorial(
  type: string,
  lang: string,
): { title: string; points: string[] } | null {
  const pt = (lang || "").toLowerCase().startsWith("pt");
  const catalog: Record<string, { title: string; points: string[] }> = pt
    ? {
        tsl: {
          title: "Como usar esta página",
          points: [
            "Leia a proposta e confirme se o produto se adequa ao seu objetivo.",
            "Preço, envio e garantia ficam no site do vendedor após o clique.",
            "Somos uma página independente; podemos receber comissão pelo link.",
          ],
        },
        dtc: {
          title: "Decisão rápida e transparente",
          points: [
            "Veja imagens e nome do produto extraídos da oferta.",
            "O botão leva ao checkout do comerciante — não processamos pagamentos aqui.",
            "Compare condições no destino antes de concluir a compra.",
          ],
        },
        review: {
          title: "Análise independente",
          points: [
            "Esta página não é o site oficial da marca.",
            "Use o conteúdo para formar opinião; verifique sempre a fonte no vendedor.",
            "Avaliações só aparecem quando vieram da origem — não inventamos notas.",
          ],
        },
        desconto: {
          title: "Sobre a promoção",
          points: [
            "Só mostramos descontos que estavam escritos na origem.",
            "Confirme validade e preço final no site do vendedor.",
            "Urgência visual não altera os termos reais da oferta.",
          ],
        },
        vsl: {
          title: "Vídeo de vendas",
          points: [
            "Assista e depois confirme a oferta no destino.",
            "Não substituímos o vídeo por claims médicos ou resultados garantidos.",
            "Transparência: página afiliada / independente.",
          ],
        },
        vsl_tsl: {
          title: "Vídeo + leitura",
          points: [
            "O vídeo resume; a carta abaixo aprofunda o contexto.",
            "Decida com calma e verifique condições no comerciante.",
            "Não somos o fabricante nem o processador de pagamento.",
          ],
        },
        cookies: {
          title: "Privacidade primeiro",
          points: [
            "Pode rever a política de cookies e privacidade a qualquer momento.",
            "Continuar implica consentimento conforme o texto apresentado.",
          ],
        },
      }
    : {
        tsl: {
          title: "How to use this page",
          points: [
            "Read the offer and decide if it matches your goal.",
            "Price, shipping and guarantees are confirmed on the merchant site.",
            "This is an independent page; we may earn a commission via the link.",
          ],
        },
        dtc: {
          title: "Clear next step",
          points: [
            "Product name and images come from the offer source.",
            "The button opens the merchant checkout — we do not process payments.",
            "Check final terms on the destination before buying.",
          ],
        },
        review: {
          title: "Independent review framing",
          points: [
            "This is not the brand’s official website.",
            "Use the content to decide; verify details with the seller.",
            "Ratings appear only when present in the source — we don’t invent scores.",
          ],
        },
        desconto: {
          title: "About the promotion",
          points: [
            "We only surface discounts that were written on the source page.",
            "Confirm price and validity on the merchant site.",
            "Urgency UI does not change the real offer terms.",
          ],
        },
        vsl: {
          title: "Video sales letter",
          points: [
            "Watch first, then confirm the offer on the destination.",
            "We don’t replace the video with medical or guaranteed-result claims.",
            "Affiliate / independent page disclosure applies.",
          ],
        },
        vsl_tsl: {
          title: "Video + long copy",
          points: [
            "Video for overview; text below for context.",
            "Verify conditions with the merchant before purchase.",
            "We are not the manufacturer or payment processor.",
          ],
        },
        cookies: {
          title: "Privacy first",
          points: [
            "You can review cookie and privacy policies anytime.",
            "Continuing implies consent as stated in the notice.",
          ],
        },
      };

  if (catalog[type]) return catalog[type];
  if (
    ["sexo", "idade", "idade_sexo", "idade_pais", "sexo_pais", "grupo_homem", "grupo_mulher", "pais", "captcha", "modelos"].includes(
      type,
    )
  ) {
    return pt
      ? {
          title: "Antes do link da oferta",
          points: [
            "Pedimos só o necessário para qualificar a experiência.",
            "Depois seguirá para o site do vendedor para preço e pagamento.",
            "Página independente — podemos receber comissão pelo link.",
          ],
        }
      : {
          title: "Before the offer link",
          points: [
            "We only ask what’s needed to qualify the experience.",
            "You’ll continue to the merchant for price and payment.",
            "Independent page — we may earn a commission via the link.",
          ],
        };
  }
  return null;
}
