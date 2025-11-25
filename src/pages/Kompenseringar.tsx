import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MachineId } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import CompensationList from "@/components/CompensationList";

interface KompenseringarProps {
  activeMachine: MachineId;
}

interface Compensation {
  id: string;
  machine_id: string;
  tool_number: number;
  cutter_radius_geometry: number | null;
  cutter_radius_wear: number | null;
  tool_length_geometry: number | null;
  tool_length_wear: number | null;
  date: string;
  created_at: string;
}

export default function Kompenseringar({ activeMachine }: KompenseringarProps) {
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [loadingCompensations, setLoadingCompensations] = useState(true);
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
    
    setLoadingCompensations(true);
    
    supabase
      .from('verktygshanteringssystem_kompenseringar')
      .select('*')
      .eq('machine_id', machineId)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching compensations:', error);
          setLoadingCompensations(false);
          return;
        }
        
        setCompensations(data || []);
        setLoadingCompensations(false);
      });
  }, [machineId]);

  return (
    <div className="flex h-full w-full flex-col">
      {loadingCompensations ? (
        <div className="p-6 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Laddar kompenseringsvärden...
        </div>
      ) : (
        <CompensationList compensations={compensations} />
      )}
    </div>
  );
}

