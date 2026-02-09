import { useState, useEffect, useMemo } from "react";
import { MachineId } from "@/types";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5004";

const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 timmar

interface KassationRow {
  event_time_local: string;
  source: string;
  report_number: number | null;
  part_number: string | null;
  rejected_qty: number;
  rejected_code: string;
  manual_comment_raw: string | null;
  extra_info_raw: string | null;
  operator_id: number | string | null;
  operator_name: string | null;
}

interface KassationerData {
  work_center_number: string;
  start_utc: string;
  end_utc: string;
  producerade: number;
  kasserade: number;
  kassationer: KassationRow[];
}

interface KassationerProps {
  activeMachine: MachineId;
}

/** Namn per kassationskod – visas bredvid koden */
const KASSATIONSKOD_NAMES: Record<string, string> = {
  T01: "Måttfel",
  T02: "Verktygsbrott",
  T03: "Klämmärke",
  T04: "Övrigt",
};

function getCodeLabel(code: string): string {
  if (!code || code === "(ingen kod)") return code;
  const name = KASSATIONSKOD_NAMES[code.toUpperCase()];
  return name ? `${code} ${name}` : code;
}

/** T90 ska inte ingå i någon statistik eller kommentarer */
function excludeT90(rows: KassationRow[]): KassationRow[] {
  return rows.filter((r) => (r.rejected_code ?? "").trim().toUpperCase() !== "T90");
}

/** True om texten bara är JSON med t.ex. {"RejectionCode":"T04"} – räknas inte som riktig kommentar */
function isOnlyRejectionCodeJson(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("{")) return false;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.length === 1 && (keys[0] === "RejectionCode" || keys[0].toLowerCase().includes("rejection"));
  } catch {
    return false;
  }
}

/** Har raden en riktig kommentar? (manual räknas alltid; extra_info bara om det inte bara är RejectionCode-JSON) */
function hasRealComment(row: KassationRow): boolean {
  if (row.manual_comment_raw && row.manual_comment_raw.trim()) return true;
  const extra = row.extra_info_raw && String(row.extra_info_raw).trim();
  if (!extra) return false;
  if (isOnlyRejectionCodeJson(extra)) return false;
  return true;
}

/** Antal per kassationskod – alla rader, oavsett kommentar */
function groupByCode(rows: KassationRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = (row.rejected_code ?? "").trim() || "(ingen kod)";
    const qty = Number(row.rejected_qty) || 0;
    map.set(code, (map.get(code) ?? 0) + qty);
  }
  return map;
}

/** Rader som har en riktig kommentar, sorterade nyast först */
function getCommentRows(rows: KassationRow[]): KassationRow[] {
  return rows
    .filter(hasRealComment)
    .sort((a, b) => (b.event_time_local || "").localeCompare(a.event_time_local || ""));
}

function getCommentText(row: KassationRow): string {
  if (row.manual_comment_raw && row.manual_comment_raw.trim()) return row.manual_comment_raw.trim();
  const extra = row.extra_info_raw && String(row.extra_info_raw).trim();
  if (extra && !isOnlyRejectionCodeJson(extra)) return extra;
  return "";
}

type ChartDag = { datum: string; label: string; veckodag: string; kassationer: number };

/** Dag för dag: datumsträng YYYY-MM-DD → summa rejected_qty. veckodag = kort veckodag (mån, tis, …). */
function kassationerPerDag(rows: KassationRow[], startUtc: string, endUtc: string): ChartDag[] {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const perDag = new Map<string, number>();
  for (const row of rows) {
    const t = row.event_time_local ? new Date(row.event_time_local) : null;
    if (!t) continue;
    const key = t.toISOString().slice(0, 10);
    if (t < start || t > end) continue;
    const qty = Number(row.rejected_qty) || 0;
    perDag.set(key, (perDag.get(key) ?? 0) + qty);
  }
  const result: ChartDag[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({
      datum: key,
      label: cursor.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
      veckodag: cursor.toLocaleDateString("sv-SE", { weekday: "short" }),
      kassationer: perDag.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export default function Kassationer({ activeMachine }: KassationerProps) {
  const [data, setData] = useState<KassationerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workCenter = activeMachine.split(" ")[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/kassationer?wc=${encodeURIComponent(workCenter)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || "Kunde inte hämta kassationer");
        return res.json();
      })
      .then((json: KassationerData) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Ett fel uppstod");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workCenter]);

  // Uppdatera data var 2:a timme medan användaren är på sidan (bakgrundsuppdatering, ingen loading-spinner)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch(`${API_BASE_URL}/api/kassationer?wc=${encodeURIComponent(workCenter)}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText || "Kunde inte hämta kassationer");
          return res.json();
        })
        .then((json: KassationerData) => setData(json))
        .catch((err) => setError(err.message || "Ett fel uppstod"));
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [workCenter]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const withoutT90 = excludeT90(data.kassationer);
    return kassationerPerDag(withoutT90, data.start_utc, data.end_utc);
  }, [data]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-foreground mb-4">Kassationer</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-foreground">Kassationer</h1>
        <p className="text-muted-foreground">Ingen data</p>
      </div>
    );
  }

  const { producerade, kassationer } = data;
  const withoutT90 = excludeT90(kassationer);
  const kasserade = withoutT90.reduce((sum, row) => sum + (Number(row.rejected_qty) || 0), 0);
  const totalt = producerade + kasserade;
  const procent = totalt > 0 ? (kasserade / totalt) * 100 : 0;
  const produceradeVisa = producerade + kasserade;

  const commentRows = getCommentRows(withoutT90);
  const countsByCode = groupByCode(withoutT90);
  const sortedCodeEntries = Array.from(countsByCode.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 ">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        {/* Vänster kolumn: header, sammanfattning, antal per kod */}
        
        <div className="space-y-8 lg:pr-8 lg:border-r border-border h-full">
    
        <p className="text-sm text-muted-foreground -px-2 -mt-4">
               Senaste veckan ({new Date(data.start_utc).toLocaleDateString("sv-SE")} – {new Date(data.end_utc).toLocaleDateString("sv-SE")})
            </p>
          <div className="rounded-xl bg-[#507E95]/8 -mt-12 flex flex-wrap items-baseline gap-x-10 gap-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-muted-foreground">Producerade</span>
              <span className="text-2xl font-semibold text-foreground tabular-nums">{produceradeVisa.toLocaleString("sv-SE")}</span>
              <span className="text-sm text-muted-foreground">st</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-muted-foreground">Kasserade</span>
              <span className="text-2xl font-semibold text-foreground tabular-nums">{kasserade.toLocaleString("sv-SE")}</span>
              <span className="text-sm text-muted-foreground">st</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-muted-foreground">Kassationsprocent</span>
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  procent > 10 ? "text-red-600" : procent > 2 ? "text-orange-500" : "text-[#507E95]"
                }`}
              >
                {procent.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
              </span>
            </div>
            <div className="w-full border border-t">
            
            </div>
          </div>

          <section className="space-y-3">

            {sortedCodeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga kassationer denna vecka.</p>
            ) : (
              <ul className="rounded-xl bg-muted/30 overflow-hidden divide-y divide-border/60">
                {sortedCodeEntries.map(([code, count]) => (
                  <li
                    key={code}
                    className="flex items-center justify-between px-4 py-3 text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <span className="font-medium text-foreground">{getCodeLabel(code)}</span>
                    <span className=" tabular-nums text-sm font-medium">{count.toLocaleString("sv-SE")} st</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Höger kolumn: kommentarer */}
        <section className="space-y-3 lg:sticky lg:top-6">
        
          {commentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga kommentarer denna vecka.</p>
          ) : (
            <ul className="space-y-3 max-h-[50vh] overflow-y-auto">
              {commentRows.map((row, i) => {
                const commentText = getCommentText(row);
                const qty = Number(row.rejected_qty) || 0;
                const dateStr = row.event_time_local
                  ? new Date(row.event_time_local).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })
                  : "—";
                const code = (row.rejected_code ?? "").trim() || "(ingen kod)";
                const codeLabel = getCodeLabel(code);
                const reportPart = row.part_number
                return (
                  <li key={i} className="rounded-xl bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors ">
                    <div className="flex items-start gap-3 min-w-0 ">
                      <span className="shrink-0 font-bold text-foreground">
                        {codeLabel} 
                      </span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        |
                      </span>
                      <span className="min-w-0 flex-1 text-foreground break-words">
                        {commentText}
                      </span>
                      <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                        {qty} st
                      </span>
                    </div>
                 
                    <div className="text-sm text-muted-foreground mt-2">
                      {(row.operator_name || "—")} | {dateStr} | {reportPart}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Kassationer över veckan */}
      <section className="mt-10 pt-8 border-t border-border">

        <div className="h-64 w-full rounded-xl bg-muted/20 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <defs>
                <linearGradient id="fillKassationer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#507E95" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#507E95" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={(props) => {
                  const { x, y, index } = props;
                  const p = chartData[index] as ChartDag | undefined;
                  const label = p?.label ?? (typeof props.payload === "string" ? props.payload : "");
                  const veckodag = p?.veckodag ?? "";
                  return (
                    <g transform={`translate(${x},${y+10})`}>
                      <text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12} dy={4}>
                        {label}
                      </text>
                      <text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} opacity={0.8} dy={16}>
                        {veckodag}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis
                dataKey="kassationer"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.datum ? new Date(payload[0].payload.datum).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" }) : label}
                formatter={(value: number) => [value, "Kasserade"]}
              />
              <Area
                type="monotone"
                dataKey="kassationer"
                stroke="#507E95"
                strokeWidth={2}
                fill="url(#fillKassationer)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
