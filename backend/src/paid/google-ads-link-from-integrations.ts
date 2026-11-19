/**
 * Copia OAuth de Integrações (User) → PaidAdsGoogleAdsConnection do projecto
 * e opcionalmente importa campanhas Search.
 */
import { resolveUserGoogleAdsRefreshToken } from "../modules/googleAds/googleAds.service";
import {
  fetchCustomerName,
  getAccessFromRefreshToken,
  isGoogleAdsOAuthConfigured,
  listFirstAccessibleCustomerId,
} from "./google-ads.api";
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
      import: { imported: number; errors: number; remote: number } | null;
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

  let customerId = (user.googleAdsCustomerId ?? "").replace(/\D/g, "");
  let accountName: string | null = customerId ? `Conta ${customerId}` : null;

  try {
    const { access_token: access } = await getAccessFromRefreshToken(refresh);
    if (!customerId) {
      const listed = await listFirstAccessibleCustomerId(access);
      customerId = listed.customerId.replace(/\D/g, "");
      accountName = listed.name ?? `Conta ${customerId}`;
    } else {
      const name = await fetchCustomerName(access, customerId);
      if (name) accountName = name;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token Google inválido.";
    return { ok: false, error: message, code: "token_refresh_failed" };
  }

  if (!customerId) {
    return {
      ok: false,
      error: "Conta Google sem customer ID.",
      code: "customer_id_required",
    };
  }

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

  let importSummary: { imported: number; errors: number; remote: number } | null = null;
  const doImport = opts?.import_campaigns !== false;

  if (doImport) {
    const remote = await listRemoteGoogleSearchCampaigns(project.id);
    if (remote.ok) {
      const ids = remote.campaigns
        .filter((c) => !c.already_imported)
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
      importSummary = { imported, errors, remote: remote.totals.remote };
    }
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
