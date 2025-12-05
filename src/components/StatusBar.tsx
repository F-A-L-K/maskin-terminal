import { MachineId, Tool } from "@/types";
import { Clock, Shield, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTools } from "@/hooks/useTools";
import { getAdamBoxValue } from "@/lib/adambox";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface StatusBarProps {
  activeMachine: MachineId;
}

interface ToolWarning {
  plats: string;
  benämning: string;
  partsSinceLastChange: number;
  maxgräns: number;
  isMax: boolean; // true if at max, false if at warning
  toolId: string; // Add toolId to track which tool
  machineId: string; // Add machineId to track which machine
  lastToolChangeDate: string; // Date of the last tool change when warning was checked
}

export default function StatusBar({ activeMachine }: StatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toolWarnings, setToolWarnings] = useState<ToolWarning[]>([]);
  const [currentWarningIndex, setCurrentWarningIndex] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogWarning, setDialogWarning] = useState<ToolWarning | null>(null);
  const { data: tools } = useTools();
  
  // Keep track of which warnings have already been shown
  const shownWarningsRef = useRef<Set<string>>(new Set());
  
  // Helper function to get localStorage key for a warning
  const getWarningCacheKey = (toolId: string, machineId: string, isMax: boolean) => {
    return `tool_warning_${machineId}_${toolId}_${isMax ? 'max' : 'warning'}`;
  };
  
  // Helper function to check if warning should be shown (not cached or tool changed)
  const shouldShowWarning = async (
    toolId: string, 
    machineId: string, 
    isMax: boolean, 
    lastToolChangeDate: string
  ): Promise<boolean> => {
    const cacheKey = getWarningCacheKey(toolId, machineId, isMax);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return true; // No cache, show warning
    }
    
    try {
      const cachedData = JSON.parse(cached);
      const cachedToolChangeDate = cachedData.lastToolChangeDate;
      
      // If there's a newer tool change than when warning was accepted, show it again
      if (new Date(lastToolChangeDate) > new Date(cachedToolChangeDate)) {
        localStorage.removeItem(cacheKey); // Clear cache
        return true;
      }
      
      return false; // Warning was already accepted and tool hasn't changed
    } catch (error) {
      console.error('Error parsing cached warning:', error);
      return true; // On error, show warning
    }
  };
  
  // Helper function to save warning acceptance to localStorage
  const saveWarningAcceptance = (
    toolId: string, 
    machineId: string, 
    isMax: boolean, 
    lastToolChangeDate: string
  ) => {
    const cacheKey = getWarningCacheKey(toolId, machineId, isMax);
    const cacheData = {
      acceptedAt: new Date().toISOString(),
      lastToolChangeDate: lastToolChangeDate
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check tool limits every 5 minutes
  useEffect(() => {
    const checkToolLimits = async () => {
      if (!tools || tools.length === 0) return;

      try {
        const currentAdamValue = await getAdamBoxValue(activeMachine);
        if (currentAdamValue === null) return;

        const machineNumber = activeMachine.split(' ')[0];
        const { data: machineData } = await supabase
          .from('verktygshanteringssystem_maskiner')
          .select('id')
          .eq('maskiner_nummer', machineNumber)
          .single();
        
        if (!machineData) return;

        const warnings: ToolWarning[] = [];

        for (const tool of tools) {
          if (!tool.maxgräns || !tool.plats) continue;

          // Get the latest tool change for this tool
          const { data: latestToolChange } = await (supabase as any)
            .from("verktygshanteringssystem_verktygsbyteslista")
            .select("number_of_parts_ADAM, date_created")
            .eq("tool_id", tool.id)
            .eq("machine_id", machineData.id)
            .order("date_created", { ascending: false })
            .limit(1);

          if (latestToolChange && latestToolChange.length > 0) {
            const lastAdamValue = latestToolChange[0].number_of_parts_ADAM;
            const lastToolChangeDate = latestToolChange[0].date_created;
            if (lastAdamValue !== null) {
              const partsSinceLastChange = currentAdamValue - lastAdamValue;
              
              // Check if at or over max limit
              if (partsSinceLastChange >= tool.maxgräns) {
                // Check if warning should be shown (not cached or tool changed)
                const shouldShow = await shouldShowWarning(
                  tool.id, 
                  machineData.id, 
                  true, 
                  lastToolChangeDate
                );
                
                if (shouldShow) {
                  warnings.push({
                    plats: tool.plats,
                    benämning: tool.benämning,
                    partsSinceLastChange,
                    maxgräns: tool.maxgräns,
                    isMax: true,
                    toolId: tool.id,
                    machineId: machineData.id,
                    lastToolChangeDate: lastToolChangeDate
                  });
                }
              }
              // Check if at warning threshold
              else if (tool.maxgräns_varning && partsSinceLastChange >= tool.maxgräns_varning) {
                // Check if warning should be shown (not cached or tool changed)
                const shouldShow = await shouldShowWarning(
                  tool.id, 
                  machineData.id, 
                  false, 
                  lastToolChangeDate
                );
                
                if (shouldShow) {
                  warnings.push({
                    plats: tool.plats,
                    benämning: tool.benämning,
                    partsSinceLastChange,
                    maxgräns: tool.maxgräns,
                    isMax: false,
                    toolId: tool.id,
                    machineId: machineData.id,
                    lastToolChangeDate: lastToolChangeDate
                  });
                }
              }
            }
          }
        }

        setToolWarnings(warnings);
        
        // Check for new warnings that haven't been shown yet
        for (const warning of warnings) {
          const warningKey = `${warning.plats}-${warning.isMax ? 'max' : 'warning'}`;
          
          // If this is a new warning that hasn't been shown before in this session
          if (!shownWarningsRef.current.has(warningKey)) {
            shownWarningsRef.current.add(warningKey);
            setDialogWarning(warning);
            setShowDialog(true);
            break; // Only show one dialog at a time
          }
        }
        
        // Remove warnings that are no longer active from the shown set
        const activeWarningKeys = new Set(
          warnings.map(w => `${w.plats}-${w.isMax ? 'max' : 'warning'}`)
        );
        shownWarningsRef.current.forEach(key => {
          if (!activeWarningKeys.has(key)) {
            shownWarningsRef.current.delete(key);
          }
        });
      } catch (error) {
        console.error('Error checking tool limits:', error);
      }
    };

    // Check immediately on mount/machine change
    checkToolLimits();

    // Then check every 5 minutes
    const interval = setInterval(checkToolLimits, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tools, activeMachine]);

  // Rotate through warnings every 5 seconds if multiple warnings
  useEffect(() => {
    if (toolWarnings.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentWarningIndex((prev) => (prev + 1) % toolWarnings.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [toolWarnings]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const currentWarning = toolWarnings.length > 0 ? toolWarnings[currentWarningIndex] : null;

  return (
    <>
      {/* Warning Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-6 w-6 ${dialogWarning?.isMax ? 'text-red-500' : 'text-yellow-500'}`} />
              {dialogWarning?.isMax ? 'Maxgräns nådd!' : 'Varning - Byt verktyg snart'}
            </DialogTitle>
            <DialogDescription className="pt-4">
              {dialogWarning && (
                <div className="space-y-2">
                  <p className="font-semibold text-base">
                    Verktyg T{dialogWarning.plats} - {dialogWarning.benämning}
                  </p>
                  <p className="text-sm">
                    Antal körda artiklar: <span className="font-bold">{dialogWarning.partsSinceLastChange}</span> / {dialogWarning.maxgräns} ST
                  </p>
                  {dialogWarning.isMax ? (
                    <p className="text-red-600 font-semibold mt-2">
                      Maxgränsen har uppnåtts! Verktyget bör bytas omedelbart.
                    </p>
                  ) : (
                    <p className="text-yellow-600 font-semibold mt-2">
                      Varningsgränsen har uppnåtts. Överväg att byta verktyg snart.
                    </p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => {
                // Save warning acceptance to localStorage
                if (dialogWarning) {
                  saveWarningAcceptance(
                    dialogWarning.toolId,
                    dialogWarning.machineId,
                    dialogWarning.isMax,
                    dialogWarning.lastToolChangeDate
                  );
                }
                setShowDialog(false);
              }} 
              className="w-full"
            >
              Okej
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-[#507E95] text-white px-6 py-2 flex items-center justify-between h-12">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 fill-white" />
            <span className="font-semibold text-md">{activeMachine}</span>
          </div>
        </div>
      </div>

      {/* Tool warnings in center */}
      {currentWarning && (
        <div className="flex items-center gap-2 animate-pulse">
          <AlertTriangle className={`h-5 w-5 ${currentWarning.isMax ? 'text-red-300' : 'text-yellow-300'}`} />
          <span className="font-semibold">
            T{currentWarning.plats} {currentWarning.benämning} - {currentWarning.isMax ? 'Maxgräns nådd' : 'Byt snart'} ({currentWarning.partsSinceLastChange}/{currentWarning.maxgräns} ST)
          </span>
          {toolWarnings.length > 1 && (
            <span className="text-sm opacity-75">
              ({currentWarningIndex + 1}/{toolWarnings.length})
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
    </>
  );
}

