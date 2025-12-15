import { useState, useEffect } from "react";
import { MachineId } from "@/types";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SmorjaBackarnaProps {
  activeMachine: MachineId;
}

export default function SmorjaBackarna({ activeMachine }: SmorjaBackarnaProps) {
  const [smorjDatum, setSmorjDatum] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Extract machine number from activeMachine (e.g., "5701 Fanuc Robodrill" -> "5701")
  const machineNumber = activeMachine.split(' ')[0];

  useEffect(() => {
    fetchMachineData();
  }, [machineNumber]);

  const fetchMachineData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('verktygshanteringssystem_maskiner')
        .select('*')
        .eq('maskiner_nummer', machineNumber)
        .maybeSingle();

      if (error) throw error;

      setSmorjDatum((data as any)?.Datum_smörja_chuck || null);
    } catch (error) {
      console.error('Error fetching machine data:', error);
      setError('Ett fel uppstod vid laddning av maskindata');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysSince = (dateString: string | null): number | null => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString + 'T00:00:00'); // Add time to ensure correct date parsing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      console.error('Error calculating days since:', error);
      return null;
    }
  };

  const handleResetDateClick = () => {
    setShowConfirmDialog(true);
  };

  const handleResetDate = async () => {
    try {
      setIsUpdating(true);
      setShowConfirmDialog(false);
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { error } = await supabase
        .from('verktygshanteringssystem_maskiner')
        .update({ Datum_smörja_chuck: today } as any)
        .eq('maskiner_nummer', machineNumber);

      if (error) throw error;

      // Update local state immediately to trigger re-render
      setSmorjDatum(today);

      // Trigger custom event to update StatusBar
      window.dispatchEvent(new CustomEvent('smorjning-updated', { 
        detail: { machineNumber, date: today } 
      }));

      toast.success("Datum nollställt");
    } catch (error) {
      console.error('Error updating date:', error);
      toast.error("Kunde inte uppdatera datum");
    } finally {
      setIsUpdating(false);
    }
  };

  // Calculate days since - this will automatically update when smorjDatum changes
  const daysSince = calculateDaysSince(smorjDatum);
  const needsWarning = daysSince !== null && daysSince > 30;

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
        {error}
      </div>
    );
  }

  return (
    <>
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bekräfta nollställning</DialogTitle>
            <DialogDescription className="pt-4">
              Är du säker på att du vill nollställa datumet för smörjning av backarna?
              Detta kommer att sätta datumet till dagens datum.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isUpdating}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleResetDate}
              disabled={isUpdating}
              className="bg-white text-[#507E95] hover:bg-[#8BA5B8] border border-[#507E95] rounded-full px-6 py-2 flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uppdaterar...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Nollställ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-6">
        <div className="max-w-4xl">
          {/* NOLLSTÄLL Button at the top left */}
          <div className="flex justify-start mb-8">
            <Button 
              onClick={handleResetDateClick}
              disabled={isUpdating}
              className={`${
                !isUpdating
                  ? "bg-white text-[#507E95] hover:bg-[#8BA5B8] border border-[#507E95] " 
                  : "bg-white text-[#9DB5C8] hover:bg-[#8BA5B8] border border-[#7A95A8] cursor-not-allowed "
              } rounded-full px-6 py-2 flex items-center gap-2`}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uppdaterar...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  NOLLSTÄLL
                </>
              )}
            </Button>
          </div>

          {/* Information about when backarna was last smörjdes */}
          <div className="space-y-6">
            {daysSince !== null ? (
              <div className={`flex flex-col gap-4 p-6 rounded-lg ${
                needsWarning ? "bg-yellow-50 border-2 border-yellow-300" : "bg-gray-50 border border-gray-200"
              }`}>
                {needsWarning && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    <span className="text-yellow-700 font-semibold">Varning</span>
                  </div>
                )}
                <p className={`text-xl ${needsWarning ? "font-bold text-yellow-700" : "text-gray-700"}`}>
                  {daysSince} {daysSince === 1 ? "dag" : "dagar"} sedan backarna smordes.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-6 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xl text-gray-500">
                  Inget datum registrerat
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

