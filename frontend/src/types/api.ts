// ============================
// Data models expected from API
// ============================

/** Instruções DNS enquanto o domínio está pendente (GET lista + POST create). */
export type CustomDomainPendingDns =
  | {
      mode: "vercel";
      cname: { host: string; target: string; note: string };
      vercel_txt: { type: string; name: string; value: string; reason: string }[];
      vercel_verified_immediately: boolean;
      note: string;
    }
  | {
      mode: "dclickora";
      txt_name: string;
      txt_value: string;
      note: string;
    };

/** Domínio personalizado (Tracking → Configurações). GET /custom-domain devolve lista. */
export interface CustomDomainDto {
  id: string;
  hostname: string;
  verification_token: string;
  status: "pending" | "verified";
  verified_at: string | null;
  is_default: boolean;
  /** Presell que abre em `https://hostname/`; null/omitido = automático (mais recentemente atualizada publicada). */
  root_presell_id?: string | null;
  created_at: string;
  updated_at: string;
  /** Presente quando o servidor regista o hostname no projeto Vercel (CNAME + TXT da Vercel). */
  vercel_domain_registered?: boolean;
  vercel_verification?: { type: string; domain: string; value: string; reason: string }[] | null;
  /** Enquanto `status === "pending"`, o servidor devolve os registos a configurar. */
  pending_dns?: CustomDomainPendingDns;
  /** Com `status === "verified"` e domínio registado na Vercel: CNAME/A de referência para o site (o tráfego já deve estar apontado). */
  hosting_dns_hint?: { host: string; target: string; note: string };
}

/** GET /custom-domain/quota */
export interface CustomDomainQuotaDto {
  max_custom_domains: number | null;
  used: number;
  can_add: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: UserPlan | null;
  workspace_id: string;
  /** Conta cujos dados (presells, tracking) estão activos — igual a `id` excepto em equipas. */
  tenant_user_id?: string;
  /** Papel no workspace actual (owner | admin | member | viewer). */
  workspace_role?: "owner" | "admin" | "member" | "viewer";
  /** Permissões extra do membro (ex.: rotators:write, presells:write). */
  workspace_permissions?: string[];
  role: "super_admin" | "admin" | "moderator" | "user";
  avatar_url?: string;
  created_at: string;
  /** E-mail para alertas de venda (postback de afiliados). Vazio = usa `email`. */
  sale_notify_email?: string;
}

export interface UserPlan {
  plan_name: string;
  plan_type: "free_trial" | "monthly" | "quarterly" | "annual";
  max_pages: number | null;
  max_clicks: number | null;
  /** Limite de domínios personalizados do plano (0 = só HTML/dclickora). */
  max_custom_domains?: number;
  has_branding: boolean;
}

export interface Plan {
  id: string;
  name: string;
  type: "free_trial" | "monthly" | "quarterly" | "annual";
  price_cents: number;
  max_presell_pages: number | null;
  max_clicks_per_month: number | null;
  max_custom_domains: number;
  has_branding: boolean;
  features: string[];
  /** Se definido, texto do botão do cartão (sobreposta aos textos globais). */
  cta_label?: string | null;
  /** Hotmart / checkout público; presente quando o servidor configurou URLs por plano. */
  checkout_url?: string | null;
}

export interface Presell {
  id: string;
  title: string;
  content: Record<string, unknown>;
  slug: string;
  type: string;
  category: string;
  language: string;
  status: "draft" | "published" | "paused" | "archived";
  clicks: number;
  impressions: number;
  conversions: number;
  video_url?: string;
  /** Domínio público para links; omitido ou null = usar o domínio padrão da conta. */
  custom_domain_id?: string | null;
  settings: Record<string, unknown>;
  tracking: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSummary {
  presell_id: string;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  revenue: number;
}

export interface TrackingEvent {
  id: string;
  presell_id: string;
  event_type: "click" | "impression" | "conversion" | "lead" | "sale" | "pageview";
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  country?: string;
  /** IP do cliente no evento (painel autenticado). */
  ip_address?: string | null;
  device?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  utm_source?: string | null;
  /** Palavra-chave (UTM term) quando enviada no clique/impressão. */
  utm_term?: string | null;
  /** Criativo / anúncio (utm_content). */
  utm_content?: string | null;
  /** Nome da campanha UTM (coluna campaign ou metadata). */
  utm_campaign?: string | null;
  gclid?: string | null;
  msclkid?: string | null;
  /** paid | organic — derivado de gclid/msclkid no evento. */
  traffic_type?: "paid" | "organic";
  is_bot?: boolean;
  bot_label?: string | null;
}

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  plan_name: string | null;
  plan_type: string | null;
  plan_id: string | null;
  sub_status: string | null;
  sub_starts_at: string | null;
  sub_ends_at: string | null;
  /** Data de fim já ultrapassada (servidor). */
  ends_at_passed?: boolean;
  pages_count: number;
  events_count: number;
  conversions_count: number;
  created_at: string;
}

export interface AdminPlanRow {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  max_presell_pages: number | null;
  max_clicks_per_month: number | null;
  max_custom_domains: number;
  has_branding: boolean;
  features?: string[];
  cta_label?: string | null;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  total_presells: number;
  total_events: number;
  total_conversions: number;
  subscriptions_expiring_14d: number;
  signups_by_day: { date: string; count: number }[];
  conversions_by_day: { date: string; count: number }[];
}

/** Configuração da landing pública na raiz / (hero, textos, imagem, tipografia dos planos). */
export interface PlansLandingPublic {
  badge_text: string | null;
  hero_title: string;
  hero_subtitle: string | null;
  has_hero_image: boolean;
  intro_text: string | null;
  footer_text: string | null;
  hero_font: string;
  hero_text_align: string;
  hero_title_size: string;
  hero_title_weight: string;
  hero_subtitle_size: string;
  intro_font: string;
  intro_text_align: string;
  intro_text_size: string;
  footer_font: string;
  footer_text_align: string;
  footer_text_size: string;
  updated_at: string;
  /** Etiquetas da grelha de planos (fundidas com defaults no servidor). */
  plan_display_labels: Record<string, string>;
  /** Efeitos do hero: overlay, zoom, parallax, CTA, animação — fundidos com defaults no servidor. */
  hero_visual: Record<string, unknown>;
  /** Tema escuro (estilo vendas), FAQ, números, destaques — fundido com defaults no servidor. */
  landing_extras: Record<string, unknown>;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}
