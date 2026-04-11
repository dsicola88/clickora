import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import { plansLandingService } from "@/services/plansLandingService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LayoutTemplate, Save, Trash2, Upload, Sparkles, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  coerceBodySize,
  coerceFontFamily,
  coerceFontWeight,
  coerceHeroTitleSize,
  coerceTextAlign,
  plansLandingFooterClasses,
  plansLandingHeroInnerClasses,
  plansLandingHeroSubtitleClasses,
  plansLandingHeroTitleClasses,
  plansLandingIntroClasses,
} from "@/lib/plansLandingTypography";

const ADMIN_KEY = ["admin-plans-landing"] as const;
const PUBLIC_KEY = ["plans-landing-public"] as const;

const OPT_FONT = [
  { value: "sans", label: "Sans (UI)" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];
const OPT_ALIGN = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];
const OPT_TITLE_SIZE = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL (padrão)" },
  { value: "4xl", label: "4XL" },
  { value: "5xl", label: "5XL" },
];
const OPT_WEIGHT = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Médio" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold (padrão)" },
  { value: "extrabold", label: "Extrabold" },
];
const OPT_BODY = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "SM" },
  { value: "base", label: "Base (padrão)" },
  { value: "lg", label: "LG" },
  { value: "xl", label: "XL" },
];

function HeroPreview(props: {
  badgeText: string;
  heroTitle: string;
  heroSubtitle: string;
  hasImage: boolean;
  imageUpdatedAt: string;
  heroFont: string;
  heroTextAlign: string;
  heroTitleSize: string;
  heroTitleWeight: string;
  heroSubtitleSize: string;
  className?: string;
}) {
  const src = props.hasImage ? plansLandingService.heroImageHref(props.imageUpdatedAt) : null;
  const font = coerceFontFamily(props.heroFont);
  const align = coerceTextAlign(props.heroTextAlign);
  const titleS = coerceHeroTitleSize(props.heroTitleSize);
  const weight = coerceFontWeight(props.heroTitleWeight);
  const subS = coerceBodySize(props.heroSubtitleSize);

  return (
    <div
      className={cn(
        "relative flex min-h-[260px] flex-col overflow-hidden rounded-xl border border-border/80 bg-muted/40 shadow-inner",
        props.className,
      )}
    >
      {src ? (
        <>
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-background/20" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background to-accent/15" />
      )}
      <div
        className={cn(
          "relative z-10 p-6 md:p-8",
          plansLandingHeroInnerClasses({ font, align }),
        )}
      >
        {props.badgeText.trim() ? (
          <span className="inline-flex w-fit max-w-full items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            {props.badgeText}
          </span>
        ) : null}
        <h2 className={plansLandingHeroTitleClasses({ size: titleS, weight })}>{props.heroTitle || "…"}</h2>
        {props.heroSubtitle.trim() ? (
          <p className={plansLandingHeroSubtitleClasses(subS)}>{props.heroSubtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  onInvalidateAdmin?: () => void;
};

export function PlansLandingEditor({ onInvalidateAdmin }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async () => {
      const { data: row, error } = await adminService.getPlansLanding();
      if (error) throw new Error(error);
      if (!row) throw new Error("Resposta vazia");
      return row;
    },
  });

  const [badgeText, setBadgeText] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [heroFont, setHeroFont] = useState("sans");
  const [heroTextAlign, setHeroTextAlign] = useState("left");
  const [heroTitleSize, setHeroTitleSize] = useState("3xl");
  const [heroTitleWeight, setHeroTitleWeight] = useState("bold");
  const [heroSubtitleSize, setHeroSubtitleSize] = useState("base");
  const [introFont, setIntroFont] = useState("sans");
  const [introTextAlign, setIntroTextAlign] = useState("left");
  const [introTextSize, setIntroTextSize] = useState("base");
  const [footerFont, setFooterFont] = useState("sans");
  const [footerTextAlign, setFooterTextAlign] = useState("center");
  const [footerTextSize, setFooterTextSize] = useState("sm");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBadgeText(data.badge_text ?? "");
    setHeroTitle(data.hero_title);
    setHeroSubtitle(data.hero_subtitle ?? "");
    setIntroText(data.intro_text ?? "");
    setFooterText(data.footer_text ?? "");
    setHeroFont(data.hero_font ?? "sans");
    setHeroTextAlign(data.hero_text_align ?? "left");
    setHeroTitleSize(data.hero_title_size ?? "3xl");
    setHeroTitleWeight(data.hero_title_weight ?? "bold");
    setHeroSubtitleSize(data.hero_subtitle_size ?? "base");
    setIntroFont(data.intro_font ?? "sans");
    setIntroTextAlign(data.intro_text_align ?? "left");
    setIntroTextSize(data.intro_text_size ?? "base");
    setFooterFont(data.footer_font ?? "sans");
    setFooterTextAlign(data.footer_text_align ?? "center");
    setFooterTextSize(data.footer_text_size ?? "sm");
  }, [data]);

  const saveTexts = async () => {
    if (!heroTitle.trim()) {
      toast.error("O título do hero é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await adminService.patchPlansLanding({
        badge_text: badgeText.trim() === "" ? null : badgeText.trim(),
        hero_title: heroTitle.trim(),
        hero_subtitle: heroSubtitle.trim() === "" ? null : heroSubtitle.trim(),
        intro_text: introText.trim() === "" ? null : introText.trim(),
        footer_text: footerText.trim() === "" ? null : footerText.trim(),
        hero_font: heroFont,
        hero_text_align: heroTextAlign,
        hero_title_size: heroTitleSize,
        hero_title_weight: heroTitleWeight,
        hero_subtitle_size: heroSubtitleSize,
        intro_font: introFont,
        intro_text_align: introTextAlign,
        intro_text_size: introTextSize,
        footer_font: footerFont,
        footer_text_align: footerTextAlign,
        footer_text_size: footerTextSize,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Landing de planos atualizada.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    } finally {
      setSaving(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminService.uploadPlansHeroImage(file),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data?.message ?? "Imagem publicada.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => adminService.clearPlansHeroImage(),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Imagem do hero removida.");
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      onInvalidateAdmin?.();
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/15">
        <CardHeader>
          <CardTitle className="text-lg">Landing da página de planos</CardTitle>
          <CardDescription>A carregar…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Landing da página de planos</CardTitle>
          <CardDescription>Não foi possível carregar a configuração.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previewAt = data.updated_at;

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Landing da página de planos
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Textos, imagem de fundo e tipografia (fonte, alinhamento, tamanhos). A pré-visualização à direita replica{" "}
              <span className="font-medium text-foreground">/planos</span>.
            </CardDescription>
          </div>
          <Button type="button" className="gap-2 shrink-0" disabled={saving} onClick={() => saveTexts()}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-5 p-6 lg:border-r border-border/60">
            <div className="space-y-2">
              <Label htmlFor="pl-badge">Selo / etiqueta (opcional)</Label>
              <Input
                id="pl-badge"
                placeholder="Ex.: Planos e preços"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-title">Título principal</Label>
              <Input id="pl-title" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-sub">Subtítulo</Label>
              <Textarea
                id="pl-sub"
                rows={3}
                placeholder="Uma frase que explica o valor dos planos…"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="resize-y min-h-[72px]"
              />
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Type className="h-4 w-4 text-primary" />
                Tipografia do hero
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={heroFont} onValueChange={setHeroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={heroTextAlign} onValueChange={setHeroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho do título</Label>
                  <Select value={heroTitleSize} onValueChange={setHeroTitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_TITLE_SIZE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso do título</Label>
                  <Select value={heroTitleWeight} onValueChange={setHeroTitleWeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_WEIGHT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Tamanho do subtítulo</Label>
                  <Select value={heroSubtitleSize} onValueChange={setHeroSubtitleSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Imagem de fundo do hero</Label>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP até 2 MB.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Carregar imagem
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={!data.has_hero_image || clearMutation.isPending}
                  onClick={() => clearMutation.mutate()}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover imagem
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="pl-intro">Texto antes dos cartões (opcional)</Label>
              <Textarea
                id="pl-intro"
                rows={4}
                placeholder="Parágrafo curto acima da grelha de planos…"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                className="resize-y"
              />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Tipografia do texto introdutório</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={introFont} onValueChange={setIntroFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={introTextAlign} onValueChange={setIntroTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={introTextSize} onValueChange={setIntroTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pl-foot">Rodapé da secção (opcional)</Label>
              <Textarea
                id="pl-foot"
                rows={3}
                placeholder="Nota legal, garantias ou CTA final…"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="resize-y"
              />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Tipografia do rodapé</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={footerFont} onValueChange={setFooterFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_FONT.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento</Label>
                  <Select value={footerTextAlign} onValueChange={setFooterTextAlign}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_ALIGN.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={footerTextSize} onValueChange={setFooterTextSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_BODY.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/20 p-6 lg:min-h-[520px]">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Pré-visualização ao vivo
            </div>
            <HeroPreview
              badgeText={badgeText}
              heroTitle={heroTitle || "…"}
              heroSubtitle={heroSubtitle}
              hasImage={data.has_hero_image}
              imageUpdatedAt={previewAt}
              heroFont={heroFont}
              heroTextAlign={heroTextAlign}
              heroTitleSize={heroTitleSize}
              heroTitleWeight={heroTitleWeight}
              heroSubtitleSize={heroSubtitleSize}
            />
            {introText.trim() ? (
              <div
                className={cn(
                  "mt-4 rounded-lg border border-border/60 bg-card/80 p-4 whitespace-pre-line",
                  plansLandingIntroClasses({
                    font: coerceFontFamily(introFont),
                    align: coerceTextAlign(introTextAlign),
                    size: coerceBodySize(introTextSize),
                  }),
                )}
              >
                {introText}
              </div>
            ) : (
              <p className="mt-4 text-xs italic text-muted-foreground">Sem texto introdutório.</p>
            )}
            {footerText.trim() ? (
              <div
                className={cn(
                  "mt-3 rounded-md border border-dashed border-border/80 bg-muted/30 p-3 whitespace-pre-line",
                  plansLandingFooterClasses({
                    font: coerceFontFamily(footerFont),
                    align: coerceTextAlign(footerTextAlign),
                    size: coerceBodySize(footerTextSize),
                  }),
                )}
              >
                {footerText}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
