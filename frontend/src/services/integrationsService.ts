import { apiClient } from "@/lib/apiClient";

export const integrationsService = {
  async getAffiliateWebhookInfo() {
    return apiClient.get<{
      hook_url: string;
      sale_notify_email: string;
      fallback_account_email: string;
      smtp_configured: boolean;
    }>("/integrations/affiliate-webhook-info");
  },

  async patchNotificationEmail(sale_notify_email: string) {
    return apiClient.patch<{ ok: boolean; sale_notify_email: string }>("/integrations/notification-email", {
      sale_notify_email,
    });
  },

   async testSaleEmail() {
    return apiClient.post<{ ok: boolean; sent_to: string }>("/integrations/test-sale-email");
  },

  async getGoogleAdsSettings() {
    return apiClient.get<{
      google_ads_enabled: boolean;
      google_ads_customer_id: string;
      google_ads_conversion_action_id: string;
      google_ads_login_customer_id: string;
      has_refresh_token: boolean;
      api_env_configured: boolean;
      can_upload: boolean;
    }>("/integrations/google-ads");
  },

  async patchGoogleAdsSettings(body: {
    google_ads_enabled?: boolean;
    google_ads_customer_id?: string;
    google_ads_conversion_action_id?: string;
    google_ads_login_customer_id?: string;
    google_ads_refresh_token?: string;
    clear_google_ads_refresh_token?: boolean;
  }) {
    return apiClient.patch<{
      ok: boolean;
      google_ads_enabled: boolean;
      google_ads_customer_id: string;
      google_ads_conversion_action_id: string;
      google_ads_login_customer_id: string;
      has_refresh_token: boolean;
      api_env_configured: boolean;
      can_upload: boolean;
    }>("/integrations/google-ads", body);
  },

  async getMetaCapiSettings() {
    return apiClient.get<{
      meta_capi_enabled: boolean;
      meta_pixel_id: string;
      has_access_token: boolean;
      meta_capi_test_event_code: string;
      can_send: boolean;
    }>("/integrations/meta-capi");
  },

  async patchMetaCapiSettings(body: {
    meta_capi_enabled?: boolean;
    meta_pixel_id?: string;
    meta_access_token?: string;
    meta_capi_test_event_code?: string;
    clear_meta_access_token?: boolean;
  }) {
    return apiClient.patch<{
      ok: boolean;
      meta_capi_enabled: boolean;
      meta_pixel_id: string;
      has_access_token: boolean;
      meta_capi_test_event_code: string;
      can_send: boolean;
    }>("/integrations/meta-capi", body);
  },

  async getTelegramSettings() {
    return apiClient.get<{
      telegram_chat_id: string;
      telegram_configured: boolean;
      has_bot_token: boolean;
      telegram_notify_sale: boolean;
      telegram_notify_postback_error: boolean;
      telegram_notify_click: boolean;
    }>("/integrations/telegram");
  },

  async listBlacklist() {
    return apiClient.get<Array<{ id: string; ip: string; reason: string | null; added_at: string }>>(
      "/integrations/blacklist",
    );
  },

  async addBlacklist(body: { ip: string; reason?: string }) {
    return apiClient.post<{ ok: boolean; ip: string }>("/integrations/blacklist", body);
  },

  async removeBlacklist(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/integrations/blacklist/${encodeURIComponent(id)}`);
  },

  async getTrackingGuards() {
    return apiClient.get<{
      block_empty_user_agent: boolean;
      block_bot_clicks: boolean;
    }>("/integrations/tracking-guards");
  },

  async patchTrackingGuards(body: { block_empty_user_agent?: boolean; block_bot_clicks?: boolean }) {
    return apiClient.patch<{
      block_empty_user_agent: boolean;
      block_bot_clicks: boolean;
    }>("/integrations/tracking-guards", body);
  },

  async listWhitelist() {
    return apiClient.get<Array<{ id: string; ip: string; note: string | null; added_at: string }>>(
      "/integrations/whitelist",
    );
  },

  async addWhitelist(body: { ip: string; note?: string }) {
    return apiClient.post<{ ok: boolean; ip: string }>("/integrations/whitelist", body);
  },

  async removeWhitelist(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/integrations/whitelist/${encodeURIComponent(id)}`);
  },

  async patchTelegramSettings(body: {
    telegram_bot_token?: string;
    clear_telegram_bot_token?: boolean;
    telegram_chat_id?: string;
    telegram_notify_sale?: boolean;
    telegram_notify_postback_error?: boolean;
    telegram_notify_click?: boolean;
  }) {
    return apiClient.patch<{
      telegram_chat_id: string;
      telegram_configured: boolean;
      has_bot_token: boolean;
      telegram_notify_sale: boolean;
      telegram_notify_postback_error: boolean;
      telegram_notify_click: boolean;
    }>("/integrations/telegram", body);
  },

  async testTelegramIntegration() {
    return apiClient.post<{ ok: boolean }>("/integrations/telegram/test");
  },

  async getWebPushConfig() {
    return apiClient.get<{
      configured: boolean;
      vapid_public_key: string | null;
      subscription_count: number;
    }>("/integrations/push");
  },

  async subscribeWebPush(body: {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    user_agent?: string;
  }) {
    return apiClient.post<{ ok: boolean }>("/integrations/push/subscribe", body);
  },

  async unsubscribeWebPush(endpoint: string) {
    return apiClient.post<{ ok: boolean; removed: number }>("/integrations/push/unsubscribe", { endpoint });
  },

  async testWebPush() {
    return apiClient.post<{ ok: boolean }>("/integrations/push/test");
  },
};
