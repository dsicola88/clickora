/**
 * Copia OAuth de Integrações (User) → PaidAdsGoogleAdsConnection do projecto
 * e opcionalmente importa campanhas Search reais da conta ligada (GAQL).
 */
import { resolveUserGoogleAdsRefreshToken } from "../modules/googleAds/googleAds.service";
import {
  getAccessFromRefreshToken,
  isGoogleAdsOAuthConfigured,
  resolveReadableGoogleAdsCustomer,
} from "./google-ads.api";
import { detachStaleGoogleCampaignLinks } from "./google-ads-detach-stale";
import {
  importGoogleSearchCampaigns,
  listRemoteGoogleSearchCampaigns,
} from "./google-ads-import.service";
import { prisma } from "./paidPrisma";
import { storePaidToken } from "./tokenSecrets";

export type LinkFromIntegrationsResult =
  | {
      ok: true;
      project_id: string;
      customer_id: string;
      account_name: string | null;
      import: { imported: number; errors: number; remote: number; detached: number } | null;
    }
  | { ok: false; error: string; code: string };

export async function linkGoogleAdsProjectFromIntegrations(
  projectId: string,
  ownerUserId: string,
  opts?: { import_campaigns?: boolean },
): Promise<LinkFromIntegrationsResult> {
  if (!isGoogleAdsOAuthConfigured()) {
    return {
      ok: false,
      error: "Google Ads OAuth não configurado no servidor.",
      code: "oauth_not_configured",
    };
  }

  const project = await prisma.paidAdsProject.findFirst({
    where: { id: projectId, userId: ownerUserId },
    select: { id: true, userId: true },
  });
  if (!project) {
    return { ok: false, error: "Projeto não encontrado.", code: "project_not_found" };
  }

  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      googleAdsRefreshToken: true,
      googleAdsCustomerId: true,
      googleAdsLoginCustomerId: true,
    },
  });
  if (!user) {
    return { ok: false, error: "Utilizador não encontrado.", code: "user_not_found" };
  }

  const refresh = resolveUserGoogleAdsRefreshToken(user);
  if (!refresh) {
    return {
      ok: false,
      error: "Ligue primeiro a conta em Integrações → Google.",
      code: "integrations_oauth_required",
    };
  }

  const customerId = (user.googleAdsCustomerId ?? "").replace(/\D/g, "");
  if (!customerId) {
    return {
      ok: false,
      error:
        "Defina em Integrações → Google o número da conta cliente (o mesmo de ads.google.com). Não usamos a 1.ª conta acessível automaticamente.",
      code: "customer_id_required",
    };
  }

  const hintLogin = (user.googleAdsLoginCustomerId ?? "").replace(/\D/g, "") || undefined;

  let accountName: string | null = `Conta ${customerId}`;
  let resolvedLogin: string | undefined;
  try {
    const { access_token: access } = await getAccessFromRefreshToken(refresh);
    const resolved = await resolveReadableGoogleAdsCustomer(access, customerId, hintLogin);
    if (!resolved.ok) {
      return {
        ok: false,
        error: resolved.error,
        code: "customer_unreadable",
      };
    }
    if (resolved.meta.manager) {
      return {
        ok: false,
        error:
          "A conta indicada é MCC (gestor). Em Integrações escolha a conta cliente onde estão os anúncios reais — ou deixe o MCC só no campo «login customer».",
        code: "manager_account",
      };
    }
    if (resolved.meta.name) accountName = resolved.meta.name;
    resolvedLogin = resolved.loginCustomerId;
    /** Persistir modo solo (null) ou MCC descoberta — ambos válidos. */
    const nextLogin = resolvedLogin ?? null;
    const prevLogin = hintLogin ?? null;
    if (nextLogin !== prevLogin) {
      await prisma.user.update({
        where: { id: ownerUserId },
        data: { googleAdsLoginCustomerId: nextLogin },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token Google inválido.";
    return { ok: false, error: message, code: "token_refresh_failed" };
  }

  const prev = await prisma.paidAdsGoogleAdsConnection.findUnique({
    where: { projectId: project.id },
    select: { googleCustomerId: true },
  });
  const prevCid = (prev?.googleCustomerId ?? "").replace(/\D/g, "");
  const customerChanged = Boolean(prevCid && prevCid !== customerId);

  await prisma.paidAdsGoogleAdsConnection.upsert({
    where: { projectId: project.id },
    create: {
      userId: project.userId,
      projectId: project.id,
      status: "connected",
      tokenRef: storePaidToken(refresh),
      googleCustomerId: customerId,
      accountName,
      lastSyncAt: new Date(),
      errorMessage: null,
    },
    update: {
      status: "connected",
      tokenRef: storePaidToken(refresh),
      googleCustomerId: customerId,
      accountName,
      lastSyncAt: new Date(),
      errorMessage: null,
    },
  });

  /** Conta mudou → IDs da conta anterior não são inventário desta. */
  if (customerChanged) {
    await detachStaleGoogleCampaignLinks(project.id);
  }

  let importSummary: {
    imported: number;
    errors: number;
    remote: number;
    detached: number;
  } | null = null;
  const doImport = opts?.import_campaigns !== false;

  if (doImport) {
    const remote = await listRemoteGoogleSearchCampaigns(project.id);
    if (!remote.ok) {
      return {
        ok: false,
        error: remote.error,
        code: remote.code ?? "gaql_error",
      };
    }

    const remoteIds = new Set(remote.campaigns.map((c) => c.external_campaign_id));
    const { detached } = await detachStaleGoogleCampaignLinks(project.id, {
      keepExternalIds: remoteIds,
    });

    const ids = remote.campaigns
      .filter((c) => String(c.channel_type || "").toUpperCase() === "SEARCH" && !c.already_imported)
      .map((c) => c.external_campaign_id);
    let imported = 0;
    let errors = 0;
    for (let i = 0; i < ids.length; i += 25) {
      const chunk = ids.slice(i, i + 25);
      const out = await importGoogleSearchCampaigns(project.id, project.userId, chunk, {
        refresh_existing: false,
      });
      if (out.ok) {
        imported += out.imported.length;
        errors += out.errors.length;
      } else {
        errors += chunk.length;
      }
    }
    importSummary = { imported, errors, remote: remote.totals.remote, detached };
  }

  return {
    ok: true,
    project_id: project.id,
    customer_id: customerId,
    account_name: accountName,
    import: importSummary,
  };
}

/** Após «Ligar a conta» em Integrações: sincroniza todos os projectos Paid do utilizador. */
export async function linkAllPaidProjectsFromIntegrations(
  ownerUserId: string,
  opts?: { import_campaigns?: boolean },
): Promise<{ linked: number; errors: string[] }> {
  const projects = await prisma.paidAdsProject.findMany({
    where: { userId: ownerUserId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let linked = 0;
  const errors: string[] = [];
  for (const p of projects) {
    const r = await linkGoogleAdsProjectFromIntegrations(p.id, ownerUserId, opts);
    if (r.ok) linked += 1;
    else errors.push(`${p.id}: ${r.error}`);
  }
  return { linked, errors };
}
