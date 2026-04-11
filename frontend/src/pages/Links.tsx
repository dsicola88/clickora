import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Copy, ExternalLink, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { presellService } from "@/services/presellService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { getApiBaseUrl } from "@/lib/apiOrigin";

interface TrackingLink {
  id: string;
  name: string;
  presellId: string;
  presellSlug: string;
  originalUrl: string;
  trackingUrl: string;
  createdAt: string;
}

export default function Links() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [selectedPresellId, setSelectedPresellId] = useState("");
  const [source, setSource] = useState("google_ads");
  const [medium, setMedium] = useState("cpc");
  const [campaign, setCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: presells = [] } = useQuery({
    queryKey: ["presells-links"],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const publishedPresells = presells.filter((p) => p.status === "published");

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = () => {
    if (!newName || !newUrl || !selectedPresellId) {
      toast.error("Preencha nome, URL e presell.");
      return;
    }
    const selected = publishedPresells.find((p) => p.id === selectedPresellId);
    if (!selected) {
      toast.error("Selecione uma presell válida.");
      return;
    }

    const query = new URLSearchParams({
      to: newUrl,
      source,
      medium,
      campaign,
      utm_term: utmTerm,
      utm_content: utmContent,
    });
    const trackingUrl = `${apiBase}/track/r/${selectedPresellId}?${query.toString()}`;

    const newLink: TrackingLink = {
      id: Date.now().toString(),
      name: newName,
      presellId: selectedPresellId,
      presellSlug: selected.slug,
      originalUrl: newUrl,
      trackingUrl,
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };
    setLinks([newLink, ...links]);
    setNewName("");
    setNewUrl("");
    setCampaign("");
    setUtmTerm("");
    setUtmContent("");
    setDialogOpen(false);
    toast.success("Link de tracking completo criado!");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Links"
        description="Gerencie e compartilhe seus links de tracking com parâmetros UTM."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Link de Tracking</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome do Link</Label>
                <Input placeholder="Ex: Campanha Facebook" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Presell de destino</Label>
                <Select value={selectedPresellId} onValueChange={setSelectedPresellId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma presell publicada" /></SelectTrigger>
                  <SelectContent>
                    {publishedPresells.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL de Destino</Label>
                <Input placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input value={source} onChange={(e) => setSource(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Medium</Label>
                  <Input value={medium} onChange={(e) => setMedium(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Campaign</Label>
                <Input placeholder="campanha-maio" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>UTM Term</Label>
                  <Input placeholder="keyword opcional" value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>UTM Content</Label>
                  <Input placeholder="criativo opcional" value={utmContent} onChange={(e) => setUtmContent(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full gradient-primary border-0 text-primary-foreground hover:opacity-90">
                Criar Link
              </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-3">
        {links.map((link) => (
          <div key={link.id} className="bg-card rounded-xl p-4 md:p-5 shadow-card border border-border/50 hover:shadow-card-hover transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="gradient-primary rounded-lg p-2 flex-shrink-0">
                  <Link2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-card-foreground text-sm">{link.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{`${link.presellSlug} -> ${link.originalUrl}`}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 flex-shrink-0">
                <span className="text-sm font-mono text-card-foreground">{link.trackingUrl}</span>
                <button onClick={() => handleCopy(link.trackingUrl, link.id)} className="text-primary hover:text-primary/80 transition-colors">
                  {copiedId === link.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{link.createdAt}</p>
                </div>
                <div className="flex gap-1">
                  <a href={link.trackingUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
