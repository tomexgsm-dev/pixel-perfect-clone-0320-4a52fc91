import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Plus, Flame, Globe, Mail, Phone, Loader2, Trash2, BarChart3, Filter,
} from "lucide-react";
import {
  Lead, fetchLeads, insertLead, updateLead, deleteLead, analyzeWebsite,
} from "@/lib/api/leads";

type FilterType = "all" | "no-website" | "weak-site" | "has-email" | "opportunity";

export default function LeadFinderPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Add lead modal
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState({ company_name: "", city: "", website: "", phone: "", email: "" });

  // Email modal
  const [emailModal, setEmailModal] = useState<Lead | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchLeads();
      setLeads(data);
    } catch (e: any) {
      toast.error("Błąd ładowania leadów: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter((l) => {
    switch (filter) {
      case "no-website": return !l.website;
      case "weak-site": return l.site_score != null && l.site_score < 50;
      case "has-email": return !!l.email;
      case "opportunity": return l.opportunity;
      default: return true;
    }
  });

  const handleAdd = async () => {
    if (!newLead.company_name.trim()) { toast.error("Podaj nazwę firmy"); return; }
    try {
      await insertLead(newLead);
      setShowAdd(false);
      setNewLead({ company_name: "", city: "", website: "", phone: "", email: "" });
      toast.success("Lead dodany");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAnalyze = async (lead: Lead) => {
    if (!lead.website) { toast.error("Brak strony do analizy"); return; }
    setAnalyzingId(lead.id);
    try {
      const result = await analyzeWebsite(lead.website);
      const updates: Partial<Lead> = {
        site_score: result.score,
        site_status: result.status,
        site_summary: result.summary,
      };
      if (result.email && !lead.email) {
        updates.email = result.email;
      }
      await updateLead(lead.id, updates);
      toast.success(`Analiza zakończona: ${result.score}/100`);
      load();
    } catch (e: any) {
      toast.error("Błąd analizy: " + e.message);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLead(id);
      toast.success("Lead usunięty");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEmailModal = (lead: Lead) => {
    setEmailModal(lead);
    setEmailSubject(`Poprawa strony internetowej dla ${lead.company_name}`);
    setEmailBody(
      `Dzień dobry,\n\nprzeanalizowaliśmy stronę Państwa firmy${lead.website ? ` (${lead.website})` : ""} i zauważyliśmy obszary do poprawy, które mogą zwiększyć liczbę klientów.\n\nChętnie pokażemy konkretne propozycje ulepszeń.\n\nCzy możemy się skontaktować?\n\nPozdrawiam`
    );
  };

  const handleAutoAnalyze = async () => {
    const toAnalyze = leads.filter((l) => l.website && l.site_score == null).slice(0, 20);
    if (!toAnalyze.length) { toast.info("Brak stron do analizy"); return; }
    toast.info(`Analizuję ${toAnalyze.length} stron...`);
    for (const lead of toAnalyze) {
      await handleAnalyze(lead);
    }
    toast.success("Automatyczna analiza zakończona");
  };

  const statusBadge = (s: string | null) => {
    if (!s) return null;
    const colors: Record<string, string> = {
      good: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      average: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      bad: "bg-red-500/20 text-red-300 border-red-500/30",
    };
    return <Badge className={colors[s] || ""}>{s}</Badge>;
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "Wszystkie" },
    { key: "no-website", label: "Brak strony" },
    { key: "weak-site", label: "Słaba strona" },
    { key: "has-email", label: "Ma email" },
    { key: "opportunity", label: "🔥 Opportunity" },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Search className="w-8 h-8 text-primary" />
              LeadFinder
            </h1>
            <p className="text-muted-foreground mt-1">
              Znajdź firmy bez strony lub ze słabą stroną — generuj leady automatycznie
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAutoAnalyze}>
              <BarChart3 className="w-4 h-4 mr-1" /> Auto-analiza
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Dodaj lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Filter className="w-4 h-4 mt-2 text-muted-foreground" />
          {filterButtons.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {filtered.length} / {leads.length} leadów
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Firma</TableHead>
                  <TableHead>Miasto</TableHead>
                  <TableHead>Strona</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ocena</TableHead>
                  <TableHead>Opp.</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      Brak leadów — dodaj pierwszy lead klikając "Dodaj lead"
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.company_name}</TableCell>
                      <TableCell>{lead.city || "—"}</TableCell>
                      <TableCell>
                        {lead.website ? (
                          <a
                            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3" /> ✅
                          </a>
                        ) : (
                          <span className="text-red-400">❌</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.email ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(lead.site_status)}</TableCell>
                      <TableCell>
                        {lead.site_score != null ? (
                          <span className={lead.site_score < 40 ? "text-red-400 font-bold" : lead.site_score < 70 ? "text-yellow-400" : "text-emerald-400"}>
                            {lead.site_score}/100
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.opportunity && <Flame className="w-5 h-5 text-orange-400" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {lead.website && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAnalyze(lead)}
                              disabled={analyzingId === lead.id}
                            >
                              {analyzingId === lead.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <BarChart3 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {lead.email && (
                            <Button size="sm" variant="ghost" onClick={() => openEmailModal(lead)}>
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(lead.id)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj nowy lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nazwa firmy *" value={newLead.company_name} onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })} />
            <Input placeholder="Miasto" value={newLead.city} onChange={(e) => setNewLead({ ...newLead, city: e.target.value })} />
            <Input placeholder="Strona WWW" value={newLead.website} onChange={(e) => setNewLead({ ...newLead, website: e.target.value })} />
            <Input placeholder="Telefon" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
            <Input placeholder="Email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Anuluj</Button>
            <Button onClick={handleAdd}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={!!emailModal} onOpenChange={() => setEmailModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wyślij mail do {emailModal?.company_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Do: {emailModal?.email}</label>
            </div>
            <Input
              placeholder="Temat"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <Textarea
              placeholder="Treść wiadomości"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={8}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailModal(null)}>Anuluj</Button>
            <Button
              onClick={() => {
                if (emailModal?.email) {
                  window.open(
                    `mailto:${emailModal.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
                    "_blank"
                  );
                }
                setEmailModal(null);
              }}
            >
              <Mail className="w-4 h-4 mr-1" /> Otwórz klienta email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
