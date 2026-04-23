/**
 * Marcadores dinâmicos das redes de anúncios (ValueTrack, Meta, Bing, etc.).
 * A rede substitui pelo valor real no clique — usar nos parâmetros do URL (utm_*, sub1–sub3, etc.).
 */

export type AdNetworkTokenPick = { token: string; label: string; search: string };

export type AdNetworkTokenSection = {
  id: string;
  title: string;
  items: AdNetworkTokenPick[];
};

export const AD_NETWORK_TOKEN_SECTIONS: AdNetworkTokenSection[] = [
  {
    id: "google",
    title: "Google Ads · ValueTrack",
    items: [
      { token: "{gclid}", label: "ID do clique (gclid)", search: "gclid clique google ads conversão" },
      { token: "{gbraid}", label: "ID do clique iOS / app (gbraid)", search: "gbraid google app ios" },
      { token: "{wbraid}", label: "ID Web-to-app (wbraid)", search: "wbraid google" },
      { token: "{keyword}", label: "Palavra-chave", search: "keyword palavra chave google ads" },
      { token: "{campaignid}", label: "ID da campanha", search: "campaign campanha google" },
      { token: "{adgroupid}", label: "ID do grupo de anúncios", search: "adgroup grupo google" },
      { token: "{creative}", label: "ID do criativo / anúncio", search: "creative anúncio google" },
      { token: "{device}", label: "Tipo de dispositivo", search: "device telemóvel google" },
      { token: "{network}", label: "Rede (Pesquisa, Display…)", search: "network rede google" },
      { token: "{placement}", label: "Posição / site (placement)", search: "placement posição google" },
      { token: "{matchtype}", label: "Tipo de correspondência da keyword", search: "match correspondência google" },
      { token: "{extensionid}", label: "Extensão associada ao clique", search: "extension extensão google" },
      { token: "{target}", label: "Alvo do anúncio", search: "target alvo google" },
      { token: "{loc_physical_ms}", label: "Local físico (avançado)", search: "local físico google" },
      { token: "{loc_interest_ms}", label: "Interesse de localização (avançado)", search: "interesse local google" },
    ],
  },
  {
    id: "microsoft",
    title: "Microsoft Advertising (Bing)",
    items: [
      { token: "{msclkid}", label: "ID do clique (msclkid)", search: "msclkid bing microsoft clique" },
      { token: "{keyword}", label: "Palavra-chave", search: "keyword bing microsoft palavra" },
      { token: "{QueryString}", label: "Texto da pesquisa (consulta)", search: "query bing pesquisa microsoft" },
      { token: "{CampaignId}", label: "ID da campanha", search: "campaign id bing" },
      { token: "{Campaign}", label: "Nome da campanha", search: "campaign name bing" },
      { token: "{AdGroupId}", label: "ID do grupo de anúncios", search: "adgroup id bing" },
      { token: "{AdGroup}", label: "Nome do grupo de anúncios", search: "adgroup name bing" },
      { token: "{AdID}", label: "ID do anúncio", search: "ad id bing" },
      { token: "{Device}", label: "Dispositivo", search: "device bing" },
      { token: "{MatchType}", label: "Tipo de correspondência", search: "match bing" },
      { token: "{Network}", label: "Rede", search: "network bing" },
      { token: "{feeditemid}", label: "ID do feed", search: "feed bing microsoft" },
    ],
  },
  {
    id: "facebook",
    title: "Meta Ads · Facebook e Instagram",
    items: [
      { token: "{fbclid}", label: "ID do clique (fbclid)", search: "fbclid meta facebook instagram clique" },
      { token: "{{campaign.name}}", label: "Nome da campanha", search: "meta facebook instagram campanha nome" },
      { token: "{{adset.name}}", label: "Nome do conjunto de anúncios", search: "meta conjunto adset" },
      { token: "{{ad.name}}", label: "Nome do anúncio", search: "meta anúncio ad" },
      { token: "{{campaign.id}}", label: "ID da campanha", search: "meta id campanha" },
      { token: "{{adset.id}}", label: "ID do conjunto", search: "meta adset id" },
      { token: "{{ad.id}}", label: "ID do anúncio", search: "meta ad id" },
      { token: "{{placement}}", label: "Onde o anúncio apareceu", search: "meta placement posição" },
      { token: "{{site_source_name}}", label: "Origem do site / app", search: "meta origem source instagram" },
    ],
  },
  {
    id: "snapchat",
    title: "Snapchat Ads",
    items: [
      { token: "{{ad.id}}", label: "ID do anúncio", search: "snapchat ad id" },
      { token: "{{adSet.id}}", label: "ID do conjunto (ad set)", search: "snapchat adset id" },
      { token: "{{campaign.id}}", label: "ID da campanha", search: "snapchat campaign id" },
      { token: "{{creative.name}}", label: "Nome do criativo", search: "snapchat creative" },
      { token: "{{adSet.name}}", label: "Nome do conjunto", search: "snapchat adset name" },
      { token: "{{campaign.name}}", label: "Nome da campanha", search: "snapchat campaign name" },
      { token: "{{creative.headline}}", label: "Título do criativo", search: "snapchat headline" },
    ],
  },
  {
    id: "pinterest",
    title: "Pinterest Ads",
    items: [
      { token: "{epik}", label: "ID do clique (epik)", search: "pinterest epik clique" },
      { token: "{campaignid}", label: "ID da campanha", search: "pinterest campaign id" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "pinterest campanha" },
      { token: "{adgroupid}", label: "ID do grupo de anúncios", search: "pinterest adgroup" },
      { token: "{adgroup_name}", label: "Nome do grupo de anúncios", search: "pinterest adgroup name" },
      { token: "{keyword}", label: "Palavra-chave", search: "pinterest keyword" },
      { token: "{keyword_id}", label: "ID da palavra-chave", search: "pinterest keyword id" },
      { token: "{creative_id}", label: "ID do criativo", search: "pinterest creative" },
      { token: "{adid}", label: "ID do anúncio", search: "pinterest ad id" },
      { token: "{device}", label: "Dispositivo", search: "pinterest device" },
    ],
  },
  {
    id: "tiktok",
    title: "TikTok Ads",
    items: [
      { token: "{ttclid}", label: "ID do clique (ttclid)", search: "ttclid tiktok clique" },
      { token: "__CID__", label: "ID da campanha (macro TikTok)", search: "tiktok campaign id cid" },
      { token: "__AID__", label: "ID do anúncio (macro TikTok)", search: "tiktok ad id aid" },
      { token: "__CAMPAIGN_ID__", label: "ID da campanha (legado)", search: "tiktok campaign_id" },
      { token: "__CID_NAME__", label: "Nome da campanha", search: "tiktok campaign name" },
      { token: "__AID_NAME__", label: "Nome do anúncio / ad group", search: "tiktok ad name" },
      { token: "__CAMPAIGN_NAME__", label: "Nome da campanha (legado)", search: "tiktok campaign name macro" },
      { token: "__PLACEMENT__", label: "Posicionamento", search: "tiktok placement" },
      { token: "{campaign_name}", label: "Nome da campanha (URL dinâmico)", search: "tiktok campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "tiktok id campanha" },
      { token: "{adgroup_name}", label: "Nome do grupo de anúncios", search: "tiktok grupo" },
      { token: "{adgroup_id}", label: "ID do grupo", search: "tiktok adgroup" },
      { token: "{ad_name}", label: "Nome do anúncio", search: "tiktok anúncio" },
      { token: "{ad_id}", label: "ID do anúncio", search: "tiktok ad id" },
      { token: "{placement}", label: "Posicionamento", search: "tiktok placement chaves" },
    ],
  },
  {
    id: "taboola",
    title: "Taboola",
    items: [
      { token: "{click_id}", label: "ID do clique Taboola", search: "clique taboola" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "taboola campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "taboola id" },
      { token: "{site}", label: "Site", search: "taboola site" },
      { token: "{site_id}", label: "ID do site", search: "taboola site id" },
      { token: "{thumbnail}", label: "Miniatura", search: "taboola thumbnail" },
      { token: "{title}", label: "Título", search: "taboola título" },
    ],
  },
  {
    id: "outbrain",
    title: "Outbrain",
    items: [
      { token: "{ob_click_id}", label: "ID do clique Outbrain", search: "clique outbrain" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "outbrain campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "outbrain id" },
      { token: "{publisher_name}", label: "Nome do editor", search: "outbrain publisher" },
      { token: "{publisher_id}", label: "ID do editor", search: "outbrain publisher id" },
      { token: "{section_name}", label: "Nome da secção", search: "outbrain secção" },
    ],
  },
  {
    id: "kwai",
    title: "Kwai Ads",
    items: [
      { token: "{click_id}", label: "ID do clique Kwai", search: "clique kwai" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "kwai campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "kwai id" },
      { token: "{adgroup_name}", label: "Nome do grupo de anúncios", search: "kwai grupo" },
      { token: "{creative_id}", label: "ID do criativo", search: "kwai criativo" },
    ],
  },
  {
    id: "twitter",
    title: "X (Twitter) Ads",
    items: [{ token: "{twclid}", label: "ID do clique (twclid)", search: "twitter x twclid clique" }],
  },
];

/** Nome da plataforma no Construtor de URL → id da secção que sobe para o topo. */
export const URL_BUILDER_PLATFORM_SECTION_BOOST: Record<string, string> = {
  "Google Ads": "google",
  "Facebook Ads": "facebook",
  "Bing Ads": "microsoft",
  "TikTok Ads": "tiktok",
  Taboola: "taboola",
  Outbrain: "outbrain",
  "Kwai Ads": "kwai",
  "Pinterest Ads": "pinterest",
  "Twitter Ads": "twitter",
};

export function orderedAdNetworkTokenSections(selectedPlatformLabel: string): AdNetworkTokenSection[] {
  const boostId = URL_BUILDER_PLATFORM_SECTION_BOOST[selectedPlatformLabel];
  if (!boostId) return AD_NETWORK_TOKEN_SECTIONS;
  const idx = AD_NETWORK_TOKEN_SECTIONS.findIndex((s) => s.id === boostId);
  if (idx <= 0) return AD_NETWORK_TOKEN_SECTIONS;
  const copy = [...AD_NETWORK_TOKEN_SECTIONS];
  const [picked] = copy.splice(idx, 1);
  return [picked, ...copy];
}
