import { useState } from "react";
import { Search, Trash2, RotateCcw, AlertTriangle, RefreshCw, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

type AccessRow = {
  ip: string;
  clickId: string;
  keyword: string;
  lastAccess: string;
  firstAccess: string;
  visits: number;
  device: string;
  origin: string;
  type: string;
  country: string;
  region: string;
  status: string;
  blocked: boolean;
};

type ClickRow = {
  ip: string;
  clickId: string;
  keyword: string;
  lastAccess: string;
  firstAccess: string;
  device: string;
  origin: string;
  type: string;
  country: string;
  region: string;
  status: string;
};

type ConversionRow = {
  date: string;
  clickId: string;
  keyword: string;
  commission: string;
  platform: string;
  synced: boolean;
};

type NoGclidRow = {
  date: string;
  clickId: string;
  keyword: string;
  commission: string;
  platform: string;
};

const accessData: AccessRow[] = [];
const clickData: ClickRow[] = [];
const conversionData: ConversionRow[] = [];
const noGclidData: NoGclidRow[] = [];

export default function Relatorios() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [platform, setPlatform] = useState("");
  const [gclid, setGclid] = useState("");
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [perPage, setPerPage] = useState("10");

  const currentTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const toggleRow = (index: number) => {
    setSelectedRows(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  const handleDeleteSelected = () => {
    toast.success(`${selectedRows.length} registro(s) excluído(s).`);
    setSelectedRows([]);
  };

  const handleResync = (index: number) => {
    toast.success("Re-sincronização iniciada...");
  };

  const UsageLimitBar = () => (
    <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Uso da ferramenta para rastreio dos endereços de IP</span>
        <span className="text-sm font-medium text-muted-foreground">—</span>
      </div>
      <Progress value={0} className="h-2.5" />
    </div>
  );

  const TimezoneAlert = () => (
    <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-card-foreground">
          <span className="text-warning">Atenção:</span> O horário atual da sua instalação é <span className="text-primary font-bold">{currentTime}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Para os horários dos cliques serem exatos, tenha certeza de que o horário da sua instalação esteja correto.
        </p>
      </div>
    </div>
  );

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Relatórios"
        description="Visualize dados detalhados de acessos, cliques e conversões."
      />

      <Tabs defaultValue="acessos">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
          <TabsTrigger value="cliques">Cliques</TabsTrigger>
          <TabsTrigger value="conversoes">Conversões</TabsTrigger>
          <TabsTrigger value="sem-gclid">Conversões sem Click ID</TabsTrigger>
        </TabsList>

        {/* ========== ACESSOS ========== */}
        <TabsContent value="acessos" className="mt-6 space-y-4">
          <UsageLimitBar />
          <TimezoneAlert />

          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Data inicial</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Search className="h-4 w-4" /> Pesquisar
              </Button>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Redefinir
              </Button>
              <Button variant="outline" onClick={handleDeleteSelected} disabled={selectedRows.length === 0} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Excluir selecionados
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select value={perPage} onValueChange={setPerPage}>
                  <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">registros por página</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-3 w-8"><input type="checkbox" className="rounded border-border" /></th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Click ID</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Palavra chave</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Último acesso</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Primeiro acesso</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Qtd. Visitas</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Dispositivo</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Origem</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">País</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Região</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {accessData.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum registo a mostrar.
                      </td>
                    </tr>
                  ) : (
                    accessData.map((row, i) => (
                      <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedRows.includes(i) ? "bg-primary/5" : ""}`}>
                        <td className="py-2.5 px-3"><input type="checkbox" checked={selectedRows.includes(i)} onChange={() => toggleRow(i)} className="rounded border-border" /></td>
                        <td className="py-2.5 px-3 font-mono text-xs text-card-foreground max-w-[130px] truncate">{row.ip}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-card-foreground max-w-[150px] truncate">{row.clickId}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{row.lastAccess}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{row.firstAccess}</td>
                        <td className="py-2.5 px-3 text-card-foreground text-center">{row.visits}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.origin}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${row.type === "Pago" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.country}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">{row.status}</span>
                        </td>
                        <td className="py-2.5 px-3"><input type="checkbox" checked={row.blocked} className="rounded border-border" readOnly /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{accessData.length === 0 ? "Nenhum registo" : `Mostrando 1 até ${accessData.length} de ${accessData.length} registros`}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Anterior</Button>
                <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Próximo</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========== CLIQUES ========== */}
        <TabsContent value="cliques" className="mt-6 space-y-4">
          <UsageLimitBar />
          <TimezoneAlert />

          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Data inicial</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Search className="h-4 w-4" /> Pesquisar
              </Button>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Redefinir
              </Button>
              <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Excluir selecionados
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mostrar 10 registros por página</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." className="pl-9 w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-3 w-8"><input type="checkbox" className="rounded border-border" /></th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Click ID</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Palavra chave</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Último acesso</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Primeiro acesso</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Dispositivo</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Origem</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">País</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Região</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {clickData.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum registo a mostrar.
                      </td>
                    </tr>
                  ) : (
                    clickData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3"><input type="checkbox" className="rounded border-border" /></td>
                        <td className="py-2.5 px-3 font-mono text-xs text-card-foreground max-w-[130px] truncate">{row.ip}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-card-foreground max-w-[150px] truncate">{row.clickId}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{row.lastAccess}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{row.firstAccess}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.device}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.origin}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${row.type === "Pago" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{row.type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.country}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.region}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">{row.status}</span>
                        </td>
                        <td className="py-2.5 px-3"><input type="checkbox" className="rounded border-border" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{clickData.length === 0 ? "Nenhum registo" : `Mostrando 1 até ${clickData.length} de ${clickData.length} registros`}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Anterior</Button>
                <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Próximo</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========== CONVERSÕES ========== */}
        <TabsContent value="conversoes" className="mt-6 space-y-4">
          <UsageLimitBar />

          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Selecione a plataforma</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma plataforma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="buygoods">BuyGoods</SelectItem>
                    <SelectItem value="clickbank">ClickBank</SelectItem>
                    <SelectItem value="smartadv">SmartAdv</SelectItem>
                    <SelectItem value="hotmart">Hotmart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label>Informe o GCLID</Label>
                <Input placeholder="GCLID" value={gclid} onChange={(e) => setGclid(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data inicial</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Search className="h-4 w-4" /> Pesquisar
              </Button>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Redefinir
              </Button>
              <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Excluir selecionados
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mostrar 10 registros por página</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." className="pl-9 w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-3 w-8"><input type="checkbox" className="rounded border-border" /></th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Data da conversão</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Click ID</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Palavra chave</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comissão</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Plataforma</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Sync</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum registo a mostrar.
                      </td>
                    </tr>
                  ) : (
                    conversionData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3"><input type="checkbox" className="rounded border-border" /></td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">{row.date}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-primary max-w-[200px] truncate cursor-pointer hover:underline">{row.clickId}</td>
                        <td className="py-2.5 px-3 text-primary text-xs cursor-pointer hover:underline">{row.keyword || "—"}</td>
                        <td className="py-2.5 px-3 font-semibold text-success">{row.commission}</td>
                        <td className="py-2.5 px-3 text-card-foreground">{row.platform}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.synced ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                            {row.synced ? "✓" : "⏳"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleResync(i)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary" title="Re-sincronizar">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Excluir">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{conversionData.length === 0 ? "Nenhum registo" : `Mostrando 1 até ${conversionData.length} de ${conversionData.length} registros`}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Anterior</Button>
                <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Próximo</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========== SEM GCLID ========== */}
        <TabsContent value="sem-gclid" className="mt-6 space-y-4">
          <UsageLimitBar />

          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Selecione a plataforma</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecione uma plataforma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="clickbank">ClickBank</SelectItem>
                    <SelectItem value="buygoods">BuyGoods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label>Informe o GCLID</Label>
                <Input placeholder="GCLID" />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data inicial</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Data final</Label>
                <Input type="date" />
              </div>
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Search className="h-4 w-4" /> Pesquisar
              </Button>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Redefinir
              </Button>
              <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Excluir selecionados
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mostrar 10 registros por página</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." className="pl-9 w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-3 w-8"><input type="checkbox" className="rounded border-border" /></th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Data da conversão</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Click ID</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Palavra chave</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comissão</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Plataforma</th>
                  </tr>
                </thead>
                <tbody>
                  {noGclidData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum registo a mostrar.
                      </td>
                    </tr>
                  ) : (
                    noGclidData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3"><input type="checkbox" className="rounded border-border" /></td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.date}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-card-foreground">{row.clickId || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.keyword || "—"}</td>
                        <td className="py-2.5 px-3 font-semibold text-success">{row.commission}</td>
                        <td className="py-2.5 px-3 text-card-foreground">{row.platform}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{noGclidData.length === 0 ? "Nenhum registo" : `Mostrando 1 até ${noGclidData.length} de ${noGclidData.length} registros`}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Anterior</Button>
                <Button size="sm" className="h-7 text-xs gradient-primary border-0 text-primary-foreground">1</Button>
                <Button variant="outline" size="sm" disabled className="h-7 text-xs">Próximo</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
