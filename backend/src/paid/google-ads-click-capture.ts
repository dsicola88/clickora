/**
 * Reconciliação cliques Google Ads vs tracking Clickora (sintoma clássico do funil).
 */

export type ClickCaptureStats = {
  tracking_clicks: number;
  google_clicks: number | null;
  click_delta: number | null;
  click_capture_ratio: number | null;
  funnel_risk: boolean;
};

/**
 * Risco de funil: Google reporta cliques mas a Clickora captura < 50%
 * (mín. 10 cliques Google para evitar ruído em campanhas novas).
 */
export function computeClickCapture(
  googleClicks: number | null | undefined,
  trackingClicks: number,
): ClickCaptureStats {
  const t = Number.isFinite(trackingClicks) ? Math.max(0, Math.floor(trackingClicks)) : 0;
  if (googleClicks == null || !Number.isFinite(googleClicks)) {
    return {
      tracking_clicks: t,
      google_clicks: null,
      click_delta: null,
      click_capture_ratio: null,
      funnel_risk: false,
    };
  }
  const g = Math.max(0, Math.floor(googleClicks));
  const ratio = g > 0 ? t / g : null;
  return {
    tracking_clicks: t,
    google_clicks: g,
    click_delta: g - t,
    click_capture_ratio: ratio,
    funnel_risk: g >= 10 && ratio != null && ratio < 0.5,
  };
}
