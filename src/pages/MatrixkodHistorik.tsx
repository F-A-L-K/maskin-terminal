import { useState, useEffect } from "react";
import { MachineId } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MatrixkodHistorikProps {
  activeMachine: MachineId;
}

interface MatrixkodData {
  id: number;
  tillverkningsorder: string;
  matrixkod_datum: string;
  kommentar: string | null;
  created_at: string;
}

type EditingField = {
  id: number;
  field: "tillverkningsorder" | "matrixkod_datum" | "kommentar";
} | null;

export default function MatrixkodHistorik({ activeMachine }: MatrixkodHistorikProps) {
  const [matrixkoder, setMatrixkoder] = useState<MatrixkodData[]>([]);
  const [filteredMatrixkoder, setFilteredMatrixkoder] = useState<MatrixkodData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOrder, setSearchOrder] = useState("");
  const [searchMatrixkod, setSearchMatrixkod] = useState("");
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    fetchMatrixkoder();
  }, [activeMachine]);

  // Filter matrixkoder based on search terms
  useEffect(() => {
    let filtered = matrixkoder;

    if (searchOrder) {
      filtered = filtered.filter(item => 
        item.tillverkningsorder.toLowerCase().includes(searchOrder.toLowerCase())
      );
    }

    if (searchMatrixkod) {
      filtered = filtered.filter(item => 
        item.matrixkod_datum.toLowerCase().includes(searchMatrixkod.toLowerCase())
      );
    }

    setFilteredMatrixkoder(filtered);
  }, [matrixkoder, searchOrder, searchMatrixkod]);

  const fetchMatrixkoder = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('verktygshanteringssystem_matrixkoder')
        .select('*')
        .order('matrixkod_datum', { ascending: false });

      if (error) throw error;

      setMatrixkoder((data as MatrixkodData[]) || []);
      setFilteredMatrixkoder((data as MatrixkodData[]) || []);
    } catch (error) {
      console.error('Error fetching matrixkoder:', error);
      setError('Ett fel uppstod vid laddning av matrixkoder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (id: number, field: EditingField["field"], currentValue: string | null) => {
    setEditingField({ id, field });
    setEditValue(currentValue || "");
  };

  const handleSaveEdit = async (id: number, field: EditingField["field"]) => {
    try {
      const updateData: any = {};
      
      if (field === "tillverkningsorder") {
        updateData.tillverkningsorder = editValue;
      } else if (field === "matrixkod_datum") {
        updateData.matrixkod_datum = editValue;
      } else if (field === "kommentar") {
        updateData.kommentar = editValue || null;
      }

      const { error } = await supabase
        .from('verktygshanteringssystem_matrixkoder')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setMatrixkoder((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updateData } : item
        )
      );
      setFilteredMatrixkoder((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updateData } : item
        )
      );

      toast.success("Ändring sparad");
      setEditingField(null);
      setEditValue("");
    } catch (error) {
      console.error('Error updating matrixkod:', error);
      toast.error("Kunde inte spara ändring");
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: number, field: EditingField["field"]) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(id, field);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };


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
    <div className="p-6">
      {/* Search boxes */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Sök tillverkningsorder..."
            value={searchOrder}
            onChange={(e) => setSearchOrder(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Sök matrixkod..."
            value={searchMatrixkod}
            onChange={(e) => setSearchMatrixkod(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
      
      <div className=" overflow-hidden">
        <Table maxHeight="85vh">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%] text-center">Tillverkningsorder</TableHead>
              <TableHead className="w-[30%] text-center">Matrixkod (ÅÅMMDD)</TableHead>
              <TableHead className="w-[50%] text-center">Kommentar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMatrixkoder && filteredMatrixkoder.length > 0 ? (
              filteredMatrixkoder.map((matrixkod) => {
                const isEditingTillverkningsorder = editingField?.id === matrixkod.id && editingField?.field === "tillverkningsorder";
                const isEditingMatrixkod = editingField?.id === matrixkod.id && editingField?.field === "matrixkod_datum";
                const isEditingKommentar = editingField?.id === matrixkod.id && editingField?.field === "kommentar";

                return (
                  <TableRow key={matrixkod.id}>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleStartEdit(matrixkod.id, "tillverkningsorder", matrixkod.tillverkningsorder)}
                    >
                      {isEditingTillverkningsorder ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, matrixkod.id, "tillverkningsorder")}
                          onBlur={() => handleSaveEdit(matrixkod.id, "tillverkningsorder")}
                          className="h-8 text-center"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        matrixkod.tillverkningsorder
                      )}
                    </TableCell>
                    <TableCell 
                      className="font-medium text-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleStartEdit(matrixkod.id, "matrixkod_datum", matrixkod.matrixkod_datum)}
                    >
                      {isEditingMatrixkod ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, matrixkod.id, "matrixkod_datum")}
                          onBlur={() => handleSaveEdit(matrixkod.id, "matrixkod_datum")}
                          className="h-8 text-center"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        matrixkod.matrixkod_datum
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleStartEdit(matrixkod.id, "kommentar", matrixkod.kommentar)}
                    >
                      {isEditingKommentar ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, matrixkod.id, "kommentar")}
                          onBlur={() => handleSaveEdit(matrixkod.id, "kommentar")}
                          className="h-8 text-center"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        matrixkod.kommentar || "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                  Inga matrixkoder hittades
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
