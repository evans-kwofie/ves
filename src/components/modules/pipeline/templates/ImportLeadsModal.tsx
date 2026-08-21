import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Upload01Icon,
  FileAttachmentIcon,
  Delete02Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Loading03Icon,
  GoogleIcon,
  DatabaseIcon,
} from "hugeicons-react";
import { toast } from "sonner";
import type { Lead } from "~/types/lead";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportSource = "csv" | "attio" | "hubspot" | "salesforce";

interface ParsedRow {
  company: string;
  ceo: string;
  email: string;
  website: string;
  linkedin: string;
  whatTheyDo: string;
  notes: string;
  role: string;
  industry: string;
  companySize: string;
  location: string;
  intentSignals: string;
  engagementHistory: string;
  _raw: Record<string, string>;
  _errors: string[];
}

// ─── CSV column mapping ───────────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: "company", label: "Company" },
  { value: "ceo", label: "Contact name" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn URL" },
  { value: "whatTheyDo", label: "What they do" },
  { value: "role", label: "Job title / role" },
  { value: "industry", label: "Industry" },
  { value: "companySize", label: "Company size" },
  { value: "location", label: "Location" },
  { value: "intentSignals", label: "Intent signals" },
  { value: "engagementHistory", label: "Engagement history" },
  { value: "notes", label: "Notes" },
  { value: "_skip", label: "— Skip column —" },
] as const;

type FieldKey =
  | "company"
  | "ceo"
  | "email"
  | "website"
  | "linkedin"
  | "whatTheyDo"
  | "notes"
  | "role"
  | "industry"
  | "companySize"
  | "location"
  | "intentSignals"
  | "engagementHistory"
  | "_skip";

function guessMapping(headers: string[]): Record<string, FieldKey> {
  const map: Record<string, FieldKey> = {};
  const lower = (s: string) => s.toLowerCase().trim();
  for (const h of headers) {
    const l = lower(h);
    if (l.includes("source") || l.includes("reference") || l.includes("evidence"))
      map[h] = "_skip";
    else if (l.includes("company size") || l.includes("employee") || l.includes("headcount"))
      map[h] = "companySize";
    else if (
      l.includes("company") ||
      l.includes("organization") ||
      l.includes("account")
    )
      map[h] = "company";
    else if (
      l.includes("ceo") ||
      l.includes("founder") ||
      l.includes("contact") ||
      l.includes("name") ||
      l.includes("person")
    )
      map[h] = "ceo";
    else if (l.includes("email")) map[h] = "email";
    else if (l.includes("linkedin") || l.includes("linked in")) map[h] = "linkedin";
    else if (l.includes("website") || l.includes("url") || l.includes("domain"))
      map[h] = "website";
    else if (l.includes("title") || l.includes("job") || l.includes("role") || l.includes("position"))
      map[h] = "role";
    else if (l.includes("industry") || l.includes("sector")) map[h] = "industry";
    else if (l.includes("location") || l.includes("city") || l.includes("region") || l.includes("country"))
      map[h] = "location";
    else if (l.includes("intent") || l.includes("signal")) map[h] = "intentSignals";
    else if (l.includes("engagement") || l.includes("activity") || l.includes("interaction"))
      map[h] = "engagementHistory";
    else if (
      l.includes("description") ||
      l.includes("what") ||
      l.includes("about")
    )
      map[h] = "whatTheyDo";
    else if (l.includes("note")) map[h] = "notes";
    else map[h] = "_skip";
  }
  return map;
}

function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, FieldKey>,
): ParsedRow[] {
  return rows.map((raw) => {
    const row: ParsedRow = {
      company: "",
      ceo: "",
      email: "",
      website: "",
      linkedin: "",
      whatTheyDo: "",
      notes: "",
      role: "",
      industry: "",
      companySize: "",
      location: "",
      intentSignals: "",
      engagementHistory: "",
      _raw: raw,
      _errors: [],
    };
    for (const [col, field] of Object.entries(mapping)) {
      if (field === "_skip") continue;
      row[field] = (raw[col] ?? "").trim();
    }
    if (!row.company) row._errors.push("Company required");
    return row;
  });
}

// ─── CSV parser (no dependencies) ────────────────────────────────────────────

function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map((s) => s.trim().replace(/^"|"$/g, ""));
  }

  const headers = splitLine(lines[0]);
  const rows = lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = splitLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });

  return { headers, rows };
}

// ─── Source tab config ────────────────────────────────────────────────────────

const SOURCES: {
  id: ImportSource;
  label: string;
  icon: React.ReactNode;
  available: boolean;
}[] = [
  {
    id: "csv",
    label: "CSV / Spreadsheet",
    icon: <FileAttachmentIcon size={16} />,
    available: true,
  },
  {
    id: "attio",
    label: "Attio",
    icon: <DatabaseIcon size={16} />,
    available: false,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    icon: <GoogleIcon size={16} />,
    available: false,
  },
  {
    id: "salesforce",
    label: "Salesforce",
    icon: <DatabaseIcon size={16} />,
    available: false,
  },
];

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ImportLeadsModal({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  onSuccess: (leads: Lead[]) => void;
}) {
  const [source, setSource] = React.useState<ImportSource>("csv");
  const [step, setStep] = React.useState<"upload" | "map" | "preview" | "done">(
    "upload",
  );
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rawRows, setRawRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, FieldKey>>({});
  const [parsed, setParsed] = React.useState<ParsedRow[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setParsed([]);
    setResult(null);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a CSV file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        toast.error("Could not parse CSV — check the file format");
        return;
      }
      setHeaders(headers);
      setRawRows(rows);
      const guessed = guessMapping(headers);
      setMapping(guessed);
      setStep("map");
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function proceed() {
    const rows = applyMapping(rawRows, mapping);
    setParsed(rows);
    setStep("preview");
  }

  async function importLeads() {
    setImporting(true);
    const valid = parsed.filter((r) => r._errors.length === 0);
    try {
      const res = await fetch("/api/pipeline/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          leads: valid.map((r) => ({
            company: r.company,
            ceo: r.ceo,
            email: r.email || null,
            website: r.website || "",
            linkedin: r.linkedin || "",
            whatTheyDo: r.whatTheyDo || "",
            notes: r.notes || "",
            role: r.role || "",
            industry: r.industry || "",
            companySize: r.companySize || "",
            location: r.location || "",
            intentSignals: r.intentSignals.split(/[,;|]/).map((signal) => signal.trim()).filter(Boolean),
            engagementHistory: r.engagementHistory.split(/[,;|]/).map((event) => event.trim()).filter(Boolean),
            sourceDetails: r._raw,
          })),
        }),
      });
      const data = (await res.json()) as {
        leads?: Lead[];
        imported?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      setResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 });
      setStep("done");
      if (data.leads && data.leads.length > 0) onSuccess(data.leads);
    } catch {
      toast.error("Network error");
    } finally {
      setImporting(false);
    }
  }

  const validCount = parsed.filter((r) => r._errors.length === 0).length;
  const errorCount = parsed.filter((r) => r._errors.length > 0).length;

  const STEPS = ["upload", "map", "preview"] as const;
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="min-w-5xl w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
          <DialogTitle className="text-[15px] font-bold">
            Import Leads
          </DialogTitle>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            Bring your leads in from a spreadsheet or connect a CRM.
          </p>

          {/* Stepper */}
          {step !== "done" && (
            <div className="flex items-center gap-2 mt-4">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div
                    className={[
                      "flex items-center gap-1.5 text-[11px] font-semibold",
                      step === s
                        ? "text-[var(--accent)]"
                        : stepIndex > i
                          ? "text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                        step === s
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : stepIndex > i
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]",
                      ].join(" ")}
                    >
                      {stepIndex > i ? "✓" : i + 1}
                    </div>
                    {
                      {
                        upload: "Upload",
                        map: "Map columns",
                        preview: "Preview",
                      }[s]
                    }
                  </div>
                  {i < 2 && <div className="flex-1 h-px bg-[var(--border)]" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Source sidebar */}
          <div className="w-44 shrink-0 border-r border-[var(--border)] py-4 flex flex-col gap-1 px-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                disabled={!s.available}
                onClick={() => {
                  if (s.available) {
                    setSource(s.id);
                    reset();
                  }
                }}
                className={[
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left w-full",
                  source === s.id
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : s.available
                      ? "text-[var(--foreground)] hover:bg-[var(--muted)]"
                      : "text-[var(--muted-foreground)] opacity-40 cursor-not-allowed",
                ].join(" ")}
              >
                {s.icon}
                <span>{s.label}</span>
                {!s.available && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Main content — scrollable, no action buttons inside */}
          <div className="flex-1 overflow-y-auto p-6 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            {/* Step: Upload */}
            {step === "upload" && source === "csv" && (
              <div className="flex flex-col gap-6">
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors",
                    dragOver
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                      : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)]",
                  ].join(" ")}
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center">
                    <Upload01Icon
                      size={22}
                      className="text-[var(--muted-foreground)]"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">
                      Drop your CSV here
                    </p>
                    <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                      or click to browse
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>

                {/* Expected format */}
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="px-4 py-3 bg-[var(--muted)] border-b border-[var(--border)]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Expected columns
                    </p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-3">
                    {[
                      { col: "Company", req: true, desc: "Company name" },
                      { col: "Contact", req: false, desc: "CEO / founder name" },
                      { col: "Email", req: false, desc: "Contact email" },
                      { col: "Website", req: false, desc: "Company URL" },
                      { col: "LinkedIn URL", req: false, desc: "Prospect profile" },
                      { col: "Description", req: false, desc: "What they do" },
                      { col: "Job title", req: false, desc: "Prospect role" },
                      { col: "Industry", req: false, desc: "Company sector" },
                      { col: "Company size", req: false, desc: "Employee range" },
                      { col: "Location", req: false, desc: "Company or prospect location" },
                      { col: "Intent signals", req: false, desc: "Separate multiple values with commas" },
                      { col: "Engagement history", req: false, desc: "Separate multiple values with commas" },
                      { col: "Notes", req: false, desc: "Internal notes" },
                    ].map((f) => (
                      <div key={f.col} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--foreground)]">
                            {f.col}
                          </span>
                          {f.req && (
                            <span className="text-[9px] font-bold text-[var(--accent)] uppercase">
                              required
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          {f.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step: Map columns */}
            {step === "map" && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">
                    Map your columns
                  </p>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                    {rawRows.length} rows found. Tell us what each column means.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {headers.map((h) => (
                    <div
                      key={h}
                      className="flex items-center gap-4 p-3 rounded-lg bg-[var(--muted)]"
                    >
                      <span className="w-40 text-[12px] font-semibold text-[var(--foreground)] truncate shrink-0">
                        {h}
                      </span>
                      <span className="text-[var(--muted-foreground)] text-[11px] shrink-0">
                        →
                      </span>
                      <select
                        className="input flex-1 text-[12px]"
                        value={mapping[h] ?? "_skip"}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [h]: e.target.value as FieldKey,
                          }))
                        }
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {rawRows[0]?.[h] && (
                        <span className="text-[11px] text-[var(--muted-foreground)] w-40 truncate shrink-0 text-right">
                          e.g. {rawRows[0][h]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {step === "preview" && (
              <div className="flex flex-col gap-6">
                {/* Summary */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-[var(--muted)] p-4 flex items-center gap-3">
                    <CheckmarkCircle01Icon
                      size={18}
                      className="text-[var(--accent)] shrink-0"
                    />
                    <div>
                      <div className="text-[20px] font-extrabold tracking-tight text-[var(--foreground)]">
                        {validCount}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        ready to import
                      </div>
                    </div>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex-1 rounded-xl bg-red-500/10 p-4 flex items-center gap-3">
                      <AlertCircleIcon
                        size={18}
                        className="text-red-400 shrink-0"
                      />
                      <div>
                        <div className="text-[20px] font-extrabold tracking-tight text-[var(--foreground)]">
                          {errorCount}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)]">
                          will be skipped
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table preview */}
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="overflow-x-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
                    <table className="w-full text-[12px] border-collapse">
                      <thead>
                        <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                          <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] w-6"></th>
                          {(
                            [
                              "company",
                              "ceo",
                              "email",
                              "website",
                              "whatTheyDo",
                            ] as const
                          ).map((f) => (
                            <th
                              key={f}
                              className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]"
                            >
                              {f === "whatTheyDo"
                                ? "Description"
                                : f === "ceo"
                                  ? "Contact"
                                  : f}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 8).map((row, i) => (
                          <tr
                            key={i}
                            className={[
                              "border-b border-border",
                              row._errors.length > 0 ? "opacity-40" : "",
                            ].join(" ")}
                          >
                            <td className="px-3 py-2.5">
                              {row._errors.length === 0 ? (
                                <CheckmarkCircle01Icon
                                  size={13}
                                  className="text-accent"
                                />
                              ) : (
                                <AlertCircleIcon
                                  size={13}
                                  // @ts-ignore
                                  title={row._errors.join(", ")}
                                />
                              )}
                            </td>
                            {(
                              [
                                "company",
                                "ceo",
                                "email",
                                "website",
                                "whatTheyDo",
                              ] as const
                            ).map((f) => (
                              <td
                                key={f}
                                className="px-3 py-2.5 text-foreground max-w-45 truncate"
                              >
                                {row[f] || (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {parsed.length > 8 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-2.5 text-[11px] text-muted-foreground text-center"
                            >
                              + {parsed.length - 8} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Done */}
            {step === "done" && result && (
              <div className="flex flex-col items-center gap-6 py-10">
                <div className="w-16 h-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                  <CheckmarkCircle01Icon
                    size={32}
                    className="text-[var(--accent)]"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-extrabold tracking-tight text-[var(--foreground)]">
                    {result.imported} lead{result.imported !== 1 ? "s" : ""}{" "}
                    imported
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                      {result.skipped} rows skipped due to missing required
                      fields
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — pinned action buttons */}
        <div className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] bg-muted/50 px-6 py-4">
          {step === "upload" && (
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Upload a CSV file to get started.
            </p>
          )}
          {step === "map" && (
            <>
              <Button onClick={proceed}>Preview Import</Button>
              <Button variant="ghost" onClick={reset}>
                Back
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                onClick={importLeads}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <>
                    <Loading03Icon size={13} className="animate-spin" />{" "}
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validCount} lead{validCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setStep("map")}>
                Back
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
              <Button variant="ghost" onClick={reset}>
                Import more
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
