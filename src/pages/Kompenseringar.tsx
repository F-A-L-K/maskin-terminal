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

interface KompenseringarProps {
  activeMachine: MachineId;
}

interface CompensationRecord {
  id: string;
  machine_id: string;
  date: string;
  created_at: string;
  verktyg_koordinat_num: string;
  verktyg_längd_geometry: number | null;
  verktyg_längd_wear: number | null;
  verktyg_radie_geometry: number | null;
  verktyg_radie_wear: number | null;
  koord_x: number | null;
  koord_y: number | null;
  koord_z: number | null;
  koord_c: number | null;
  koord_b: number | null;
}

export default function Kompenseringar({ activeMachine }: KompenseringarProps) {
  const [compensations, setCompensations] = useState<CompensationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);

  // Fetch machine ID from activeMachine
  useEffect(() => {
    const fetchMachineId = async () => {
      try {
        const machineNumber = activeMachine.split(' ')[0];
        const { data: machine, error } = await supabase
          .from('verktygshanteringssystem_maskiner')
          .select('id')
          .eq('maskiner_nummer', machineNumber)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching machine ID:', error);
          return;
        }
        
        if (machine) {
          setMachineId(machine.id);
        }
      } catch (err) {
        console.error('Error fetching machine ID:', err);
      }
    };
    
    fetchMachineId();
  }, [activeMachine]);

  // Fetch compensations from database
  useEffect(() => {
    if (!machineId) return;
    
    setLoading(true);
    
    supabase
      .from('verktygshanteringssystem_kompenseringar')
      .select('*')
      .eq('machine_id', machineId)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching compensations:', error);
          setLoading(false);
          return;
        }
        
        setCompensations(data || []);
        setLoading(false);
      });
  }, [machineId]);

  // Format compensation value
  const formatCompensation = (record: CompensationRecord): string => {
    // Check for coordinate system values (koord_x, koord_y, koord_z, koord_c, koord_b)
    if (record.koord_x !== null && record.koord_x !== undefined) {
      const sign = record.koord_x >= 0 ? '+' : '';
      return `X ${sign}${record.koord_x.toFixed(3)}`;
    }
    if (record.koord_y !== null && record.koord_y !== undefined) {
      const sign = record.koord_y >= 0 ? '+' : '';
      return `Y ${sign}${record.koord_y.toFixed(3)}`;
    }
    if (record.koord_z !== null && record.koord_z !== undefined) {
      const sign = record.koord_z >= 0 ? '+' : '';
      return `Z ${sign}${record.koord_z.toFixed(3)}`;
    }
    if (record.koord_c !== null && record.koord_c !== undefined) {
      const sign = record.koord_c >= 0 ? '+' : '';
      return `C ${sign}${record.koord_c.toFixed(3)}`;
    }
    if (record.koord_b !== null && record.koord_b !== undefined) {
      const sign = record.koord_b >= 0 ? '+' : '';
      return `B ${sign}${record.koord_b.toFixed(3)}`;
    }
    
    // Check for tool values (verktyg_radie_geometry, verktyg_radie_wear, verktyg_längd_geometry, verktyg_längd_wear)
    if (record.verktyg_radie_wear !== null && record.verktyg_radie_wear !== undefined) {
      const sign = record.verktyg_radie_wear >= 0 ? '+' : '';
      return `R ${sign}${record.verktyg_radie_wear.toFixed(3)}`;
    }
    if (record.verktyg_radie_geometry !== null && record.verktyg_radie_geometry !== undefined) {
      const sign = record.verktyg_radie_geometry >= 0 ? '+' : '';
      return `R ${sign}${record.verktyg_radie_geometry.toFixed(3)}`;
    }
    if (record.verktyg_längd_wear !== null && record.verktyg_längd_wear !== undefined) {
      const sign = record.verktyg_längd_wear >= 0 ? '+' : '';
      return `Z ${sign}${record.verktyg_längd_wear.toFixed(3)}`;
    }
    if (record.verktyg_längd_geometry !== null && record.verktyg_längd_geometry !== undefined) {
      const sign = record.verktyg_längd_geometry >= 0 ? '+' : '';
      return `Z ${sign}${record.verktyg_längd_geometry.toFixed(3)}`;
    }
    
    return "-";
  };

  // Filter compensations based on search query
  const filteredCompensations = compensations.filter((comp) => {
    const query = searchQuery.toLowerCase();
    return (
      comp.verktyg_koordinat_num.toLowerCase().includes(query) ||
      formatCompensation(comp).toLowerCase().includes(query) ||
      format(new Date(comp.date), "yyyy-MM-dd HH:mm").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-full w-full flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-4">Kompenseringar</h2>
        <div className="mb-4">
          <Input
            placeholder="Sök efter datum, verktyg/koordinat eller kompensering..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="p-6 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Laddar kompenseringar...
        </div>
      ) : (
        <div className="p-6">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%] text-center">Datum</TableHead>
                  <TableHead className="w-[25%] text-center">Verktyg / Koord.</TableHead>
                  <TableHead className="w-[50%] text-center">Kompensering</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompensations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                      Inga kompenseringar registrerade
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompensations.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="text-center">
                        {format(new Date(comp.date), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium text-center">
                        {comp.verktyg_koordinat_num}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {formatCompensation(comp)}
                      </TableCell>
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
