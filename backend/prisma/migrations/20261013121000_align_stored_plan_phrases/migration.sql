-- Substitui frases comerciais já gravadas que prometem números ou comportamentos diferentes
-- dos campos do plano. Não altera preços, limites, assinaturas nem domínios.

UPDATE "plans"
SET "features" = replace("features"::text,
  'Até 3 presell pages · 1.000 cliques/mês (trial)',
  'Páginas e cliques deste plano são os números do cartão. Ao passar a quota de cliques, o anúncio continua.'
)::jsonb
WHERE "features"::text LIKE '%1.000 cliques%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Postback de afiliados: upgrade para Pro Mensal ou Pro Anual',
  'O aviso de vendas da rede segue o interruptor deste plano.'
)::jsonb
WHERE "features"::text LIKE '%upgrade para Pro Mensal ou Pro Anual%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Até 25 presell pages · 50.000 cliques/mês',
  'Páginas e cliques deste plano são os números do cartão. Ao passar a quota de cliques, o anúncio continua.'
)::jsonb
WHERE "features"::text LIKE '%50.000 cliques%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Todos os tipos de presell no editor · Sem branding dclickora no rodapé',
  'Todos os tipos de presell no editor. Retirar a marca depende do interruptor deste plano.'
)::jsonb
WHERE "features"::text LIKE '%Sem branding dclickora no rodapé%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Domínio personalizado: use Pro Anual (até 2) ou export HTML no Mensal',
  'Os domínios próprios são o número deste cartão.'
)::jsonb
WHERE "features"::text LIKE '%use Pro Anual (até 2)%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Presells e cliques com quotas amplas (uso razoável) durante o ano',
  'Páginas e cliques seguem os campos deste plano. Vazio significa sem máximo numérico. Ao passar uma quota de cliques, o anúncio continua.'
)::jsonb
WHERE "features"::text LIKE '%quotas amplas%';

UPDATE "plans"
SET "features" = replace("features"::text,
  'Até 2 domínios personalizados · Sem branding dclickora no rodapé',
  'Os domínios próprios são o número deste cartão. Retirar a marca depende do interruptor deste plano.'
)::jsonb
WHERE "features"::text LIKE '%Até 2 domínios personalizados%';

UPDATE "plans_landing_config"
SET "plan_display_labels" = replace("plan_display_labels"::text, 'Sem marca Clickora', 'Pode retirar a marca')::jsonb
WHERE "plan_display_labels"::text LIKE '%Sem marca Clickora%';

UPDATE "plans_landing_config"
SET "landing_extras" = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace("landing_extras"::text,
              'Compare presells, cliques e o que cada plano inclui. Os números são os limites da conta, não uma previsão de vendas. O plano grátis não pede cartão nesta página.',
              'Compare o que cada plano inclui. O número de páginas é o máximo que a conta deixa criar. O número de cliques é a quota do mês no painel: o anúncio não é cortado ao passar essa quota. O plano grátis não pede cartão nesta página.'
            ),
            'A venda entra quando a rede a confirma.',
            'A venda entra nos planos que recebem o aviso da rede.'
          ),
          'Onde vale a pena gastar',
          'Campanha e venda juntas'
        ),
        'A campanha e a palavra-chave ficam ao lado da venda confirmada. Vê o que trouxe resultado e o que só gastou. A decisão de aumentar o orçamento é sua, com os dados juntos.',
        'A campanha e a palavra-chave ficam ao lado da venda confirmada, nos planos que recebem o aviso da rede. O custo do anúncio só entra quando o Google aceita a leitura. A decisão de aumentar o orçamento é sua.'
      ),
      'Nos planos pagos, o botão Compra abre o checkout Hotmart (se HOTMART_PRODUCT_URL ou HOTMART_PLAN_CHECKOUT_URLS estiver configurado no servidor). Após pagamento aprovado, o webhook Hotmart activa a assinatura — use o mesmo e-mail na Hotmart e na Clickora. Se o link não estiver configurado, verá um aviso em vez do redirect.',
      'Nos planos pagos, o botão abre o checkout da Hotmart. Depois do pagamento aprovado, a assinatura ativa se o e-mail da compra for o da conta. O preço escrito no cartão não é o valor que a Hotmart cobra: esse é o da oferta no checkout.'
    ),
    'Inclui o postback: a venda entra no painel quando a rede a confirma.',
    'O aviso de vendas e os anúncios seguem os interruptores de cada cartão.'
  ),
  'Para usar o ano inteiro, com domínio próprio.',
  'Para o ano inteiro. Domínios e anúncios seguem os números e os interruptores deste cartão.'
)::jsonb
WHERE "landing_extras" IS NOT NULL
  AND (
    "landing_extras"::text LIKE '%Os números são os limites da conta%'
    OR "landing_extras"::text LIKE '%HOTMART_PRODUCT_URL%'
    OR "landing_extras"::text LIKE '%o que só gastou%'
    OR "landing_extras"::text LIKE '%Inclui o postback%'
    OR "landing_extras"::text LIKE '%com domínio próprio.%'
    OR "landing_extras"::text LIKE '%A venda entra quando a rede a confirma.%'
    OR "landing_extras"::text LIKE '%Onde vale a pena gastar%'
    OR "landing_extras"::text LIKE '%precisa de registar as vendas%'
  );

UPDATE "plans_landing_config"
SET "landing_extras" = replace(
  "landing_extras"::text,
  'Para quem já anuncia e precisa de registar as vendas.',
  'Para quem já anuncia. O aviso de vendas segue o interruptor deste cartão.'
)::jsonb
WHERE "landing_extras"::text LIKE '%precisa de registar as vendas%';
