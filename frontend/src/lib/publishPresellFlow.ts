import { bakeMirrorOfferHrefsForPresell } from "@/lib/presellCtaBake";
import {
  buildPublishReadinessFromPresell,
  publishBlockedByReadiness,
  type PublishReadinessItem,
} from "@/components/PresellPublishReadiness";
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
}): Promise<{
  page: Presell;
  readiness: PublishReadinessItem[];
  published: boolean;
  complianceBlocked: boolean;
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

  const readinessPreview = buildPublishReadinessFromPresell({
    status: "draft",
    affiliateLink: affiliate,
    mirrorHtml: typeof content.importMirrorSrcDoc === "string" ? content.importMirrorSrcDoc : null,
    customDomainId: args.page.custom_domain_id || null,
    publicUrl: args.publicUrl || null,
  });
  const block = publishBlockedByReadiness(readinessPreview);
  const tryPublish = args.wantPublished && !block;

  const { data: updated, error } = await presellService.update(args.page.id, {
    content,
    status: tryPublish ? "published" : "draft",
  } as never);
  if (error && !updated) throw new Error(error);

  const live = (updated ?? args.page) as Presell & { compliance_blocked?: boolean };
  const complianceBlocked = Boolean(
    live.compliance_blocked || (tryPublish && live.status !== "published"),
  );
  const readiness = buildPublishReadinessFromPresell({
    status: live.status,
    affiliateLink: affiliate,
    mirrorHtml: typeof content.importMirrorSrcDoc === "string" ? content.importMirrorSrcDoc : null,
    customDomainId: live.custom_domain_id || null,
    publicUrl: args.publicUrl || null,
  });

  return {
    page: live,
    readiness,
    published: live.status === "published" && !complianceBlocked,
    complianceBlocked,
    block,
  };
}
