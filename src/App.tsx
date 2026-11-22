import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart3, Bell, Building2, Check, ChevronRight, CircleDollarSign, Clock3,
  Download, Eye, FileCheck2, FileText, Instagram, LayoutDashboard, Menu, Moon,
  Plus, Printer, ReceiptText, Search, Send, Settings, Share2, Sun, Trash2, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getSavedQuotations, saveDraft, updateDraft, getDrafts, saveQuotation, convertDraftToQuotation, type StoredQuotation } from "@/services/quotation-service";

type Item = { id: number; description: string; unit: string; quantity: number; rate: number };
type View = "dashboard" | "quotes" | "invoices" | "payments" | "clients" | "settings";

const services = ["Architectural drawing & approvals", "Site clearing and setting out", "Reinforced concrete foundation", "Blockwork and structural frame", "Roofing and rainwater system", "Electrical and plumbing installation", "Finishes and handover"];
const defaultTerms = [
  "Prices cover only the listed scope of work.",
  "Changes require written approval and may change the cost.",
  "A deposit is required before work begins.",
  "Payment follows the currency shown on this document.",
  "The client will provide access, approvals, and accurate details.",
  "Disputes should first be resolved amicably under Nigerian law.",
].join("\n");

function getSavedTheme() {
  try {
    return localStorage.getItem("babc_theme") === "dark";
  } catch (error) {
    console.error("Unable to read the saved theme preference:", error);
    return false;
  }
}

// Load quotations from storage
function getStoredQuotationsForDisplay() {
  const quotations = getSavedQuotations();
  return quotations.map(q => ({
    number: q.quotationNumber,
    client: q.client.name,
    project: q.title,
    amount: q.total,
    status: q.status.charAt(0).toUpperCase() + q.status.slice(1),
    date: new Date(q.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  }));
}

const money = (value: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(value);

const getNextQuotationNumber = () => `BABC-Q-${String(getSavedQuotations().length + 1).padStart(4, "0")}`;
const formatDocumentDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function numberToWords(value: number) {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const units = ["", "thousand", "million", "billion", "trillion"];

  const underThousand = (number: number): string => {
    const words: string[] = [];
    if (number >= 100) {
      words.push(ones[Math.floor(number / 100)] ?? "");
      words.push("hundred");
      number %= 100;
      if (number) words.push("and");
    }
    if (number >= 20) {
      words.push(tens[Math.floor(number / 10)] ?? "");
      if (number % 10) words.push(ones[number % 10] ?? "");
    } else if (number > 0) {
      words.push(ones[number] ?? "");
    }
    return words.join(" ");
  };

  let remainder = Math.floor(Math.max(0, Number.isFinite(value) ? value : 0));
  if (remainder === 0) return "zero";
  const groups: string[] = [];
  let unitIndex = 0;
  while (remainder > 0) {
    const group = remainder % 1000;
    if (group > 0) {
      groups.unshift(`${underThousand(group)}${units[unitIndex] ? ` ${units[unitIndex]}` : ""}`);
    }
    remainder = Math.floor(remainder / 1000);
    unitIndex += 1;
  }
  return groups.join(" ");
}

function amountInWords(value: number, currency: string) {
  const amount = Math.max(0, Number.isFinite(value) ? value : 0);
  let whole = Math.floor(amount);
  let cents = currency === "USD" ? Math.round((amount - whole) * 100) : 0;
  if (cents === 100) {
    whole += 1;
    cents = 0;
  }
  const unit = currency === "USD" ? "US dollars" : "naira";
  return `${numberToWords(whole)} ${unit}${cents ? ` and ${numberToWords(cents)} cents` : ""}`;
}

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getCurrentDate = () => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 rounded-lg border border-border bg-white p-1">
        <img src="/B.A.B.C LOGO.png" alt="B.A.B.C Logo" className="size-9 object-contain" />
      </div>
      
      {!compact && (
        <div>
          <p className="font-brand text-sm font-bold leading-none text-foreground">B.A.B.C</p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">From Vision to Legacy</p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = status === "Accepted" || status === "Paid" ? "bg-success/10 text-success" : status === "Sent" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold", styles)}>{status}</span>;
}

function QuotationApp() {
  const [view, setView] = useState<View>("dashboard");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);
  const [quotationNumber, setQuotationNumber] = useState(getNextQuotationNumber);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const [terms, setTerms] = useState(defaultTerms);
  const [isDarkMode, setIsDarkMode] = useState(getSavedTheme);
  const [currency, setCurrency] = useState("NGN");
  const [client, setClient] = useState({ name: "", company: "", phone: "", address: "" });
  const [title, setTitle] = useState("");
  const [discount, setDiscount] = useState(0);
  const [depositPct, setDepositPct] = useState(40);
  const [exchangeRate, setExchangeRate] = useState(1600);
  const [items, setItems] = useState<Item[]>([]);
  const documentRef = useRef<HTMLDivElement>(null);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.rate, 0), [items]);
  const total = Math.max(0, subtotal - discount);
  const deposit = total * (depositPct / 100);
  const converted = currency === "NGN" ? total / exchangeRate : total * exchangeRate;

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    try {
      localStorage.setItem("babc_theme", isDarkMode ? "dark" : "light");
    } catch (error) {
      console.error("Unable to save the theme preference:", error);
    }
  }, [isDarkMode]);

  // Auto-save draft every 30 seconds when editing
  useEffect(() => {
    if (!editorOpen || !title || items.length === 0) return;
    
    const interval = setInterval(() => {
      const draftData = {
        quotationNumber: currentQuotationId || "DRAFT-" + Date.now(),
        title,
        client,
        items,
        currency,
        discount,
        depositPct,
        exchangeRate,
        subtotal,
        total,
        terms,
        status: "draft" as const,
      };
      
      if (currentQuotationId?.startsWith("draft_")) {
        updateDraft(currentQuotationId, draftData);
      } else {
        const saved = saveDraft(draftData);
        setCurrentQuotationId(saved.id);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [editorOpen, title, client, items, currency, discount, depositPct, exchangeRate, subtotal, total, terms, currentQuotationId]);

  // Save quotation function
  const saveCurrentQuotation = () => {
    if (!title || items.length === 0 || !client.name) {
      notify("Please fill in all required fields");
      return false;
    }

    const now = new Date();
    const number = getNextQuotationNumber();
    const quotationData = {
      quotationNumber: number,
      title,
      client,
      items,
      currency,
      discount,
      depositPct,
      exchangeRate,
      subtotal,
      total,
      terms,
      status: "sent" as const,
    };

    const saved = saveQuotation(quotationData);
    setQuotationNumber(number);
    setIssuedAt(now);
    console.log("✓ Quotation saved:", saved);
    console.log("✓ Total saved quotations:", getSavedQuotations().length);
    setCurrentQuotationId(saved.id);
    setPreviewOpen(false); // Close preview if open
    setEditorOpen(false); // Close editor after saving
    notify("✓ Quotation saved successfully!");
    return true;
  };

  // Create new quotation
  const newQuotation = () => {
    setCurrentQuotationId(null);
    setQuotationNumber(getNextQuotationNumber());
    setIssuedAt(new Date());
    setTitle("");
    setClient({ name: "", company: "", phone: "", address: "" });
    setItems([]);
    setDiscount(0);
    setTerms(defaultTerms);
    setEditorOpen(true);
    notify("New quotation created");
  };
  const openSavedQuotation = (quotation: StoredQuotation) => {
    const savedDate = new Date(quotation.createdAt);
    setCurrentQuotationId(quotation.id);
    setQuotationNumber(quotation.quotationNumber);
    setIssuedAt(Number.isNaN(savedDate.getTime()) ? new Date() : savedDate);
    setCurrency(quotation.currency);
    setClient(quotation.client);
    setTitle(quotation.title);
    setItems(quotation.items);
    setDiscount(quotation.discount);
    setDepositPct(quotation.depositPct);
    setExchangeRate(quotation.exchangeRate);
    setTerms(quotation.terms || defaultTerms);
    setEditorOpen(false);
    setPreviewOpen(true);
    setMenuOpen(false);
  };
  const updateItem = (id: number, key: keyof Item, value: string | number) => setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const addItem = () => setItems((current) => [...current, { id: Date.now(), description: services[4] ?? "New construction item", unit: "lump sum", quantity: 1, rate: 0 }]);
  const notify = (message: string) => setNotice(message);
  const exportJpeg = async () => {
    const receipt = documentRef.current;
    if (!receipt) {
      notify("Receipt is not ready to export.");
      return;
    }
    try {
      const data = await toJpeg(receipt, { quality: .96, pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
      const link = document.createElement("a");
      link.download = `${quotationNumber}.jpg`;
      link.href = data;
      link.click();
      notify("JPEG ready for WhatsApp");
    } catch (error) {
      console.error("Failed to export receipt as JPEG:", error);
      notify("Could not export JPEG. Please try again.");
    }
  };
  const exportPdf = async () => {
    const receipt = documentRef.current;
    if (!receipt) {
      notify("Receipt is not ready to export.");
      return;
    }
    try {
      const documentHeight = Math.max(210, receipt.scrollHeight * 25.4 / 96);
      const data = await toJpeg(receipt, { quality: .98, pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
      const pdf = new jsPDF({ unit: "mm", format: [148, documentHeight], orientation: "portrait" });
      pdf.addImage(data, "JPEG", 0, 0, 148, documentHeight);
      pdf.save(`${quotationNumber}.pdf`);
      notify("PDF downloaded");
    } catch (error) {
      console.error("Failed to export receipt as PDF:", error);
      notify("Could not export PDF. Please try again.");
    }
  };
  const shareWhatsApp = () => { const text = encodeURIComponent(`Hello ${client.name}, your B.A.B.C quotation ${quotationNumber} for ${title} is ready. Total: ${money(total, currency)}.`); window.open(`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${text}`, "_blank", "noopener,noreferrer"); };

  const nav = [
    ["dashboard", LayoutDashboard, "Overview"], ["quotes", FileText, "Quotations"], ["invoices", ReceiptText, "Invoices"],
    ["payments", CircleDollarSign, "Payments"], ["clients", Users, "Clients"], ["settings", Settings, "Settings"],
  ] as const;

  return <div className="min-h-screen bg-background text-foreground">
    {notice && <div className="fixed left-1/2 top-5 z-[70] -translate-x-1/2 rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-xl"><Check className="mr-2 inline size-4" />{notice}</div>}
    <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card px-4 py-5 transition-transform lg:translate-x-0", menuOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between px-2"><BrandMark /><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></Button></div>
      <nav className="mt-10 space-y-1">{nav.map(([id, Icon, label]) => <button key={id} onClick={() => { setView(id); setMenuOpen(false); }} className={cn("flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors", view === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" />{label}</button>)}</nav>
      <div className="absolute bottom-5 left-4 right-4 border-t border-border pt-4"><p className="text-xs font-bold">Engr. K.I Hillary</p><p className="text-[11px] text-muted-foreground">Super Admin</p></div>
    </aside>
    <main className="min-w-0 overflow-x-hidden lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></Button><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation Studio</p><p className="font-brand text-sm font-bold">B.A.B.C</p></div></div>
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setIsDarkMode((dark) => !dark)} aria-label={`Switch to ${isDarkMode ? "day" : "night"} mode`} title={`Switch to ${isDarkMode ? "day" : "night"} mode`}>{isDarkMode ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button><Button variant="gold" onClick={newQuotation}><Plus /> New quotation</Button></div>
      </header>

      {view === "dashboard" && <Dashboard onCreate={newQuotation} onView={() => setView("quotes")} onPreview={openSavedQuotation} />}
      {view === "quotes" && <Quotations onCreate={newQuotation} onPreview={openSavedQuotation} />}
      {view === "invoices" && <EmptyView icon={ReceiptText} title="Invoices" text="Accepted quotations become trackable invoices here." action="Create from quotation" onAction={() => setView("quotes")} />}
      {view === "payments" && <EmptyView icon={CircleDollarSign} title="Payment tracking" text="Record deposits and balances in Naira or US Dollars." action="View invoices" onAction={() => setView("invoices")} />}
      {view === "clients" && <Clients />}
      {view === "settings" && <SettingsView exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} notify={notify} />}
    </main>

    {editorOpen && <div className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm"><div className="absolute inset-y-0 right-0 flex w-full max-w-4xl flex-col bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{quotationNumber}</p><h2 className="font-brand text-xl font-bold">New quotation</h2></div><Button variant="ghost" size="icon" onClick={() => setEditorOpen(false)} aria-label="Close editor"><X /></Button></div>
      <div className="flex-1 overflow-y-auto p-5 sm:p-8"><div className="grid gap-8 xl:grid-cols-[1fr_270px]">
        <div className="space-y-8"><section><SectionTitle number="01" title="Client & project" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Client name" value={client.name} onChange={(v) => setClient({...client,name:v})}/><Field label="Company name" value={client.company} onChange={(v) => setClient({...client,company:v})}/><Field label="Phone number" value={client.phone} onChange={(v) => setClient({...client,phone:v})}/><Field label="Project address" value={client.address} onChange={(v) => setClient({...client,address:v})}/><div className="sm:col-span-2"><Field label="Quotation title" value={title} onChange={setTitle}/></div></div></section>
        <section><div className="flex items-center justify-between"><SectionTitle number="02" title="Scope & pricing" /><Button variant="outline" size="sm" onClick={addItem}><Plus /> Add item</Button></div><div className="mt-4 space-y-3">{items.map((item, i) => <div key={item.id} className="grid gap-2 border-b border-border pb-4 sm:grid-cols-[28px_1fr_80px_120px_36px]"><span className="pt-2 text-xs font-bold text-muted-foreground">{String(i+1).padStart(2,"0")}</span><Input value={item.description} onChange={(e) => updateItem(item.id,"description",e.target.value)} aria-label={`Item ${i+1} description`} /><Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updateItem(item.id,"quantity",Number(e.target.value))} aria-label="Quantity" /><Input type="number" min="0" value={item.rate} onChange={(e) => updateItem(item.id,"rate",Number(e.target.value))} aria-label="Rate" /><Button variant="ghost" size="icon" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))} aria-label="Remove item"><Trash2 /></Button></div>)}</div></section>
        <section><SectionTitle number="03" title="Terms & conditions" /><Textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={6} /></section></div>
        <aside className="space-y-5"><div><Label>Document currency</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NGN">NGN — Nigerian Naira</SelectItem><SelectItem value="USD">USD — US Dollars</SelectItem></SelectContent></Select></div><Field label="Exchange rate (₦ / $)" value={String(exchangeRate)} type="number" onChange={(v) => setExchangeRate(Number(v))}/><Field label={`Discount (${currency})`} value={String(discount)} type="number" onChange={(v) => setDiscount(Number(v))}/><Field label="Deposit required (%)" value={String(depositPct)} type="number" onChange={(v) => setDepositPct(Number(v))}/><div className="border-t border-border pt-5"><SummaryRow label="Subtotal" value={money(subtotal,currency)}/><SummaryRow label="Discount" value={`− ${money(discount,currency)}`}/><div className="mt-4 bg-primary p-4 text-primary-foreground"><p className="text-xs font-semibold opacity-70">Grand total</p><p className="mt-1 text-xl font-bold">{money(total,currency)}</p><p className="mt-2 text-xs opacity-80">≈ {money(converted,currency === "NGN" ? "USD" : "NGN")}</p></div><SummaryRow label={`Deposit (${depositPct}%)`} value={money(deposit,currency)}/><SummaryRow label="Outstanding" value={money(total-deposit,currency)}/></div></aside>
      </div></div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:px-8"><Button variant="outline" onClick={newQuotation}><Plus /> New quotation</Button><Button variant="secondary" onClick={() => notify("Draft auto-saved")}><Clock3 /> Auto-saving</Button><Button onClick={() => { if (saveCurrentQuotation()) setPreviewOpen(true); }}><FileCheck2 /> Save & Preview</Button></div>
    </div></div>}

    {previewOpen && <div className="fixed inset-0 z-[60] overflow-y-auto bg-foreground/70 p-3 sm:p-8"><div className="mx-auto flex max-w-4xl flex-col items-center"><div className="no-print mb-4 flex w-full flex-wrap justify-between gap-2"><Button variant="secondary" onClick={() => setPreviewOpen(false)}><X /> Close</Button><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => window.print()}><Printer /> Print A5</Button><Button variant="secondary" onClick={exportPdf}><Download /> PDF</Button><Button variant="secondary" onClick={exportJpeg}><Download /> JPEG</Button><Button variant="gold" onClick={shareWhatsApp}><Share2 /> WhatsApp</Button></div></div><QuoteDocument ref={documentRef} client={client} title={title} items={items} currency={currency} subtotal={subtotal} discount={discount} total={total} deposit={deposit} depositPct={depositPct} converted={converted} quotationNumber={quotationNumber} issuedAt={issuedAt} terms={terms} /></div></div>}
  </div>;
}

export default QuotationApp;

function Dashboard({ onCreate, onView, onPreview }: { onCreate: () => void; onView: () => void; onPreview: (quotation: StoredQuotation) => void }) {
  const quotations = getSavedQuotations();
  const totalValue = quotations.reduce((sum, q) => sum + q.total, 0);
  const acceptedAmount = quotations.filter(q => q.status === "accepted").reduce((sum, q) => sum + q.total, 0);
  const acceptedCount = quotations.filter(q => q.status === "accepted").length;
  const paidAmount = quotations.filter(q => q.status === "paid").reduce((sum, q) => sum + q.total, 0);
  const outstandingAmount = quotations.filter(q => q.status !== "paid").reduce((sum, q) => sum + (q.total - q.total * q.depositPct / 100), 0);
  
  const stats = [
    ["Total quotations", money(totalValue), `${quotations.length} quotes`, FileText],
    ["Accepted", money(acceptedAmount), `${acceptedCount} deals`, FileCheck2],
    ["Payments received", money(paidAmount), quotations.filter(q => q.status === "paid").length + " paid", CircleDollarSign],
    ["Outstanding", money(outstandingAmount), "Awaiting payment", Clock3],
  ] as const;
  return <div className="mx-auto max-w-7xl p-4 sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{getCurrentDate()}</p><h1 className="mt-2 font-brand text-3xl font-bold sm:text-4xl">{getTimeGreeting()}, Hillary.</h1><p className="mt-2 text-sm text-muted-foreground">Your business at a glance.</p></div><Button onClick={onCreate}><Plus /> Create quotation</Button></div>
  <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label,value,meta,Icon]) => <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span></div><p className="mt-5 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{meta}</p></div>)}</div>
  <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[1.55fr_1fr]"><section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-brand font-bold">Recent quotations</h2><p className="mt-1 text-xs text-muted-foreground">Latest client activity</p></div><Button variant="ghost" size="sm" onClick={onView}>View all <ChevronRight /></Button></div><QuoteTable onSelect={onPreview} /></section><section className="min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">September performance</p><h2 className="mt-3 font-brand text-2xl font-bold text-foreground">61.6% acceptance rate</h2><div className="mt-8 flex h-36 items-end gap-3">{[32,55,43,78,62,91,70].map((v,i)=><div key={i} className="flex h-full flex-1 items-end rounded-t bg-muted"><div className="w-full rounded-t bg-primary" style={{height:`${v}%`}} /></div>)}</div><div className="mt-4 flex justify-between text-[10px] text-muted-foreground"><span>Week 1</span><span>Week 4</span></div><div className="mt-7 border-t border-border pt-5"><p className="text-xs text-muted-foreground">Next expiring quotation</p><p className="mt-1 text-sm font-semibold">BABC-Q-0027 · in 4 days</p></div></section></div></div>;
}

function QuoteTable({ onSelect, limit = 5 }: { onSelect: (quotation: StoredQuotation) => void; limit?: number }) {
  const quotations = getSavedQuotations()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="text-[10px] uppercase text-muted-foreground">{["Number / Client","Project","Amount","Status","Date","Receipt"].map(x=><th key={x} className="px-5 py-3 font-bold">{x}</th>)}</tr></thead><tbody>{quotations.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">No saved receipts yet. Create a quotation to start your history.</td></tr> : quotations.map(quotation=><tr key={quotation.id} className="border-t border-border text-sm"><td className="px-5 py-4"><p className="font-bold">{quotation.quotationNumber}</p><p className="text-xs text-muted-foreground">{quotation.client.name}</p></td><td className="px-5 py-4 text-xs">{quotation.title}</td><td className="px-5 py-4 font-bold">{money(quotation.total, quotation.currency)}</td><td className="px-5 py-4"><StatusPill status={quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}/></td><td className="px-5 py-4 text-xs text-muted-foreground">{formatDocumentDate(new Date(quotation.createdAt))}</td><td className="px-5 py-4"><Button variant="ghost" size="sm" onClick={() => onSelect(quotation)} aria-label={`Open receipt ${quotation.quotationNumber}`}><Eye className="mr-1 size-4" /> Open</Button></td></tr>)}</tbody></table></div>;
}

function Quotations({onCreate,onPreview}:{onCreate:()=>void;onPreview:(quotation:StoredQuotation)=>void}) { return <div className="mx-auto max-w-7xl p-4 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-highlight">Documents</p><h1 className="mt-2 font-brand text-3xl font-bold">Quotation history</h1></div><Button onClick={onCreate}><Plus /> New quotation</Button></div><div className="mt-8 flex gap-3"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Search quotation, client or project" /></div></div><div className="mt-5 overflow-hidden rounded-xl border border-border bg-card"><QuoteTable onSelect={onPreview} limit={Infinity} /></div></div> }

function Clients() { const quotes = getStoredQuotationsForDisplay(); return <div className="mx-auto max-w-7xl p-4 sm:p-8"><p className="text-xs font-bold uppercase text-highlight animate-fade-in">Relationships</p><h1 className="mt-2 font-brand text-3xl font-bold">Clients</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{quotes.slice(0,3).map((q,i)=><div className="border border-border bg-card p-5 rounded-lg shadow-md transition-smooth hover:shadow-xl hover:translate-y-[-4px] animate-scale-in" key={q.client} style={{animationDelay: `${i * 150}ms`}}><div className="flex items-start justify-between"><div className="grid size-11 place-items-center bg-gradient-to-br from-primary to-primary/80 font-brand font-bold text-primary-foreground rounded-lg">{q.client.charAt(0)}</div><StatusPill status={i===0?"Active":"Lead"}/></div><h2 className="mt-5 font-bold">{q.client}</h2><p className="mt-1 text-xs text-muted-foreground">{q.project}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">Lifetime value</span><strong className="text-sm">{money(q.amount)}</strong></div></div>)}</div></div> }

function SettingsView({exchangeRate,setExchangeRate,notify}:{exchangeRate:number;setExchangeRate:(n:number)=>void;notify:(s:string)=>void}) { return <div className="mx-auto max-w-4xl p-4 sm:p-8"><p className="text-xs font-bold uppercase text-highlight animate-fade-in">Administration</p><h1 className="mt-2 font-brand text-3xl font-bold">Company settings</h1><div className="mt-8 grid gap-8 bg-card p-5 sm:p-8 rounded-lg shadow-lg"><section><SectionTitle number="01" title="Business profile"/><div className="grid gap-4 sm:grid-cols-2"><Field label="Company name" value="B.A.B.C BIG-WIG ARCHITECTURE AND BUILDING CONSTRUCTION COMPANY" onChange={()=>{}}/><Field label="Registration number" value="7051820" onChange={()=>{}}/><Field label="Official email" value="destinybigwig@gmail.com" onChange={()=>{}}/><Field label="Phone" value="+2349067883721" onChange={()=>{}}/></div></section><section><SectionTitle number="02" title="Documents & currency"/><div className="grid gap-4 sm:grid-cols-2"><Field label="Default NGN / USD rate" type="number" value={String(exchangeRate)} onChange={(v)=>setExchangeRate(Number(v))}/><Field label="Default validity (days)" type="number" value="14" onChange={()=>{}}/></div></section><section><SectionTitle number="03" title="Payment accounts"/><div className="grid gap-4 sm:grid-cols-2"><div className="border border-border p-4 rounded-lg transition-smooth hover:shadow-md"><strong className="text-sm">Nigerian Naira · UBA</strong><p className="mt-2 text-sm">BIG WIG ARCHITECTURE AND BUILDING CONSTRUCTION</p><p className="mt-1 font-bold">1031019964</p></div><div className="border border-border p-4 rounded-lg transition-smooth hover:shadow-md"><strong className="text-sm">US Dollars · UBA</strong><p className="mt-2 text-sm">Kwamu Hilary Ifechukwudere</p><p className="mt-1 font-bold">2380556018</p><p className="mt-1 text-xs text-muted-foreground">SWIFT UNAFNGLA · Sort 033250380</p></div></div></section><Button className="w-fit transition-smooth glow-primary-hover" onClick={()=>notify("Company settings saved")}>Save settings</Button></div></div> }

function EmptyView({icon:Icon,title,text,action,onAction}:{icon:typeof FileText;title:string;text:string;action:string;onAction:()=>void}) { return <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-6"><div className="max-w-md text-center"><div className="mx-auto grid size-16 place-items-center bg-primary/10 text-primary"><Icon className="size-7"/></div><h1 className="mt-6 font-brand text-3xl font-bold">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{text}</p><Button className="mt-6" onClick={onAction}>{action}<ChevronRight/></Button></div></div> }
function SectionTitle({number,title}:{number:string;title:string}) { return <div className="mb-4 flex items-center gap-3"><span className="text-xs font-bold text-highlight">{number}</span><h3 className="font-brand text-sm font-bold">{title}</h3><div className="h-px flex-1 bg-border"/></div> }
function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}) { return <div><Label>{label}</Label><Input className="mt-2" type={type} value={value} onChange={(e)=>onChange(e.target.value)} /></div> }
function SummaryRow({label,value}:{label:string;value:string}) { return <div className="flex justify-between border-b border-border py-3 text-xs"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div> }

const QuoteDocument = forwardRef<HTMLDivElement, {
  client: { name: string; company: string; phone: string; address: string };
  title: string;
  items: Item[];
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
  depositPct: number;
  converted: number;
  quotationNumber: string;
  issuedAt: Date;
  terms: string;
}>(({ client, title, items, currency, subtotal, discount, total, deposit, depositPct, converted, quotationNumber, issuedAt, terms }, ref) => {
  const validUntil = new Date(issuedAt);
  validUntil.setDate(validUntil.getDate() + 14);
  const conditions = terms.split(/\r?\n/).map((term) => term.trim()).filter(Boolean);
  const whatsappMessage = encodeURIComponent(`Hello B.A.B.C, I have a question about quotation ${quotationNumber} for ${title}.`);
  const whatsappLink = `https://wa.me/2349067883721?text=${whatsappMessage}`;
  const equivalent = money(converted, currency === "NGN" ? "USD" : "NGN");

  return (
    <div ref={ref} className="quote-document print-document relative w-[148mm] min-h-[210mm] bg-white p-[9mm] text-foreground shadow-xl ring-1 ring-black/5">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-4 border-b-[3px] border-amber-500 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/B.A.B.C LOGO.png" alt="B.A.B.C logo" className="size-[16mm] shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="font-brand text-[9px] font-extrabold uppercase leading-snug tracking-[0.16em] text-primary">
                Big-Wig Architecture and Building Construction Company
              </p>
              <p className="mt-1 text-[7px] text-muted-foreground">No. 5 Benbella Street, Umuchima Uli, Anambra State.</p>
            </div>
          </div>
          <div className="shrink-0 text-right text-[7px] leading-relaxed text-muted-foreground">
            <p className="font-bold text-primary">+234 906 788 3721</p>
            <p className="font-semibold text-primary">destinybigwig@gmail.com</p>
            <p>babcofficialsite.vercel.app</p>
          </div>
        </header>

        <section className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-[7px] font-bold uppercase tracking-[0.24em] text-primary">Formal document</p>
            <h1 className="mt-1 font-brand text-2xl font-extrabold leading-none tracking-tight text-primary">QUOTATION</h1>
            <p className="mt-1 text-[8px] font-semibold text-muted-foreground">{quotationNumber}</p>
          </div>
          <div className="max-w-[36%] text-right text-[7px] leading-relaxed text-muted-foreground">
            <p>Issued: {formatDocumentDate(issuedAt)}</p>
            <p>Valid until: {formatDocumentDate(validUntil)}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded border border-amber-500 bg-blue-50/80 p-3">
            <p className="border-l-2 border-amber-500 pl-2 text-[7px] font-bold uppercase tracking-[0.2em] text-primary">Prepared for</p>
            <p className="mt-2 pl-2 font-brand text-sm font-extrabold uppercase leading-tight text-primary">{client.name || "Client name"}</p>
            <div className="mt-1 pl-2 text-[7px] leading-relaxed text-muted-foreground">
              {client.company && <p>{client.company}</p>}
              {client.phone && <p>{client.phone}</p>}
              {client.address && <p>{client.address}</p>}
            </div>
          </div>
          <div className="rounded border border-border bg-slate-50 p-3">
            <p className="border-l-2 border-amber-500 pl-2 text-[7px] font-bold uppercase tracking-[0.2em] text-primary">Project</p>
            <p className="mt-2 pl-2 font-brand text-sm font-extrabold leading-tight text-primary">{title || "Project title"}</p>
          </div>
        </section>

        <table className="w-full table-fixed border-collapse text-left">
          <colgroup><col className="w-[8%]" /><col className="w-[43%]" /><col className="w-[19%]" /><col className="w-[10%]" /><col className="w-[20%]" /></colgroup>
          <thead className="bg-primary text-primary-foreground">
            <tr className="text-[7px] uppercase tracking-[0.16em]">
              <th className="rounded-tl p-2">#</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Unit price</th>
              <th className="p-2 text-center">Qty</th>
              <th className="rounded-tr p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={5} className="border border-border p-4 text-center text-[8px] text-muted-foreground">No items added.</td></tr> : items.map((item, index) => (
              <tr key={item.id} className="border-b border-border text-[8px]">
                <td className="p-2 font-bold text-primary">{String(index + 1).padStart(2, "0")}</td>
                <td className="p-2"><p className="font-bold text-primary">{item.description}</p><p className="mt-0.5 text-[7px] text-muted-foreground">{item.unit || "lump sum"}</p></td>
                <td className="p-2 text-right">{money(item.rate, currency)}</td>
                <td className="p-2 text-center">{item.quantity}</td>
                <td className="p-2 text-right font-bold text-primary">{money(item.rate * item.quantity, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="grid grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="space-y-3 text-[8px]">
            <div>
              <h2 className="font-bold uppercase tracking-[0.2em] text-primary">Payment details</h2>
              <div className="mt-2 space-y-2 border-t border-border pt-2">
                <div>
                  <p className="font-bold">Naira Payments (NGN)</p>
                  <p className="mt-0.5 leading-relaxed">BIG WIG ARCHITECTURE AND BUILDING CONSTRUCTION<br />UBA · 1031019964</p>
                </div>
                <div>
                  <p className="font-bold">Dollar Payments (USD)</p>
                  <p className="mt-0.5 leading-relaxed">Kwamu Hilary Ifechukwudere<br />UBA · 2380556018<br />SWIFT: UNAFNGLA · Sort Code: 033250380</p>
                </div>
              </div>
            </div>
            <p className="border-t border-border pt-2 text-[7px] text-muted-foreground">Amount in words: {amountInWords(total, currency)}</p>
          </div>
          <div>
            <SummaryRow label="Subtotal" value={money(subtotal, currency)} />
            <SummaryRow label="Discount" value={discount > 0 ? money(discount, currency) : "—"} />
            <div className="mt-2 rounded bg-primary px-3 py-2 text-primary-foreground">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[7px] font-bold uppercase tracking-[0.2em]">Grand total</span>
                <strong className="text-xs">{money(total, currency)}</strong>
              </div>
              <p className="mt-1 text-right text-[7px] opacity-85">Equivalent: {equivalent}</p>
            </div>
            <SummaryRow label="Deposit" value={money(deposit, currency)} />
            <p className="py-1 text-center text-[7px] font-bold text-primary">({depositPct}%)</p>
            <SummaryRow label="Outstanding" value={money(total - deposit, currency)} />
          </div>
        </section>

        <section className="rounded border border-dashed border-amber-500 bg-amber-50/70 p-3">
          <h2 className="text-[7px] font-bold uppercase tracking-[0.2em] text-primary">Terms &amp; conditions</h2>
          <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[6.5px] leading-relaxed text-slate-700">
            {conditions.map((condition, index) => <li key={`${index}-${condition}`}>{index + 1}. {condition}</li>)}
          </ol>
        </section>

        <footer className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 pt-1">
          <div className="text-[8px]">
            <p className="font-bold text-primary">Engr. K.I Hillary</p>
            <p className="mt-0.5 text-muted-foreground">Authorized Signatory</p>
          </div>
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="rounded border border-amber-500 bg-white p-1.5" aria-label="Scan to chat with B.A.B.C on WhatsApp">
            <QRCodeSVG value={whatsappLink} size={58} level="M" bgColor="#ffffff" fgColor="#102d59" />
          </a>
          <div className="text-right text-[7px] leading-relaxed">
            <p className="text-muted-foreground">Scan to chat on WhatsApp</p>
            <p className="font-bold uppercase text-primary">From vision to legacy</p>
            <p className="font-bold text-primary">+234 906 788 3721</p>
          </div>
        </footer>
      </div>
    </div>
  );
});