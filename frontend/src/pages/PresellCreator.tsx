import { useState } from "react";
import { FileText, Eye, Save, Layout, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

const templates = [
  { id: "vsl", name: "VSL (Video Sales Letter)", description: "Página com vídeo de vendas + CTA forte", color: "from-primary to-accent" },
  { id: "dtc", name: "DTC (Direct to Consumer)", description: "Página direta com texto persuasivo", color: "from-success to-primary" },
  { id: "tsl", name: "TSL (Text Sales Letter)", description: "Carta de vendas longa e detalhada", color: "from-warning to-destructive" },
];

export default function PresellCreator() {
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    salesText: "",
    ctaText: "Quero Aproveitar Agora!",
    destinationLink: "",
    template: "",
    videoUrl: "",
  });

  const [activeTab, setActiveTab] = useState("editor");

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.title || !formData.destinationLink) {
      toast.error("Preencha o título e o link de destino.");
      return;
    }
    toast.success("Presell salva com sucesso! Link gerado.");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Criar Presell"
        description="Monte sua página de presell em minutos"
        actions={
          <>
            <Button variant="outline" onClick={() => setActiveTab("preview")} className="gap-2">
              <Eye className="h-4 w-4" /> Pré-visualizar
            </Button>
            <Button onClick={handleSave} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
              <Save className="h-4 w-4" /> Salvar Página
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="templates" className="gap-2"><Sparkles className="h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="editor" className="gap-2"><FileText className="h-4 w-4" /> Editor</TabsTrigger>
          <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" /> Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  updateField("template", t.id);
                  setActiveTab("editor");
                }}
                className={`relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200 hover:shadow-card-hover ${formData.template === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${t.color} opacity-10 rounded-bl-full`} />
                <Layout className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-card-foreground">{t.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                {formData.template === t.id && (
                  <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                    Selecionado
                  </span>
                )}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="editor" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título Principal</Label>
                <Input id="title" placeholder="Ex: Descubra o Segredo para..." value={formData.title} onChange={(e) => updateField("title", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input id="subtitle" placeholder="Ex: Milhares de pessoas já..." value={formData.subtitle} onChange={(e) => updateField("subtitle", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-select">Tipo da Presell</Label>
              <Select value={formData.template} onValueChange={(v) => updateField("template", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.template === "vsl") && (
              <div className="space-y-2">
                <Label htmlFor="video">URL do Vídeo (YouTube/Vimeo)</Label>
                <Input id="video" placeholder="https://youtube.com/watch?v=..." value={formData.videoUrl} onChange={(e) => updateField("videoUrl", e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="salesText">Texto de Vendas</Label>
              <Textarea id="salesText" placeholder="Escreva seu texto persuasivo aqui..." rows={6} value={formData.salesText} onChange={(e) => updateField("salesText", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cta">Texto do Botão CTA</Label>
                <Input id="cta" placeholder="Ex: Comprar Agora" value={formData.ctaText} onChange={(e) => updateField("ctaText", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link">Link de Destino (Afiliado)</Label>
                <Input id="link" placeholder="https://..." value={formData.destinationLink} onChange={(e) => updateField("destinationLink", e.target.value)} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">https://dclickora.com/p/sua-presell</span>
            </div>
            <div className="p-6 sm:p-8 md:p-12 w-full max-w-4xl mx-auto text-center space-y-6">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {formData.title || "Seu Título Aparecerá Aqui"}
              </h1>
              <p className="text-lg text-muted-foreground">
                {formData.subtitle || "Seu subtítulo persuasivo aqui"}
              </p>
              {formData.template === "vsl" && (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">🎬 Player de Vídeo</span>
                </div>
              )}
              <p className="text-foreground/80 leading-relaxed whitespace-pre-line">
                {formData.salesText || "Seu texto de vendas aparecerá aqui. Escreva algo persuasivo para converter seus visitantes..."}
              </p>
              <button className="inline-flex items-center gap-2 gradient-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg">
                {formData.ctaText || "Botão CTA"} <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
