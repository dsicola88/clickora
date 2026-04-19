import type { ComponentType } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  Twitter,
  Youtube,
  Globe,
} from "lucide-react";

export type SocialNetwork =
  | "facebook"
  | "instagram"
  | "youtube"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "whatsapp"
  | "email"
  | "link";

const NETWORK_ICONS: Record<SocialNetwork, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  linkedin: Linkedin,
  tiktok: Music2,
  whatsapp: MessageCircle,
  email: Mail,
  link: Globe,
};

const LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  email: "E-mail",
  link: "Website",
};

export interface SocialIconItem {
  id: string;
  network: SocialNetwork;
  url: string;
}

function resolveHref(network: SocialNetwork, raw: string): string | null {
  const u = raw.trim();
  if (!u) return null;
  if (network === "email") {
    if (u.startsWith("mailto:")) return u;
    return `mailto:${u}`;
  }
  if (network === "whatsapp") {
    if (/^https?:\/\//i.test(u)) return u;
    const digits = u.replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/${digits}`;
  }
  try {
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("//")) return u;
    return `https://${u}`;
  } catch {
    return null;
  }
}

export function SocialIconsWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Record<string, unknown>;
  const items = (Array.isArray(c.items) ? c.items : []) as SocialIconItem[];
  const iconSize = typeof c.iconSize === "number" ? c.iconSize : 22;
  const gap = typeof c.gap === "number" ? c.gap : 16;
  const variant = (c.variant as string) === "outline" ? "outline" : (c.variant as string) === "mono" ? "mono" : "filled";
  const iconBg = (c.iconBg as string) ?? "#0f172a";
  const iconColor = (c.iconColor as string) ?? "#ffffff";

  const align = resolveResponsive(widget.styles.align, device);
  const outer = stylesToCssWidgetContent(widget.styles, device);

  const visible = items.filter((it) => resolveHref(it.network, it.url ?? ""));

  if (!visible.length) {
    return (
      <div style={{ ...outer, display: "flex", justifyContent: alignToFlexJustify(align) }}>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          Configure URLs nas redes sociais no painel.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        ...outer,
        display: "flex",
        justifyContent: alignToFlexJustify(align),
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "center", justifyContent: "inherit" }}>
        {visible.map((item) => {
          const href = resolveHref(item.network, item.url)!;
          const Icon = NETWORK_ICONS[item.network] ?? Globe;
          const isOutline = variant === "outline";
          const isMono = variant === "mono";
          return (
            <a
              key={item.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={LABELS[item.network] ?? "Rede social"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: Math.max(36, iconSize + 18),
                height: Math.max(36, iconSize + 18),
                borderRadius: 999,
                textDecoration: "none",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                background: isOutline ? "transparent" : isMono ? "transparent" : iconBg,
                color: isMono ? iconBg : iconColor,
                border: isOutline ? `2px solid ${iconBg}` : isMono ? "none" : "none",
                boxShadow:
                  !isOutline && !isMono ? "0 1px 2px rgba(15, 23, 42, 0.12)" : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <Icon size={iconSize} strokeWidth={isOutline || isMono ? 2 : 1.75} />
            </a>
          );
        })}
      </div>
    </div>
  );
}
