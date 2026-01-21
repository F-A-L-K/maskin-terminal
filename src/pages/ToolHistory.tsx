import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Filter, X, Calendar, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useMachineFromUrl } from "@/hooks/useMachineFromUrl";
import { useState, useEffect } from "react";

export default function ToolHistory() {
  const { toolId, machineNumber } = useParams();
  const navigate = useNavigate();
  const { availableMachines } = useMachineFromUrl();
  
  // Find the active machine based on the machineNumber from URL
  const activeMachine = availableMachines.find(machine => machine.startsWith(machineNumber || '')) || availableMachines[0];
  const queryClient = useQueryClient();
  const [filteredData, setFilteredData] = useState<any[]>([]);
  
  // Filter states
  const [manufacturingOrder, setManufacturingOrder] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCauses, setSelectedCauses] = useState<string[]>([]);
  const [selectedSignatures, setSelectedSignatures] = useState<string[]>([]);
  const [availableCauses, setAvailableCauses] = useState<string[]>([]);
  const [availableSignatures, setAvailableSignatures] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: "comment" | "reason" | "manufacturingOrder" | "signature" } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Close editing mode when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingRowId && !(event.target as Element).closest('.editing-controls')) {
        setEditingRowId(null);
      }
      // Don't close if clicking on Select dropdown (it's in a portal)
      if (editingField && !(event.target as Element).closest('.editing-field') && 
          !(event.target as Element).closest('[role="listbox"]') &&
          !(event.target as Element).closest('[data-radix-select-content]')) {
        setEditingField(null);
        setEditValue("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingRowId, editingField]);

  // Fetch tool details
  const { data: tool, isLoading: toolLoading } = useQuery({
    queryKey: ['tool', toolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verktygshanteringssystem_verktyg')
        .select('*')
        .eq('id', toolId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!toolId,
  });

  // Fetch tool changes for this tool on this specific machine
  const { data: toolChanges, isLoading: changesLoading } = useQuery({
    queryKey: ['toolChanges', toolId, activeMachine],
    queryFn: async () => {
      if (!toolId || !activeMachine) return [];
      
      // Extract machine number from activeMachine and get machine ID
      const machineNumber = activeMachine.split(' ')[0];
      
      const { data: machineData } = await supabase
        .from('verktygshanteringssystem_maskiner')
        .select('id')
        .eq('maskiner_nummer', machineNumber)
        .single();
      
      if (!machineData) return [];
      
      const { data, error } = await supabase
        .from('verktygshanteringssystem_verktygsbyteslista')
        .select('*')
        .eq('tool_id', toolId)
        .eq('machine_id', machineData.id)
        .order('date_created', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!toolId && !!activeMachine,
  });

  // Extract unique causes and signatures for filter dropdowns
  useEffect(() => {
    if (!toolChanges) return;

    const causes = [...new Set(toolChanges.map(change => change.cause).filter(Boolean))];
    const signatures = [...new Set(toolChanges.map(change => change.signature).filter(Boolean))];
    
    setAvailableCauses(causes);
    setAvailableSignatures(signatures);
  }, [toolChanges]);

  // Filter data based on all filter criteria
  useEffect(() => {
    if (!toolChanges) return;

    let filtered = toolChanges;

    // Apply manufacturing order filter
    if (manufacturingOrder) {
      filtered = filtered.filter((change: any) => 
        change.manufacturing_order?.toLowerCase().includes(manufacturingOrder.toLowerCase())
      );
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((change: any) => 
        new Date(change.date_created) >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((change: any) => 
        new Date(change.date_created) <= toDate
      );
    }

    // Apply cause filter
    if (selectedCauses.length > 0) {
      filtered = filtered.filter((change: any) => 
        selectedCauses.includes(change.cause)
      );
    }

    // Apply signature filter
    if (selectedSignatures.length > 0) {
      filtered = filtered.filter((change: any) => 
        selectedSignatures.includes(change.signature)
      );
    }

    setFilteredData(filtered);
  }, [toolChanges, manufacturingOrder, dateFrom, dateTo, selectedCauses, selectedSignatures]);

  const clearAllFilters = () => {
    setManufacturingOrder("");
    setDateFrom("");
    setDateTo("");
    setSelectedCauses([]);
    setSelectedSignatures([]);
  };

  const toggleCause = (cause: string) => {
    setSelectedCauses(prev => 
      prev.includes(cause) 
        ? prev.filter(c => c !== cause)
        : [...prev, cause]
    );
  };

  const toggleSignature = (signature: string) => {
    setSelectedSignatures(prev => 
      prev.includes(signature) 
        ? prev.filter(s => s !== signature)
        : [...prev, signature]
    );
  };

  // Function to update field (comment, reason, manufacturingOrder, signature)
  const updateField = async (changeId: string, field: "comment" | "reason" | "manufacturingOrder" | "signature", value: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const updateData: any = {};
      
      if (field === "comment") {
        updateData.comment = value;
      } else if (field === "reason") {
        updateData.cause = value;
      } else if (field === "manufacturingOrder") {
        updateData.manufacturing_order = value;
      } else if (field === "signature") {
        updateData.signature = value.toUpperCase();
      }

      const { error } = await supabase
        .from('verktygshanteringssystem_verktygsbyteslista')
        .update(updateData)
        .eq('id', changeId);

      if (error) throw error;

      // Refresh the data
      await queryClient.invalidateQueries({ queryKey: ['toolChanges', toolId, activeMachine] });
      
      toast.success('Fält uppdaterat');
      setEditingField(null);
      setEditValue("");
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Kunde inte uppdatera fält');
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to update the number of parts
  const updatePartsCount = async (changeId: string, delta: number) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      // Get the current change
      const currentChange = filteredData.find(change => change.id === changeId);
      if (!currentChange) return;

      // Calculate new values for current change
      const currentParts = currentChange.number_of_parts_ADAM || 0;
      const currentAmount = currentChange.amount_since_last_change || 0;
      
      const newParts = currentParts + delta;
      const newAmount = currentAmount + delta;

      // Update the current change
      const { error: updateError } = await supabase
        .from('verktygshanteringssystem_verktygsbyteslista')
        .update({ 
          number_of_parts_ADAM: newParts,
          amount_since_last_change: newAmount
        })
        .eq('id', changeId);

      if (updateError) throw updateError;

      // Update the next change (the one that was made after this one)
      // Since data is ordered by date_created DESC, the "next" change is at currentIndex - 1
      const currentIndex = filteredData.findIndex(change => change.id === changeId);
      const nextChange = filteredData[currentIndex - 1]; // Previous in chronological order (descending)
      
      if (nextChange) {
        // The next change's amount_since_last_change should be updated
        // because the difference between the changes has changed
        const nextCurrentAmount = nextChange.amount_since_last_change || 0;
        const nextNewAmount = nextCurrentAmount - delta; // Opposite delta because it's the difference
        
        const { error: nextUpdateError } = await supabase
          .from('verktygshanteringssystem_verktygsbyteslista')
          .update({ 
            amount_since_last_change: nextNewAmount
          })
          .eq('id', nextChange.id);

        if (nextUpdateError) throw nextUpdateError;
      }

      // Refresh the data
      await queryClient.invalidateQueries({ queryKey: ['toolChanges', toolId, activeMachine] });
      
      toast.success(`Antal körda uppdaterat med ${delta > 0 ? '+' : ''}${delta}`);
      
    } catch (error) {
      console.error('Error updating parts count:', error);
      toast.error('Kunde inte uppdatera antal körda');
    } finally {
      setIsUpdating(false);
      setEditingRowId(null);
    }
  };

  const isLoading = toolLoading || changesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">
          Verktyget hittades inte
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Compact Tool Info & Filters */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        {/* Collapsed Header - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground">T{tool.plats}</span>
              <div className="h-6 w-px bg-border"></div>
              <span className="text-base font-semibold text-foreground">{tool.benämning}</span>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t bg-muted/20">
            <div className="p-4 space-y-4">
              {/* Additional Tool Details */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Artikelnummer</p>
                  <p className="text-sm font-medium text-foreground">{tool.artikelnummer || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max gräns</p>
                  <p className="text-sm font-semibold text-foreground">
                    {tool.maxgräns || "-"} <span className="text-xs text-muted-foreground">ST</span>
                  </p>
                </div>
              </div>

              {/* Search Filters */}
              <div className="space-y-3">
                
                {/* Tillverkningsorder and Avancerade filter row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tillverkningsorder
                    </label>
                    <Input
                      placeholder="Sök..."
                      value={manufacturingOrder}
                      onChange={(e) => setManufacturingOrder(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Anledning & Signatur
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full h-9 justify-start">
                          <Filter className="h-3 w-3 mr-2" />
                          Filter
                          {(selectedCauses.length + selectedSignatures.length) > 0 && (
                            <span className="ml-auto bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[18px] h-[18px] flex items-center justify-center">
                              {selectedCauses.length + selectedSignatures.length}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80 bg-popover z-50" align="end">
                        <div className="p-3">
                          <div className="mb-3">
                            <h4 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-2">
                              <span className="w-1 h-3 bg-primary rounded-full"></span>
                              Anledning
                            </h4>
                            <div className="space-y-1 max-h-28 overflow-y-auto">
                              {availableCauses.length > 0 ? (
                                availableCauses.map((cause) => (
                                  <DropdownMenuCheckboxItem
                                    key={cause}
                                    checked={selectedCauses.includes(cause)}
                                    onCheckedChange={() => toggleCause(cause)}
                                    className="text-sm"
                                  >
                                    {cause}
                                  </DropdownMenuCheckboxItem>
                                ))
                              ) : (
                                <div className="text-sm text-muted-foreground py-1 px-2">Inga anledningar tillgängliga</div>
                              )}
                            </div>
                          </div>
                          <div className="mb-3">
                            <h4 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-2">
                              <span className="w-1 h-3 bg-primary rounded-full"></span>
                              Signatur
                            </h4>
                            <div className="space-y-1 max-h-28 overflow-y-auto">
                              {availableSignatures.length > 0 ? (
                                availableSignatures.map((signature) => (
                                  <DropdownMenuCheckboxItem
                                    key={signature}
                                    checked={selectedSignatures.includes(signature)}
                                    onCheckedChange={() => toggleSignature(signature)}
                                    className="text-sm"
                                  >
                                    {signature}
                                  </DropdownMenuCheckboxItem>
                                ))
                              ) : (
                                <div className="text-sm text-muted-foreground py-1 px-2">Inga signaturer tillgängliga</div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearAllFilters}
                              className="text-xs h-7 px-2"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Rensa alla
                            </Button>
                            <div className="text-xs font-medium text-muted-foreground">
                              {selectedCauses.length + selectedSignatures.length} valda
                            </div>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Från datum
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 pointer-events-none" />
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Till datum
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 pointer-events-none" />
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <Table maxHeight="70vh">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-[10%]">Tid</TableHead>
              <TableHead className="text-center w-[10%]">Anledning</TableHead>
              <TableHead className="text-center w-[10%]">Tillverkningsorder</TableHead>
              <TableHead className="text-center w-[10%]">Antal körda</TableHead>
              <TableHead className="text-center w-[10%]">Signatur</TableHead>
              <TableHead className="text-center w-[20%]">Kommentar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((change) => {
                const isEditingComment = editingField?.id === change.id && editingField?.field === "comment";
                const isEditingReason = editingField?.id === change.id && editingField?.field === "reason";
                const isEditingManufacturingOrder = editingField?.id === change.id && editingField?.field === "manufacturingOrder";
                const isEditingSignature = editingField?.id === change.id && editingField?.field === "signature";

                return (
                  <TableRow key={change.id}>
                    <TableCell className="text-center">
                      {format(new Date(change.date_created), "yyyy-MM-dd HH:mm", { locale: sv })}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors editing-field"
                      onClick={(e) => {
                        if (!isEditingReason && !(e.target as HTMLElement).closest('button, input, select, [role="listbox"]')) {
                          setEditingField({ id: change.id, field: "reason" });
                          setEditValue(change.cause || "");
                        }
                      }}
                    >
                      {isEditingReason ? (
                        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                          <Select
                            value={editValue}
                            onValueChange={async (value) => {
                              await updateField(change.id, "reason", value);
                              // updateField already closes editing, but ensure it's closed
                              setEditingField(null);
                              setEditValue("");
                            }}
                          >
                            <SelectTrigger 
                              className="h-8 w-full"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent 
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <SelectItem value="Slitage">Slitage</SelectItem>
                              <SelectItem value="Verktygsbrott">Verktygsbrott</SelectItem>
                              <SelectItem value="Övrigt">Övrigt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span>
                          {change.cause || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors editing-field"
                      onClick={(e) => {
                        if (!isEditingManufacturingOrder && !(e.target as HTMLElement).closest('input')) {
                          setEditingField({ id: change.id, field: "manufacturingOrder" });
                          setEditValue(change.manufacturing_order || "");
                        }
                      }}
                    >
                      {isEditingManufacturingOrder ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => updateField(change.id, "manufacturingOrder", editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateField(change.id, "manufacturingOrder", editValue);
                            } else if (e.key === "Escape") {
                              setEditingField(null);
                              setEditValue("");
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-center"
                          autoFocus
                        />
                      ) : (
                        change.manufacturing_order || "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {editingRowId === change.id ? (
                        <div className="flex items-center justify-center gap-2 editing-controls">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePartsCount(change.id, -1)}
                            disabled={isUpdating}
                            className="h-6 w-6 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="min-w-[2rem] text-center font-medium">
                            {change.amount_since_last_change ?? "-"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePartsCount(change.id, 1)}
                            disabled={isUpdating}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingRowId(change.id)}
                          className="hover:bg-muted rounded px-2 py-1 transition-colors"
                          disabled={isUpdating}
                        >
                          {change.amount_since_last_change ?? "-"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors editing-field"
                      onClick={(e) => {
                        if (!isEditingSignature && !(e.target as HTMLElement).closest('input')) {
                          setEditingField({ id: change.id, field: "signature" });
                          setEditValue(change.signature || "");
                        }
                      }}
                    >
                      {isEditingSignature ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => updateField(change.id, "signature", editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateField(change.id, "signature", editValue);
                            } else if (e.key === "Escape") {
                              setEditingField(null);
                              setEditValue("");
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-center"
                          autoFocus
                        />
                      ) : (
                        change.signature || "-"
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors editing-field"
                      onClick={(e) => {
                        if (!isEditingComment && !(e.target as HTMLElement).closest('textarea')) {
                          setEditingField({ id: change.id, field: "comment" });
                          setEditValue(change.comment || "");
                        }
                      }}
                    >
                      {isEditingComment ? (
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => updateField(change.id, "comment", editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              updateField(change.id, "comment", editValue);
                            } else if (e.key === "Escape") {
                              setEditingField(null);
                              setEditValue("");
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="min-h-[60px] resize-none"
                          autoFocus
                        />
                      ) : (
                        <span className="block text-left px-2">{change.comment || "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {manufacturingOrder || dateFrom || dateTo || selectedCauses.length > 0 || selectedSignatures.length > 0 
                    ? "Inga verktygsbyten matchade filtren" 
                    : "Inga verktygsbyten hittades för detta verktyg"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
