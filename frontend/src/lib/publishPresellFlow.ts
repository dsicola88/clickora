import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { bakeMirrorOfferHrefsForPresell, trackHrefForPresell } from "@/lib/presellCtaBake";
import {
  buildPublishReadinessFromPresell,
  collectOfferTrackingHtmlFromContent,
  publishBlockedByReadiness,
  type PublishReadinessItem,
} from "@/components/PresellPublishReadiness";
import { bakePublicOfferHrefs } from "@/lib/presellVisualEdit";
import { presellService } from "@/services/presellService";
import type { Presell } from "@/types/api";

/**
 * Fluxo único enterprise: bake CTAs → update content → publish com gate.
 * Usado por wizard e dashboard — uma verdade, sem status no update a falhar em silêncio.
 */
export async function bakeAndMaybePublishPresell(args: {
  page: Presell;
  content: Record<string, unknown>;
  affiliateLink: string;
  wantPublished: boolean;
  publicUrl?: string | null;
  /** Base /api preferida (domínio tracking da conta ou host da lander). */
  trackApiBase?: string | null;
  /** Domínio Vercel seleccionado ainda sem HTTPS pronto. */
  customDomainHttpsPending?: boolean;
}): Promise<{
  page: Presell;
  readiness: PublishReadinessItem[];
  published: boolean;
  /** Gate `assertPublishAllowed` (DT/OC/CL…) — não confundir com CTAs sem track. */
  complianceBlocked: boolean;
  /** Tentou publicar mas ficou rascunho por readiness (hoplink / CTAs) sem gate de conformidade. */
  readinessBlocked: boolean;
  block: PublishReadinessItem | null;
}> {
  const affiliate = args.affiliateLink.trim();
  let content = { ...args.content };
  const mirrorRaw = typeof content.importMirrorSrcDoc === "string" ? content.importMirrorSrcDoc : "";
  if (mirrorRaw) {
    content = {
      ...content,
      importMirrorSrcDoc: bakeMirrorOfferHrefsForPresell(
        mirrorRaw,
        args.page.id,
        affiliate,
        args.trackApiBase,
      ),
    };
  }

  const pageDoc = parsePresellBuilderPageDocument(content);
  if (pageDoc && affiliate) {
    const track = trackHrefForPresell(args.page.id, affiliate, args.trackApiBase);
    const baked = bakePublicOfferHrefs(pageDoc, track, affiliate, "", {
      unlockCookieOnly: true,
      cookieRedirectToOffer: false,
    });
    content = { ...content, pageDocument: baked, editorWorkingDocument: baked };
  }

  const trackingHtml = collectOfferTrackingHtmlFromContent(content);
  const readinessPreview = buildPublishReadinessFromPresell({
    status: "draft",
    affiliateLink: affiliate,
    mirrorHtml: trackingHtml || null,
    content,
    customDomainId: args.page.custom_domain_id || null,
    publicUrl: args.publicUrl || null,
    customDomainHttpsPending: args.customDomainHttpsPending,
  });
  const block = publishBlockedByReadiness(readinessPreview);
  const tryPublish = args.wantPublished && !block;

  const { data: updated, error } = await presellService.update(args.page.id, {
    content,
    status: tryPublish ? "published" : "draft",
  } as never);
  if (error && !updated) throw new Error(error);

  const live = (updated ?? args.page) as Presell & { compliance_blocked?: boolean };
  const complianceBlocked = Boolean(live.compliance_blocked);
  const readinessBlocked = Boolean(tryPublish && !complianceBlocked && live.status !== "published");
  const readiness = buildPublishReadinessFromPresell({
    status: live.status,
    affiliateLink: affiliate,
    mirrorHtml: trackingHtml || null,
    content,
    customDomainId: live.custom_domain_id || null,
    publicUrl: args.publicUrl || null,
    customDomainHttpsPending: args.customDomainHttpsPending,
  });

  return {
    page: live,
    readiness,
    published: live.status === "published" && !complianceBlocked,
    complianceBlocked,
    readinessBlocked,
    block,
  };
}