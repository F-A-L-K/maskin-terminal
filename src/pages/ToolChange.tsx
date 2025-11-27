
import { useState, useEffect } from "react";
import ToolChangeForm from "@/components/ToolChangeForm";
import ToolChangeList from "@/components/ToolChangeList";
import { ToolChange, MachineId } from "@/types";
import { useLastManufacturingOrder } from "@/hooks/useLastManufacturingOrder";
import { supabase } from "@/integrations/supabase/client";

interface ToolChangePageProps {
  activeMachine: MachineId;
}

export default function ToolChangePage({ activeMachine }: ToolChangePageProps) {
  const [toolChanges, setToolChanges] = useState<ToolChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestManufacturingOrder, setLatestManufacturingOrder] = useState<string>("");
  const { setLastOrder, getLastOrder } = useLastManufacturingOrder();

  // Fetch tool changes from Supabase
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    (supabase as any)
      .from("verktygshanteringssystem_verktygsbyteslista")
      .select(
        "id, machine_number, tool_number, cause, comment, signature, date_created, manufacturing_order, number_of_parts_ADAM, amount_since_last_change"
      )
      .eq("machine_number", activeMachine)
      .order("date_created", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError("Kunde inte hämta verktygsbyten.");
          setLoading(false);
          return;
        }
        
        const mapped =
          data?.map((item) => ({
            id: item.id,
            machineId: item.machine_number ?? "",
            manufacturingOrder: item.manufacturing_order ?? "",
            toolNumber: item.tool_number ?? "",
            reason: (item.cause ?? "Slitage") as ToolChange["reason"],
            comment: item.comment ?? "",
            signature: item.signature ?? "",
            timestamp: new Date(item.date_created),
            number_of_parts_ADAM: item.number_of_parts_ADAM,
            amount_since_last_change: item.amount_since_last_change,
          })) || [];
        
        setToolChanges(mapped);
        if (mapped.length > 0) {
          setLatestManufacturingOrder(mapped[0].manufacturingOrder);
        }
        setLoading(false);
      });
  }, [activeMachine]);

  // Add new tool change to Supabase & local state
  const handleAddToolChange = async (toolChange: ToolChange) => {
    // Save to Supabase
    const { error } = await (supabase as any).from("verktygshanteringssystem_verktygsbyteslista").insert({
      id: toolChange.id,
      machine_number: toolChange.machineId,
      manufacturing_order: toolChange.manufacturingOrder,
      tool_number: toolChange.toolNumber,
      cause: toolChange.reason,
      comment: toolChange.comment,
      signature: toolChange.signature.toUpperCase(),
      date_created: toolChange.timestamp.toISOString(),
      number_of_parts_ADAM: toolChange.number_of_parts_ADAM ? Number(toolChange.number_of_parts_ADAM) : 0,
    });
    if (error) {
      setError("Kunde inte spara verktygsbyte.");
      return;
    }
    setToolChanges((prev) => [...prev, toolChange]);
    if (toolChange.manufacturingOrder) {
      setLastOrder(activeMachine, toolChange.manufacturingOrder);
    }
  };

  // Update tool change in Supabase & local state
  const handleUpdateToolChange = async (id: string, updates: Partial<ToolChange>) => {
    const updateData: any = {};
    
    if (updates.comment !== undefined) updateData.comment = updates.comment;
    if (updates.reason !== undefined) updateData.cause = updates.reason;
    if (updates.manufacturingOrder !== undefined) updateData.manufacturing_order = updates.manufacturingOrder;
    if (updates.signature !== undefined) updateData.signature = updates.signature.toUpperCase();

    const { error } = await (supabase as any)
      .from("verktygshanteringssystem_verktygsbyteslista")
      .update(updateData)
      .eq("id", id);

    if (error) {
      setError("Kunde inte uppdatera verktygsbyte.");
      return;
    }

    // Update local state
    setToolChanges((prev) =>
      prev.map((change) =>
        change.id === id ? { ...change, ...updates } : change
      )
    );

    if (updates.manufacturingOrder) {
      setLastOrder(activeMachine, updates.manufacturingOrder);
    }
  };

  return (
    <div className="space-y-6">

      {error && (
        <div className="text-red-600 px-2">{error}</div>
      )}
      {loading ? (
        <div className="text-gray-500 px-2">Laddar verktygsbyten...</div>
      ) : (
        <ToolChangeList toolChanges={toolChanges} onUpdate={handleUpdateToolChange} />
      )}
    </div>
  );
}
