import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MachineId } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface KompenseringarManuellaProps {
  activeMachine: MachineId;
}

interface ManuellKompensering {
  id: string;
  machine_id: string;
  kategori: string;
  typ: string;
  värde: number;
  signatur: string;
  created_at: string;
}

export default function KompenseringarManuella({ activeMachine }: KompenseringarManuellaProps) {
  const [list, setList] = useState<ManuellKompensering[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);

  useEffect(() => {
    const machineNumber = activeMachine.split(" ")[0];
    supabase
      .from("verktygshanteringssystem_maskiner")
      .select("id")
      .eq("maskiner_nummer", machineNumber)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setMachineId(data.id);
      });
  }, [activeMachine]);

  useEffect(() => {
    if (!machineId) return;
    setLoading(true);
    supabase
      .from("verktygshanteringssystem_kompenseringar_manuella")
      .select("*")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setLoading(false);
          return;
        }
        setList((data as ManuellKompensering[]) || []);
        setLoading(false);
      });
  }, [machineId]);

  const filtered = list.filter((row) => {
    const q = searchQuery.toLowerCase();
    return (
      row.kategori.toLowerCase().includes(q) ||
      row.typ.toLowerCase().includes(q) ||
      row.signatur.toLowerCase().includes(q) ||
      String(row.värde).toLowerCase().includes(q) ||
      format(new Date(row.created_at), "yyyy-MM-dd HH:mm").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full w-full flex-col">
      {/* <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-4">Kompenseringar</h2>
        <Input
          placeholder="Sök datum, kategori, typ, värde eller signatur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div> */}
      {loading ? (
        <div className="p-6 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Laddar kompenseringar...
        </div>
      ) : (
        <div className="p-6">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Datum</TableHead>
                  <TableHead className="text-center">Kategori</TableHead>
                  <TableHead className="text-center">Typ</TableHead>
                  <TableHead className="text-center">Värde</TableHead>
                  <TableHead className="text-center">Signatur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Inga kompenseringar registrerade
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center">
                        {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell className="text-center">{row.kategori}</TableCell>
                      <TableCell className="text-center">{row.typ}</TableCell>
                      <TableCell className="text-center font-mono">
                        {row.värde >= 0 ? "+" : ""}{row.värde}
                      </TableCell>
                      <TableCell className="text-center">{row.signatur}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
