/**
 * One-shot: append identical keys to allowed page namespaces in en/pt/pt-BR/es.
 * Safe to re-run: skips a namespace if the first new key is already present.
 */
import fs from "node:fs";

const root = new URL("../src/i18n/messages/", import.meta.url);

/** @type {Record<string, Record<string, Record<string, string>>>} */
const add = {
  en: {},
  pt: {},
  "pt-BR": {},
  es: {},
};

function put(ns, key, en, pt, ptBR, es) {
  for (const [loc, val] of [
    ["en", en],
    ["pt", pt],
    ["pt-BR", ptBR],
    ["es", es],
  ]) {
    add[loc][ns] ??= {};
    add[loc][ns][key] = val;
  }
}

const P = (en, pt, ptBR = pt, es) => [en, pt, ptBR, es];

const rows = {
  common: [
    ["loadFailed", ...P("Could not load data.", "Não foi possível carregar os dados.", "Não foi possível carregar os dados.", "No se pudieron cargar los datos.")],
    ["emptyTitle", ...P("No data found", "Nenhum dado encontrado", "Nenhum dado encontrado", "No hay datos")],
    ["emptyHint", ...P("Start by creating your first item.", "Comece por criar o primeiro item.", "Comece criando seu primeiro item.", "Empieza creando tu primer elemento.")],
  ],
  "pages.rotators": [
    ["toastPresetAb", ...P("A/B 50/50 preset — fill in the page URLs.", "Preset A/B 50/50 — preencha os URLs das páginas.", "Preset A/B 50/50 — preencha as URLs das páginas.", "Preset A/B 50/50 — rellena las URLs de las páginas.")],
    ["toastPresetWa", ...P("Sequential WhatsApp preset — complete the wa.me/… numbers.", "Preset WhatsApp sequencial — complete os números wa.me/…", "Preset WhatsApp sequencial — complete os números wa.me/…", "Preset de WhatsApp secuencial — completa los números wa.me/…")],
    ["toastPresetOffer", ...P("Affiliate offers preset — paste the hoplinks.", "Preset ofertas afiliado — cole os hoplinks.", "Preset ofertas afiliado — cole os hoplinks.", "Preset de ofertas de afiliado — pega los hoplinks.")],
    ["toastDclickoraPath", ...P("On dclickora.com use the presell /p/<UUID> (not the slug). Copy the public link in the page editor.", "Em dclickora.com use /p/<UUID> da presell (não o slug). Copie o link público no editor da página.", "No dclickora.com use /p/<UUID> da presell (não o slug). Copie o link público no editor da página.", "En dclickora.com usa /p/<UUID> de la presell (no el slug). Copia el enlace público en el editor de la página.")],
    ["toastRulesInvalid", ...P("Invalid format in advanced rules.", "Formato inválido nas regras avançadas.", "Formato inválido nas regras avançadas.", "Formato no válido en las reglas avanzadas.")],
    ["toastPolicyInvalid", ...P('Invalid policy — use { "version": 1, "rules": [...] }. Fix the JSON or stay in advanced mode.', 'Política inválida — use { "version": 1, "rules": [...] }. Corrija o JSON ou continue no modo avançado.', 'Política inválida — use { "version": 1, "rules": [...] }. Corrija o JSON ou continue no modo avançado.', 'Política no válida — usa { "version": 1, "rules": [...] }. Corrige el JSON o sigue en modo avanzado.')],
    ["toastRulesVisual", ...P("Invalid format — fix it before returning to the visual editor.", "Formato inválido — corrija antes de voltar ao editor visual.", "Formato inválido — corrija antes de voltar ao editor visual.", "Formato no válido — corrígelo antes de volver al editor visual.")],
    ["toastPublicUrl", ...P("Public URL /p/<uuid> inserted.", "URL público /p/<uuid> inserido.", "URL público /p/<uuid> inserido.", "URL pública /p/<uuid> insertada.")],
    ["toastRuleRedirect", ...P("A redirect rule needs a valid https URL.", "Regra com redirect precisa de URL https válida.", "Regra com redirect precisa de URL https válida.", "Una regla con redirección necesita una URL https válida.")],
    ["toastRulesFix", ...P("Invalid rules — fix or remove them before saving.", "Regras inválidas — corrija ou remova-as antes de guardar.", "Regras inválidas — corrija ou remova-as antes de salvar.", "Reglas no válidas — corrígelas o elimínalas antes de guardar.")],
    ["toastEmptyResponse", ...P("Empty response.", "Resposta vazia.", "Resposta vazia.", "Respuesta vacía.")],
  ],
  "pages.campaignDetail": [
    ["activated", ...P("Campaign active", "Campanha activa", "Campanha ativa", "Campaña activa")],
    ["spendUpdated", ...P("Spend updated", "Gasto actualizado", "Gasto atualizado", "Gasto actualizado")],
    ["needPresell", ...P("Attach a published presell to copy the link.", "Associe uma presell publicada para copiar o link.", "Associe uma presell publicada para copiar o link.", "Asocia una presell publicada para copiar el enlace.")],
    ["linkCopied", ...P("Link copied", "Link copiado", "Link copiado", "Enlace copiado")],
    ["spendInvalid", ...P("Invalid spend", "Gasto inválido", "Gasto inválido", "Gasto no válido")],
    ["subtitleStats", ...P("{source}{country} · stats by utm_campaign slug", "{source}{country} · stats por slug utm_campaign", "{source}{country} · stats por slug utm_campaign", "{source}{country} · stats por slug utm_campaign")],
    ["allCampaigns", ...P("All campaigns", "Todas as campanhas", "Todas as campanhas", "Todas las campañas")],
    ["activate", ...P("Activate", "Activar", "Ativar", "Activar")],
    ["copyAdLink", ...P("Copy ad link", "Copiar link anúncio", "Copiar link do anúncio", "Copiar enlace del anuncio")],
    ["manualSpend", ...P("Manual spend", "Gasto manual", "Gasto manual", "Gasto manual")],
    ["manualSpendHint", ...P("Lifetime / record — outside account ROAS", "Lifetime / ficha — fora do ROAS de conta", "Lifetime / ficha — fora do ROAS da conta", "Acumulado / ficha — fuera del ROAS de la cuenta")],
    ["periodProfit", ...P("Profit (period)", "Lucro (período)", "Lucro (período)", "Beneficio (período)")],
    ["periodProfitHint", ...P("Needs synced cost per campaign", "Requer custo sync por campanha", "Requer custo sincronizado por campanha", "Requiere coste sincronizado por campaña")],
    ["roasHint", ...P("Only with sync; manual spend is excluded", "Só com sync; manual não entra", "Só com sync; manual não entra", "Solo con sincronización; el gasto manual no entra")],
    ["tabOps", ...P("Operations", "Operação", "Operação", "Operación")],
    ["tabPresell", ...P("Presell", "Presell", "Presell", "Presell")],
    ["tabTracking", ...P("Tracking", "Rastreio", "Rastreamento", "Seguimiento")],
    ["adLink", ...P("Ad link", "Link do anúncio", "Link do anúncio", "Enlace del anuncio")],
    ["adLinkDesc", ...P("Public presell + campaign UTMs.", "Presell pública + UTMs da campanha.", "Presell pública + UTMs da campanha.", "Presell pública + UTMs de la campaña.")],
    ["offer", ...P("Offer:", "Oferta:", "Oferta:", "Oferta:")],
    ["noOfferUrl", ...P("No offer URL on this record.", "Sem URL de oferta na ficha.", "Sem URL de oferta na ficha.", "Sin URL de oferta en la ficha.")],
    ["needPublished", ...P("Attach a published presell to generate the tracked link.", "Associe uma presell publicada para gerar o link rastreável.", "Associe uma presell publicada para gerar o link rastreável.", "Asocia una presell publicada para generar el enlace rastreado.")],
    ["manualSpendTitle", ...P("Manual spend", "Gasto manual", "Gasto manual", "Gasto manual")],
    ["manualSpendDesc", ...P("Running total on the record — it does not enter period profit/ROAS. Account results use only synced cost (Google Ads).", "Valor acumulado na ficha — não entra no lucro/ROAS do período. Os resultados da conta usam só custo sincronizado (Google Ads).", "Valor acumulado na ficha — não entra no lucro/ROAS do período. Os resultados da conta usam só custo sincronizado (Google Ads).", "Total acumulado en la ficha — no entra en el beneficio/ROAS del período. Los resultados de la cuenta usan solo el coste sincronizado (Google Ads).")],
    ["preferSync", ...P("Prefer sync in", "Preferível: sync em", "Preferível: sync em", "Mejor: sincronizar en")],
    ["andRead", ...P("and reading in", "e leitura em", "e leitura em", "y la lectura en")],
    ["published", ...P("Published", "Publicada", "Publicada", "Publicada")],
    ["draft", ...P("Draft", "Rascunho", "Rascunho", "Borrador")],
    ["paused", ...P("Paused", "Pausada", "Pausada", "Pausada")],
    ["managePresells", ...P("Manage presells", "Gerir Presells", "Gerenciar Presells", "Gestionar presells")],
    ["openPublic", ...P("Open public", "Abrir pública", "Abrir pública", "Abrir pública")],
    ["noPresell", ...P("No presell linked yet.", "Ainda sem presell ligada.", "Ainda sem presell ligada.", "Todavía sin presell vinculada.")],
    ["pipeline", ...P("Pipeline", "Pipeline", "Pipeline", "Pipeline")],
    ["pipelineDesc", ...P("Click → redirect → postback → conversion.", "Clique → redirect → postback → conversão.", "Clique → redirect → postback → conversão.", "Clic → redirección → postback → conversión.")],
    ["rowStatus", ...P("Status", "Estado", "Estado", "Estado")],
    ["rowStatusValue", ...P("Active (automatic on click)", "Activo (automático no clique)", "Ativo (automático no clique)", "Activo (automático en el clic)")],
    ["rowParams", ...P("Ad parameters", "Parâmetros do anúncio", "Parâmetros do anúncio", "Parámetros del anuncio")],
    ["rowParamsValue", ...P("Applied when the link is copied", "Aplicados ao copiar o link", "Aplicados ao copiar o link", "Se aplican al copiar el enlace")],
    ["rowClickId", ...P("Click ID", "Click ID", "Click ID", "Click ID")],
    ["rowClickIdValue", ...P("Inserted on the redirect to the offer", "Inserido no redirect para a oferta", "Inserido no redirect para a oferta", "Insertado en la redirección a la oferta")],
    ["rowNetwork", ...P("Network sales", "Vendas da rede", "Vendas da rede", "Ventas de la red")],
    ["rowNetworkValue", ...P("Via Integrations → Postback", "Via Integrações → Postback", "Via Integrações → Postback", "Vía Integraciones → Postback")],
    ["urlBuilder", ...P("URL builder", "Construtor de URL", "Construtor de URL", "Constructor de URL")],
    ["advanced", ...P("Advanced", "Avançado", "Avançado", "Avanzado")],
    ["integrationsHub", ...P("Integrations hub", "Hub integrações", "Hub de integrações", "Hub de integraciones")],
    ["diagnostics", ...P("Diagnostics", "Diagnóstico", "Diagnóstico", "Diagnóstico")],
  ],
  "pages.googleAds": [
    ["loading", ...P("Loading Google Ads…", "A carregar Google Ads…", "Carregando Google Ads…", "Cargando Google Ads…")],
    ["oauthReady", ...P("Account connected. Approved sales now go to Google.", "Conta ligada. As vendas aprovadas passam a seguir para o Google.", "Conta conectada. As vendas aprovadas passam a ir para o Google.", "Cuenta conectada. Las ventas aprobadas ya se envían a Google.")],
    ["oauthPartialFallback", ...P("Google authorized. Choose the account below.", "Google autorizado. Escolha a conta abaixo.", "Google autorizado. Escolha a conta abaixo.", "Google autorizado. Elige la cuenta abajo.")],
    ["oauthBootFail", ...P("Google authorized, but setup failed. Use «Refresh connection» or enter the account number.", "Google autorizado, mas a preparação falhou. Use «Actualizar ligação» ou indique o número da conta.", "Google autorizado, mas a preparação falhou. Use «Atualizar conexão» ou informe o número da conta.", "Google autorizado, pero la preparación falló. Usa «Actualizar conexión» o indica el número de cuenta.")],
    ["oauthConfirming", ...P("Google authorized. Confirming the account…", "Google autorizado. A confirmar a conta…", "Google autorizado. Confirmando a conta…", "Google autorizado. Confirmando la cuenta…")],
    ["oauthNoRefresh", ...P("Google did not return a lasting authorization. Choose the account again and accept access.", "O Google não devolveu a autorização permanente. Volte a escolher a conta e aceite o acesso.", "O Google não devolveu a autorização permanente. Escolha a conta de novo e aceite o acesso.", "Google no devolvió la autorización permanente. Vuelve a elegir la cuenta y acepta el acceso.")],
    ["oauthFail", ...P("Could not connect Google Ads", "Não foi possível ligar o Google Ads", "Não foi possível conectar o Google Ads", "No se pudo conectar Google Ads")],
    ["oauthOpenFail", ...P("Could not open the Google page.", "Não foi possível abrir a página do Google.", "Não foi possível abrir a página do Google.", "No se pudo abrir la página de Google.")],
    ["bootstrapIncomplete", ...P("The connection stayed incomplete", "A ligação ficou incompleta", "A conexão ficou incompleta", "La conexión quedó incompleta")],
    ["saved", ...P("Account saved.", "Conta guardada.", "Conta salva.", "Cuenta guardada.")],
    ["service", ...P("Service", "Serviço", "Serviço", "Servicio")],
    ["googleAccount", ...P("Google account", "Conta Google", "Conta Google", "Cuenta de Google")],
    ["costs", ...P("Costs", "Custos", "Custos", "Costes")],
    ["sales", ...P("Sales", "Vendas", "Vendas", "Ventas")],
    ["back", ...P("Back", "Voltar", "Voltar", "Volver")],
    ["unavailableTitle", ...P("Google connection unavailable", "Ligação ao Google indisponível", "Conexão com o Google indisponível", "Conexión con Google no disponible")],
    ["unavailableDetail", ...P("This account cannot talk to Google Ads yet. Contact support.", "Esta conta ainda não consegue falar com o Google Ads. Contacte o suporte.", "Esta conta ainda não consegue falar com o Google Ads. Fale com o suporte.", "Esta cuenta todavía no puede hablar con Google Ads. Contacta con soporte.")],
    ["connectTitle", ...P("Connect the account", "Ligar a conta", "Conectar a conta", "Conectar la cuenta")],
    ["connectDesc", ...P("Authorizes dclickora to read ad cost and send approved sales. You do not need to create anything by hand in Google Ads.", "Autoriza a dclickora a ler o custo dos anúncios e a enviar as vendas aprovadas. Não precisa de criar nada à mão no Google Ads.", "Autoriza a dclickora a ler o custo dos anúncios e a enviar as vendas aprovadas. Não precisa criar nada à mão no Google Ads.", "Autoriza a dclickora a leer el coste de los anuncios y a enviar las ventas aprobadas. No hace falta crear nada a mano en Google Ads.")],
    ["step1", ...P("Click «Connect Google Ads», choose the account that holds the ads and accept access.", "Clique em «Ligar Google Ads», escolha a conta onde estão os anúncios e aceite o acesso.", "Clique em «Conectar Google Ads», escolha a conta onde estão os anúncios e aceite o acesso.", "Haz clic en «Conectar Google Ads», elige la cuenta de los anuncios y acepta el acceso.")],
    ["step2", ...P("dclickora stores that account and starts sending approved sales.", "A dclickora guarda essa conta e passa a enviar as vendas aprovadas.", "A dclickora guarda essa conta e passa a enviar as vendas aprovadas.", "dclickora guarda esa cuenta y empieza a enviar las ventas aprobadas.")],
    ["step3", ...P("Cost, when Google allows it to be read, shows up in Results.", "O custo, quando o Google o deixar ler, aparece em Resultados.", "O custo, quando o Google o deixar ler, aparece em Resultados.", "El coste, cuando Google permita leerlo, aparece en Resultados.")],
    ["linked", ...P("Account connected", "Conta ligada", "Conta conectada", "Cuenta conectada")],
    ["connect", ...P("Connect Google Ads", "Ligar Google Ads", "Conectar Google Ads", "Conectar Google Ads")],
    ["switchAccount", ...P("Switch account", "Trocar conta", "Trocar conta", "Cambiar cuenta")],
    ["refreshLink", ...P("Refresh connection", "Actualizar ligação", "Atualizar conexão", "Actualizar conexión")],
    ["salesReady", ...P("Sales ready to send", "Vendas prontas a enviar", "Vendas prontas para enviar", "Ventas listas para enviar")],
    ["salesReadyBody", ...P("Account {id}. {manager} Cost in Results only appears if Google accepts reading this account.", "Conta {id}. {manager} O custo em Resultados só aparece se o Google aceitar a leitura desta conta.", "Conta {id}. {manager} O custo em Resultados só aparece se o Google aceitar a leitura desta conta.", "Cuenta {id}. {manager} El coste en Resultados solo aparece si Google acepta leer esta cuenta.")],
    ["managerSet", ...P("Manager account {id}.", "Conta gestora {id}.", "Conta gestora {id}.", "Cuenta gestora {id}.")],
    ["managerMissing", ...P("Manager account not set.", "Conta gestora não indicada.", "Conta gestora não informada.", "Cuenta gestora no indicada.")],
    ["autoTagging", ...P("For sales to show in Google Ads: turn on auto-tagging on the account, paste the URL generated by Clickora (campaign / URL builder) as the Final URL, and do not add gclid=… by hand — Google injects the real ID on the click.", "Para as vendas reflectirem no Google Ads: active a codificação automática na conta, cole a URL gerada pela Clickora (campanha / URL Builder) como Final URL, e não acrescente gclid=… à mão — o Google injeta o ID real no clique.", "Para as vendas refletirem no Google Ads: ative a codificação automática na conta, cole a URL gerada pela Clickora (campanha / URL Builder) como Final URL, e não acrescente gclid=… à mão — o Google injeta o ID real no clique.", "Para que las ventas se reflejen en Google Ads: activa el etiquetado automático en la cuenta, pega la URL generada por Clickora (campaña / constructor de URL) como URL final y no añadas gclid=… a mano — Google inyecta el ID real en el clic.")],
    ["apiErrorHint", ...P("If Reports shows «API error» on the Google send, click Switch account / connect again once — Google requires the new Data Manager access for offline conversions.", "Se Relatórios mostrar «Erro API» no envio Google, clique em Trocar conta / volte a ligar uma vez — o Google exige o novo acesso Data Manager para conversões offline.", "Se Relatórios mostrar «Erro API» no envio Google, clique em Trocar conta / conecte de novo uma vez — o Google exige o novo acesso Data Manager para conversões offline.", "Si Informes muestra «Error API» en el envío a Google, pulsa Cambiar cuenta / vuelve a conectar una vez — Google exige el nuevo acceso Data Manager para conversiones offline.")],
    ["statusTitle", ...P("Status", "Estado", "Estado", "Estado")],
    ["statusDesc", ...P("What is already automatic on this account.", "O que já está automático nesta conta.", "O que já está automático nesta conta.", "Lo que ya es automático en esta cuenta.")],
    ["rowAccount", ...P("Google account", "Conta Google", "Conta Google", "Cuenta de Google")],
    ["stateLinked", ...P("Connected", "Ligada", "Conectada", "Conectada")],
    ["statePending", ...P("Not connected", "Por ligar", "Por conectar", "Por conectar")],
    ["rowCustomer", ...P("Account number", "Número da conta", "Número da conta", "Número de cuenta")],
    ["rowManager", ...P("Manager account", "Conta gestora", "Conta gestora", "Cuenta gestora")],
    ["notSet", ...P("Not set", "Não indicada", "Não informada", "No indicada")],
    ["rowUpload", ...P("Sale upload", "Envio das vendas", "Envio das vendas", "Envío de ventas")],
    ["on", ...P("On", "Activo", "Ativo", "Activo")],
    ["off", ...P("Off", "Desligado", "Desligado", "Apagado")],
    ["readyYes", ...P("Yes", "Sim", "Sim", "Sí")],
    ["readyNo", ...P("Not yet", "Ainda não", "Ainda não", "Todavía no")],
    ["readyLabel", ...P("Ready to send", "Pronto a enviar", "Pronto para enviar", "Listo para enviar")],
    ["updateCosts", ...P("Update costs", "Actualizar custos", "Atualizar custos", "Actualizar costes")],
    ["results", ...P("Results", "Resultados", "Resultados", "Resultados")],
    ["manualTitle", ...P("Enter the account by hand", "Indicar a conta à mão", "Informar a conta manualmente", "Indicar la cuenta a mano")],
    ["manualDescHas", ...P("The ads account is already saved. If Google refuses cost, enter the number of the account that manages the others.", "A conta de anúncios já está guardada. Se o Google recusar o custo, indique o número da conta que gere as outras.", "A conta de anúncios já está salva. Se o Google recusar o custo, informe o número da conta que gerencia as outras.", "La cuenta de anuncios ya está guardada. Si Google rechaza el coste, indica el número de la cuenta que gestiona las demás.")],
    ["manualDescMissing", ...P("Paste the 10 digits of the account that holds the ads. If that account is managed by another, also enter the manager account number.", "Cole os 10 dígitos da conta onde estão os anúncios. Se essa conta for gerida por outra, indique também o número da conta gestora.", "Cole os 10 dígitos da conta onde estão os anúncios. Se essa conta for gerenciada por outra, informe também o número da conta gestora.", "Pega los 10 dígitos de la cuenta de los anuncios. Si esa cuenta la gestiona otra, indica también el número de la cuenta gestora.")],
    ["customerLabel", ...P("Account number", "Número da conta", "Número da conta", "Número de cuenta")],
    ["managerLabel", ...P("Manager account (optional)", "Conta gestora (opcional)", "Conta gestora (opcional)", "Cuenta gestora (opcional)")],
    ["managerPlaceholder", ...P("Only if you have an account that manages the others", "Só se tiver uma conta que gere as outras", "Só se tiver uma conta que gerencia as outras", "Solo si tienes una cuenta que gestiona las demás")],
  ],
  "pages.pixels": [
    ["loading", ...P("Loading pixels / CAPI…", "A carregar pixels / CAPI…", "Carregando pixels / CAPI…", "Cargando píxeles / CAPI…")],
    ["back", ...P("Back", "Voltar", "Voltar", "Volver")],
    ["minTitle", ...P("Minimum setup", "Configuração mínima", "Configuração mínima", "Configuración mínima")],
    ["minDetail", ...P("Save Pixel ID + token once. PageView is added on published landers and Purchase is sent to the network after the postback (fbclid/ttclid on the ad URL).", "Guarde Pixel ID + token uma vez. O PageView entra sozinho nas landers publicadas e o Purchase segue para a rede após o postback (fbclid/ttclid no URL do anúncio).", "Salve Pixel ID + token uma vez. O PageView entra sozinho nas landers publicadas e o Purchase segue para a rede após o postback (fbclid/ttclid no URL do anúncio).", "Guarda Pixel ID + token una vez. El PageView entra solo en las landers publicadas y el Purchase se envía a la red tras el postback (fbclid/ttclid en la URL del anuncio).")],
    ["metaReady", ...P("Meta CAPI ready to send.", "Meta CAPI pronta a enviar.", "Meta CAPI pronta para enviar.", "Meta CAPI lista para enviar.")],
    ["metaSaved", ...P("Meta settings saved.", "Definições Meta guardadas.", "Definições Meta salvas.", "Ajustes de Meta guardados.")],
    ["metaFail", ...P("Could not save Meta CAPI", "Falha ao guardar Meta CAPI", "Falha ao salvar Meta CAPI", "No se pudo guardar Meta CAPI")],
    ["ttReady", ...P("TikTok Events ready to send.", "TikTok Events pronto a enviar.", "TikTok Events pronto para enviar.", "TikTok Events listo para enviar.")],
    ["ttSaved", ...P("TikTok settings saved.", "Definições TikTok guardadas.", "Definições TikTok salvas.", "Ajustes de TikTok guardados.")],
    ["ttFail", ...P("Could not save TikTok Events", "Falha ao guardar TikTok Events", "Falha ao salvar TikTok Events", "No se pudo guardar TikTok Events")],
  ],
  "pages.automizer": [
    ["loading", ...P("Loading automatic costs…", "A carregar custos automáticos…", "Carregando custos automáticos…", "Cargando costes automáticos…")],
    ["stale", ...P("Costs out of date (>48h)", "Custos desactualizados (>48h)", "Custos desatualizados (>48h)", "Costes desactualizados (>48h)")],
    ["noPeriodCost", ...P("No period cost yet", "Ainda sem custo do período", "Ainda sem custo do período", "Todavía sin coste del período")],
    ["lastSync", ...P("Last sync: {when}. ", "Última sync: {when}. ", "Última sync: {when}. ", "Última sync: {when}. ")],
    ["refreshForRoas", ...P("Update costs now so period ROAS is correct.", "Actualize custos agora para o ROAS do período ficar correcto.", "Atualize os custos agora para o ROAS do período ficar correto.", "Actualiza los costes ahora para que el ROAS del período sea correcto.")],
    ["connectGoogle", ...P("Connect Google Ads in Integrations to sync costs.", "Ligue o Google Ads em Integrações para sincronizar custos.", "Conecte o Google Ads em Integrações para sincronizar custos.", "Conecta Google Ads en Integraciones para sincronizar costes.")],
    ["realMode", ...P("Live mode on", "Modo real activo", "Modo real ativo", "Modo real activo")],
    ["realModeDetail", ...P("Simulation is off — «Apply pauses now» really pauses keywords in Google Ads.", "A simulação está desligada — «Aplicar pausas agora» pausa keywords de verdade no Google Ads.", "A simulação está desligada — «Aplicar pausas agora» pausa palavras-chave de verdade no Google Ads.", "La simulación está apagada — «Aplicar pausas ahora» pausa palabras clave de verdad en Google Ads.")],
    ["rule", ...P("Rule: spend above the limit, visits above the minimum and no sale. The keyword is paused in Google Ads.", "Regra: gasto acima do limite, visitas acima do mínimo e nenhuma venda. A palavra-chave fica em pausa no Google Ads.", "Regra: gasto acima do limite, visitas acima do mínimo e nenhuma venda. A palavra-chave fica em pausa no Google Ads.", "Regla: gasto por encima del límite, visitas por encima del mínimo y ninguna venta. La palabra clave se pausa en Google Ads.")],
    ["startSim", ...P("Start in simulation (it only records what it would pause). Then turn simulation off.", "Comece em simulação (só regista o que pausaria). Depois desligue a simulação.", "Comece em simulação (só registra o que pausaria). Depois desligue a simulação.", "Empieza en simulación (solo registra lo que pausaría). Luego apaga la simulación.")],
    ["costsOk", ...P("Costs OK · last sync", "Custos OK · última sync", "Custos OK · última sync", "Costes OK · última sync")],
    ["enablePause", ...P("Enable automatic pause", "Activar pausa automática", "Ativar pausa automática", "Activar pausa automática")],
    ["simulation", ...P("Simulation (recommended)", "Simulação (recomendado)", "Simulação (recomendado)", "Simulación (recomendado)")],
    ["simulationHint", ...P("Does not really pause — only writes to the log.", "Não pausa de verdade — só escreve no registo.", "Não pausa de verdade — só escreve no registro.", "No pausa de verdad — solo escribe en el registro.")],
    ["minSpend", ...P("Min. spend", "Gasto mín.", "Gasto mín.", "Gasto mín.")],
    ["minSpendHint", ...P("Google Ads account currency (does not force USD).", "Moeda da conta Google Ads (não força USD).", "Moeda da conta Google Ads (não força USD).", "Moneda de la cuenta de Google Ads (no fuerza USD).")],
    ["minClicks", ...P("Min. clicks", "Cliques mín.", "Cliques mín.", "Clics mín.")],
    ["lookback", ...P("Window (days)", "Janela (dias)", "Janela (dias)", "Ventana (días)")],
    ["metaAccount", ...P("Meta account number (optional)", "Número da conta Meta (opcional)", "Número da conta Meta (opcional)", "Número de cuenta de Meta (opcional)")],
    ["metaPlaceholder", ...P("Ads account number", "Número da conta de anúncios", "Número da conta de anúncios", "Número de la cuenta de anuncios")],
    ["metaHint", ...P("Uses the same Meta connection, with permission to read ads.", "Usa a mesma ligação da Meta, com permissão para ler anúncios.", "Usa a mesma conexão da Meta, com permissão para ler anúncios.", "Usa la misma conexión de Meta, con permiso para leer anuncios.")],
    ["tiktokAccount", ...P("TikTok account number (optional)", "Número da conta TikTok (opcional)", "Número da conta TikTok (opcional)", "Número de cuenta de TikTok (opcional)")],
    ["tiktokPlaceholder", ...P("Numeric ID", "ID numérico", "ID numérico", "ID numérico")],
    ["tiktokHint", ...P("Needs a TikTok Marketing API token (the Events API token alone does not read spend).", "Precisa de token Marketing API do TikTok (o token só Events API não lê gasto).", "Precisa de token Marketing API do TikTok (o token só Events API não lê gasto).", "Necesita un token de Marketing API de TikTok (el token solo de Events API no lee el gasto).")],
    ["syncNow", ...P("Update costs now", "Actualizar custos agora", "Atualizar custos agora", "Actualizar costes ahora")],
    ["applyPauses", ...P("Apply pauses now", "Aplicar pausas agora", "Aplicar pausas agora", "Aplicar pausas ahora")],
    ["back", ...P("Back", "Voltar", "Voltar", "Volver")],
    ["history", ...P("History", "Histórico", "Histórico", "Historial")],
    ["historyDesc", ...P("Last 30 actions, simulated or real.", "Últimas 30 acções, em simulação ou de verdade.", "Últimas 30 ações, em simulação ou de verdade.", "Últimas 30 acciones, en simulación o reales.")],
    ["emptyLogs", ...P("No records", "Sem registos", "Sem registros", "Sin registros")],
    ["emptyLogsDetail", ...P("Turn on simulation and apply pauses, or update costs.", "Active a simulação e aplique as pausas, ou actualize os custos.", "Ative a simulação e aplique as pausas, ou atualize os custos.", "Activa la simulación y aplica las pausas, o actualiza los costes.")],
    ["when", ...P("When", "Quando", "Quando", "Cuándo")],
    ["keyword", ...P("Keyword", "Palavra-chave", "Palavra-chave", "Palabra clave")],
    ["action", ...P("Action", "Acção", "Ação", "Acción")],
    ["mode", ...P("Mode", "Modo", "Modo", "Modo")],
    ["sim", ...P("simulation", "simulação", "simulação", "simulación")],
    ["real", ...P("real", "real", "real", "real")],
    ["err", ...P("error", "erro", "erro", "error")],
    ["saved", ...P("Settings saved.", "Definições guardadas.", "Definições salvas.", "Ajustes guardados.")],
    ["costsUpdated", ...P("Costs updated", "Custos actualizados", "Custos atualizados", "Costes actualizados")],
    ["costsFail", ...P("Could not sync costs", "Não foi possível sincronizar custos", "Não foi possível sincronizar custos", "No se pudieron sincronizar los costes")],
    ["googleOk", ...P("Google OK ({n} days)", "Google OK ({n} dias)", "Google OK ({n} dias)", "Google OK ({n} días)")],
    ["googleErr", ...P("Google: {error}", "Google: {error}", "Google: {error}", "Google: {error}")],
    ["googleConnect", ...P("Google: connect the account in Integrations", "Google: ligue a conta em Integrações", "Google: conecte a conta em Integrações", "Google: conecta la cuenta en Integraciones")],
    ["metaOk", ...P("Meta OK ({n})", "Meta OK ({n})", "Meta OK ({n})", "Meta OK ({n})")],
    ["metaErr", ...P("Meta: {error}", "Meta: {error}", "Meta: {error}", "Meta: {error}")],
    ["ttOk", ...P("TikTok OK ({n})", "TikTok OK ({n})", "TikTok OK ({n})", "TikTok OK ({n})")],
    ["ttErr", ...P("TikTok: {error}", "TikTok: {error}", "TikTok: {error}", "TikTok: {error}")],
    ["ran", ...P("Automizer ran", "Automizer executado", "Automizer executado", "Automizer ejecutado")],
    ["ranDetail", ...P("Evaluated {evaluated} · paused {paused} · simulation {dry} · skipped {skipped}", "Avaliadas {evaluated} · pausadas {paused} · simulação {dry} · ignoradas {skipped}", "Avaliadas {evaluated} · pausadas {paused} · simulação {dry} · ignoradas {skipped}", "Evaluadas {evaluated} · pausadas {paused} · simulación {dry} · omitidas {skipped}")],
  ],
};

for (const [ns, list] of Object.entries(rows)) {
  for (const [key, en, pt, ptBR, es] of list) put(ns, key, en, pt, ptBR, es);
}

const more = JSON.parse(fs.readFileSync(new URL("./expand-hub-i18n-more.json", import.meta.url), "utf8"));
for (const [ns, list] of Object.entries(more)) {
  for (const [key, en, pt, ptBR, es] of list) put(ns, key, en, pt, ptBR, es);
}

function objectEnd(src, braceAt) {
  let depth = 0;
  let inStr = false;
  let quote = "";
  for (let i = braceAt; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("unclosed");
}

function emit(obj, indent, quoted) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = quoted ? JSON.stringify(k) : k;
    lines.push(`${indent}${key}: ${JSON.stringify(v)},`);
  }
  return lines.join("\n");
}

function insert(src, ns, obj, quoted) {
  const keyName = ns.includes(".") ? ns.split(".").pop() : ns;
  const re = new RegExp(`^([ \\t]*)"?${keyName}"?\\s*:\\s*\\{`, "gm");
  const matches = [...src.matchAll(re)];
  if (matches.length !== 1) throw new Error(`${ns}: ${matches.length} matches in file`);
  const m = matches[0];
  const braceAt = m.index + m[0].length - 1;
  const end = objectEnd(src, braceAt);
  const firstKey = Object.keys(obj)[0];
  const slice = src.slice(braceAt, end);
  const probe = quoted ? `"${firstKey}"` : `${firstKey}:`;
  if (slice.includes(probe)) {
    console.log("skip", ns);
    return src;
  }
  const indent = m[1] + "  ";
  let head = src.slice(0, end).replace(/\s*$/, "");
  if (!head.endsWith(",") && !head.endsWith("{")) head += ",";
  const block = emit(obj, indent, quoted);
  return head + "\n" + block + "\n" + src.slice(end);
}

const files = {
  en: { file: "en.ts", quoted: false },
  pt: { file: "pt.ts", quoted: true },
  "pt-BR": { file: "pt-BR.ts", quoted: true },
  es: { file: "es.ts", quoted: true },
};

for (const [loc, meta] of Object.entries(files)) {
  const path = new URL(meta.file, root);
  let src = fs.readFileSync(path, "utf8");
  for (const [ns, obj] of Object.entries(add[loc])) {
    src = insert(src, ns, obj, meta.quoted);
  }
  fs.writeFileSync(path, src);
  console.log("wrote", meta.file);
}
