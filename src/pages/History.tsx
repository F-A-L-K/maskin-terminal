import { useState, useEffect } from "react";
import { MachineId } from "@/types";
import { useTools } from "@/hooks/useTools";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ChevronsRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAdamBoxValue } from "@/lib/adambox";
import { supabase } from "@/integrations/supabase/client";

interface HistoryProps {
  activeMachine: MachineId;
}

interface ToolWithCount {
  id: string;
  plats: string | null;
  benämning: string;
  artikelnummer: string | null;
  maxgräns: number | null;
  maxgräns_varning: number | null;
  partsSinceLastChange?: number | null;
}

export default function History({ activeMachine }: HistoryProps) {
  const { data: tools, isLoading, error } = useTools();
  const navigate = useNavigate();
  const [currentAdamBoxValue, setCurrentAdamBoxValue] = useState<number | null>(null);
  const [toolsWithCounts, setToolsWithCounts] = useState<ToolWithCount[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const handleToolHistory = (toolId: string) => {
    // Extract the machine pattern from current URL to preserve all machines
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const machinePattern = pathParts.find(part => /^\d{4}(-\d{4})*$/.test(part));
    
    // Extract the machine number from activeMachine (format: "5701 Machine Name")
    const machineNumber = activeMachine.split(' ')[0];
    
    if (machinePattern) {
      navigate(`/${machinePattern}/verktygshistorik/${machineNumber}/${toolId}`);
    } else {
      // Fallback to single machine if pattern not found
      const machineId = activeMachine.split(' ')[0];
      navigate(`/${machineId}/verktygshistorik/${machineId}/${toolId}`);
    }
  };

  // Initialize tools with counts immediately, then load AdamBox data in background
  useEffect(() => {
    if (tools && tools.length > 0) {
      // Set tools immediately without counts
      setToolsWithCounts(tools.map(tool => ({ ...tool, partsSinceLastChange: null })));
    }
  }, [tools]);

  // Fetch current AdamBox value and calculate parts since last change for each tool
  useEffect(() => {
    const fetchCurrentData = async () => {
      if (!tools || tools.length === 0) return;

      setLoadingCounts(true);
      
      try {
        // Get current AdamBox value
        const currentValue = await getAdamBoxValue(activeMachine);
        setCurrentAdamBoxValue(currentValue);

        // Calculate parts since last change for each tool
        const toolsWithCountsData = await Promise.all(
          tools.map(async (tool) => {
            let partsSinceLastChange = null;
            
            if (currentValue !== null && tool.id) {
              try {
                // Get machine ID from database
                const machineNumber = activeMachine.split(' ')[0];
                const { data: machineData } = await supabase
                  .from('verktygshanteringssystem_maskiner')
                  .select('id')
                  .eq('maskiner_nummer', machineNumber)
                  .single();
                
                if (machineData) {
                  // Get the latest tool change for this tool on this specific machine
                  const { data: latestToolChange } = await (supabase as any)
                    .from("verktygshanteringssystem_verktygsbyteslista")
                    .select("number_of_parts_ADAM")
                    .eq("tool_id", tool.id)
                    .eq("machine_id", machineData.id)
                    .order("date_created", { ascending: false })
                    .limit(1);

                  if (latestToolChange && latestToolChange.length > 0) {
                    const lastAdamValue = latestToolChange[0].number_of_parts_ADAM;
                    if (lastAdamValue !== null) {
                      partsSinceLastChange = currentValue - lastAdamValue;
                    }
                  }
                }
              } catch (error) {
                console.error(`Error fetching tool change for tool ${tool.id}:`, error);
              }
            }

            return {
              ...tool,
              partsSinceLastChange
            };
          })
        );

        setToolsWithCounts(toolsWithCountsData);
      } catch (error) {
        console.error("Error fetching current data:", error);
      } finally {
        setLoadingCounts(false);
      }
    };

    // Fetch immediately on mount/change
    fetchCurrentData();

    // Then fetch every 10 minutes
    const interval = setInterval(() => {
      fetchCurrentData();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [tools, activeMachine]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        Ett fel uppstod vid laddning av verktyg
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className=" overflow-hidden">
        <Table maxHeight="85vh">
          <TableHeader>
            <TableRow >
              <TableHead className="w-[5%] text-center">Plats</TableHead>
              <TableHead className="w-[25%] text-center">Benämning</TableHead>
              <TableHead className="w-[25%] text-center">Artikelnummer</TableHead>
              <TableHead className="w-[10%] text-center">Antal körda</TableHead>
              <TableHead className="w-[10%] text-center">Max gräns</TableHead>
              <TableHead className="w-[3%] text-center">Mer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody >
            {toolsWithCounts && toolsWithCounts.length > 0 ? (
             [...toolsWithCounts]
             .sort((a, b) => (a.plats || "").localeCompare(b.plats || "", undefined, { numeric: true }))
             .map((tool) => (
                <TableRow key={tool.id} >
                  <TableCell className="text-center">T{tool.plats || "-"}</TableCell>
                  <TableCell className="font-medium text-center">{tool.benämning}</TableCell>
                  <TableCell className="text-center">{tool.artikelnummer || "-"}</TableCell>
                  <TableCell className="text-center">
                    {loadingCounts ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : tool.partsSinceLastChange !== null ? (
                      <span className={
                        tool.maxgräns !== null && tool.partsSinceLastChange > tool.maxgräns
                          ? "text-red-500 font-bold"
                          : tool.maxgräns !== null && tool.maxgräns_varning !== null && 
                            tool.partsSinceLastChange >= tool.maxgräns_varning
                          ? "text-orange-500 font-bold"
                          : ""
                      }>
                        {tool.partsSinceLastChange} <span className="text-blue-500">ST</span>
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center" >
                    {tool.maxgräns !== null ? (
                      <span>{tool.maxgräns} <span className="text-blue-500">ST</span></span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center p-0">
                    <div 
                      className="bg-[#C8D8E0] hover:bg-blue-200 cursor-pointer flex items-center justify-center h-full min-h-[48px] transition-colors"
                      onClick={() => handleToolHistory(tool.id)}
                    >
                      <ChevronsRight className="h-4 w-4 text-blue-800" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Inga verktyg hittades
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
