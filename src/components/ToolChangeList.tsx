import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolChange } from "@/types";
import { format } from "date-fns";

interface ToolChangeListProps {
  toolChanges: ToolChange[];
  onUpdate: (id: string, updates: Partial<ToolChange>) => Promise<void>;
}

type EditingField = {
  id: string;
  field: "comment" | "reason" | "manufacturingOrder" | "signature";
} | null;

export default function ToolChangeList({ toolChanges, onUpdate }: ToolChangeListProps) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState<string>("");
  
  const sortedChanges = [...toolChanges].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const handleStartEdit = (id: string, field: EditingField["field"], currentValue: string) => {
    setEditingField({ id, field });
    setEditValue(currentValue);
  };

  const handleSaveEdit = async (id: string, field: EditingField["field"]) => {
    const updates: Partial<ToolChange> = {};
    
    if (field === "comment") {
      updates.comment = editValue;
    } else if (field === "reason") {
      updates.reason = editValue as ToolChange["reason"];
    } else if (field === "manufacturingOrder") {
      updates.manufacturingOrder = editValue;
    } else if (field === "signature") {
      updates.signature = editValue;
    }

    await onUpdate(id, updates);
    setEditingField(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: EditingField["field"]) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(id, field);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div className="p-6">
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10%] text-center">Signatur</TableHead>
              <TableHead className="w-[12%] text-center">Datum</TableHead>   
              <TableHead className="w-[8%] text-center">Verktyg</TableHead>
              <TableHead className="w-[10%] text-center">Tillverkningsorder</TableHead>
              <TableHead className="w-[10%] text-center">Anledning</TableHead>
              <TableHead className="w-[10%] text-center">Körda artiklar</TableHead>
              <TableHead className="w-[40%] text-center">Kommentar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedChanges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  Inga verktygsbyten registrerade
                </TableCell>
              </TableRow>
            ) : (
              sortedChanges.map((change, index) => {
                const isEditingSignature = editingField?.id === change.id && editingField?.field === "signature";
                const isEditingComment = editingField?.id === change.id && editingField?.field === "comment";
                const isEditingReason = editingField?.id === change.id && editingField?.field === "reason";
                const isEditingManufacturingOrder = editingField?.id === change.id && editingField?.field === "manufacturingOrder";

                return (
                  <TableRow key={change.id}>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => !isEditingSignature && handleStartEdit(change.id, "signature", change.signature)}
                    >
                      {isEditingSignature ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(change.id, "signature")}
                          onKeyDown={(e) => handleKeyDown(e, change.id, "signature")}
                          className="h-8 text-center"
                          autoFocus
                        />
                      ) : (
                        change.signature
                      )}
                    </TableCell>
                    <TableCell className="text-center">{format(change.timestamp, "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell className="font-medium text-center">{change.toolNumber}</TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => !isEditingManufacturingOrder && handleStartEdit(change.id, "manufacturingOrder", change.manufacturingOrder)}
                    >
                      {isEditingManufacturingOrder ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(change.id, "manufacturingOrder")}
                          onKeyDown={(e) => handleKeyDown(e, change.id, "manufacturingOrder")}
                          className="h-8 text-center"
                          autoFocus
                        />
                      ) : (
                        change.manufacturingOrder || "-"
                      )}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => !isEditingReason && handleStartEdit(change.id, "reason", change.reason)}
                    >
                      {isEditingReason ? (
                        <Select
                          value={editValue}
                          onValueChange={async (value) => {
                            setEditValue(value);
                            const updates: Partial<ToolChange> = { reason: value as ToolChange["reason"] };
                            await onUpdate(change.id, updates);
                            setEditingField(null);
                            setEditValue("");
                          }}
                          onOpenChange={(open) => {
                            if (!open && isEditingReason) {
                              handleCancelEdit();
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Slitage">Slitage</SelectItem>
                            <SelectItem value="Verktygsbrott">Verktygsbrott</SelectItem>
                            <SelectItem value="Övrigt">Övrigt</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>
                          {change.reason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {change.amount_since_last_change ? (
                        <span>{change.amount_since_last_change} <span className="text-blue-500">ST</span></span>
                      ) : "-"}
                    </TableCell>
                    <TableCell 
                      className="text-center cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => !isEditingComment && handleStartEdit(change.id, "comment", change.comment || "")}
                    >
                      {isEditingComment ? (
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(change.id, "comment")}
                          onKeyDown={(e) => handleKeyDown(e, change.id, "comment")}
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
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
