import { useState, useEffect } from "react";
import { generateUUID } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel 
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MachineId, ToolChange } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdamBoxValue } from "@/lib/adambox";
import { useTools } from "@/hooks/useTools";
import { getMachineStatus, extractWorkCenterFromMachineId } from "@/lib/machinestatus";

const formSchema = z.object({
  toolNumber: z.string().min(1, "Verktygsnummer är obligatoriskt"),
  reason: z.enum(["Slitage", "Verktygsbrott", 'Övrigt'], {
    required_error: "Välj en anledning",
  }),
  signature: z.string().min(1, "Signatur är obligatoriskt"),
  comment: z.string().optional(),
  manufacturingOrder: z.string().optional(),
  switchInOldTool: z.boolean().optional(),
  extraPartsOldTool: z.number().optional(),
}).refine((data) => {
  // If reason is "Övrigt", comment must be filled
  if (data.reason === "Övrigt") {
    return data.comment && data.comment.trim().length > 0;
  }
  return true;
}, {
  message: "Kommentar är obligatoriskt när anledning är Övrigt",
  path: ["comment"],
}).refine((data) => {
  // If switchInOldTool is checked, extraPartsOldTool must be provided
  if (data.switchInOldTool) {
    return data.extraPartsOldTool !== undefined && data.extraPartsOldTool >= 0;
  }
  return true;
}, {
  message: "Antal bitar är obligatoriskt när du växlar in gammalt verktyg",
  path: ["extraPartsOldTool"],
});

interface CreateToolChangeProps {
  activeMachine: MachineId;
}

export default function CreateToolChange({ activeMachine }: CreateToolChangeProps) {
  const [isLoadingAdamBox, setIsLoadingAdamBox] = useState(false);
  const [adamBoxValue, setAdamBoxValue] = useState<number | null>(null);
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [activeManufacturingOrder, setActiveManufacturingOrder] = useState<string>("");
  const { data: tools } = useTools();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toolNumber: "",
      reason: undefined,
      signature: "",
      comment: "",
      manufacturingOrder: "",
      switchInOldTool: false,
      extraPartsOldTool: undefined,
    },
  });

  // Watch form values to determine if save button should be enabled
  const watchedValues = form.watch();
  const isFormValid = 
    watchedValues.toolNumber && 
    watchedValues.reason && 
    watchedValues.signature &&
    (watchedValues.reason !== "Övrigt" || (watchedValues.comment && watchedValues.comment.trim().length > 0)) &&
    (!watchedValues.switchInOldTool || (watchedValues.extraPartsOldTool !== undefined && watchedValues.extraPartsOldTool >= 0));

  // Get AdamBox value and manufacturing order when component mounts
  useEffect(() => {
    fetchAdamBoxValue();
    fetchManufacturingOrder();
  }, [activeMachine]);

  const fetchManufacturingOrder = async () => {
    try {
      const workCenter = extractWorkCenterFromMachineId(activeMachine);
      const statusData = await getMachineStatus(workCenter);
      
      if (statusData.active_order?.order_number) {
        setActiveManufacturingOrder(statusData.active_order.order_number);
        form.setValue("manufacturingOrder", statusData.active_order.order_number);
      } else {
        setActiveManufacturingOrder("");
        form.setValue("manufacturingOrder", "");
      }
    } catch (error) {
      console.error('Error fetching manufacturing order:', error);
      setActiveManufacturingOrder("");
      form.setValue("manufacturingOrder", "");
    }
  };

  const fetchAdamBoxValue = async () => {
    setIsLoadingAdamBox(true);
    try {
      const value = await getAdamBoxValue(activeMachine);
      setAdamBoxValue(value);
    } catch (error) {
      console.error('Error fetching AdamBox value:', error);
      setAdamBoxValue(null);
    } finally {
      setIsLoadingAdamBox(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Find the tool ID from the tool number
    const selectedTool = tools?.find(tool => tool.id === values.toolNumber);
    const toolNumber = selectedTool?.plats || "";

    // Get machine ID from database
    const machineNumber = activeMachine.split(' ')[0];
    const { data: machineData } = await supabase
      .from('verktygshanteringssystem_maskiner')
      .select('id')
      .eq('maskiner_nummer', machineNumber)
      .single();

    if (!machineData) {
      toast.error("Maskin hittades inte");
      return;
    }

    // Get the previous tool change for this tool to calculate the difference
    let amountSinceLastChange: number | null = null;
    if (adamBoxValue !== null && values.toolNumber) {
      try {
        const { data: previousChanges } = await (supabase as any)
          .from("verktygshanteringssystem_verktygsbyteslista")
          .select("number_of_parts_ADAM, extra_parts_old_tool")
          .eq("tool_id", values.toolNumber)
          .eq("machine_id", machineData.id)
          .order("date_created", { ascending: false })
          .limit(1);

        if (previousChanges && previousChanges.length > 0) {
          const previousAdamValue = previousChanges[0].number_of_parts_ADAM;
          const previousExtraPartsOldTool = previousChanges[0].extra_parts_old_tool;
          
          if (previousAdamValue !== null) {
            amountSinceLastChange = adamBoxValue - previousAdamValue;
            
            // Add the previous record's extra_parts_old_tool if it exists
            // This represents parts the tool already had when it was put in last time
            if (previousExtraPartsOldTool !== null && previousExtraPartsOldTool > 0) {
              amountSinceLastChange += previousExtraPartsOldTool;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching previous tool change:", error);
      }
    }

    const newToolChange: ToolChange = {
      id: generateUUID(),
      machineId: activeMachine,
      manufacturingOrder: values.manufacturingOrder || "",
      toolNumber: values.toolNumber,
      reason: values.reason,
      comment: values.comment || "",
      signature: values.signature,
      timestamp: new Date(),
      number_of_parts_ADAM: adamBoxValue || null,
      amount_since_last_change: amountSinceLastChange,
    };

    // Save to Supabase
    const { error } = await (supabase as any).from("verktygshanteringssystem_verktygsbyteslista").insert({
      id: newToolChange.id,
      machine_id: machineData.id,
      manufacturing_order: newToolChange.manufacturingOrder,
      tool_id: values.toolNumber,
      cause: newToolChange.reason,
      comment: newToolChange.comment,
      signature: values.signature.toUpperCase(),
      date_created: newToolChange.timestamp.toISOString(),
      number_of_parts_ADAM: adamBoxValue || null,
      amount_since_last_change: amountSinceLastChange,
      extra_parts_old_tool: values.switchInOldTool ? values.extraPartsOldTool : null,
    });

    if (error) {
      toast.error("Kunde inte spara verktygsbyte");
      return;
    }

    toast.success("Verktygsbyte sparat");
    
    // Reset form
    form.reset({
      toolNumber: "",
      reason: undefined,
      signature: "",
      comment: "",
      manufacturingOrder: activeManufacturingOrder, // Keep the manufacturing order
      switchInOldTool: false,
      extraPartsOldTool: undefined,
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl">
  
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Save Button at the top */}
              <div className="flex justify-start mb-8">
                <Button 
                  type="submit" 
                  disabled={!isFormValid}
                  className={`${
                    isFormValid 
                      ? "bg-white text-[#507E95] hover:bg-[#8BA5B8] border border-[#507E95] " 
                      : "bg-white text-[#9DB5C8] hover:bg-[#8BA5B8] border border-[#7A95A8] cursor-not-allowed "
                  } rounded-full px-6 py-2 flex items-center gap-2`}
                >
                  <Save className="h-4 w-4" />
                  SPARA
                </Button>
              </div>

              <FormField
                control={form.control}
                name="manufacturingOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600 text-sm font-medium">Tillverkningsorder</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Tillverkningsorder" 
                        readOnly
                        className="bg-gray-50"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toolNumber"
                render={({ field }) => {
                  const selectedTool = tools?.find(tool => tool.id === field.value);
                  const sortedTools = tools?.sort((a, b) => {
                    const numA = parseInt(a.plats || "0");
                    const numB = parseInt(b.plats || "0");
                    return numA - numB;
                  }) || [];

                  return (
                    <FormItem>
                      <FormLabel className="text-gray-600 text-sm font-medium ">Verktyg</FormLabel>
                      <FormControl>
                        <Popover open={toolDropdownOpen} onOpenChange={setToolDropdownOpen} >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={toolDropdownOpen}
                              className="w-full justify-between hover:bg-[#f3f3f3] hover:text-black"
                            >
                              {selectedTool ? (
                                `T${selectedTool.plats} ${selectedTool.benämning}`
                              ) : (
                                "Välj verktyg"
                              )}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="max-h-96 overflow-y-auto">
                              <div className="grid grid-cols-4 gap-0">
                                {sortedTools.map((tool) => (
                                  <div
                                    key={tool.id}
                                    className={`flex items-center space-x-2 px-4 py-2 cursor-pointer hover:bg-[#f3f3f3]  ${
                                      field.value === tool.id ? "bg-[#f3f3f3]" : ""
                                    }`}
                                    onClick={() => {
                                      field.onChange(tool.id);
                                      setToolDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={`h-4 w-4 ${
                                        field.value === tool.id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">
                                        T{tool.plats}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {tool.benämning}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                    </FormItem>
                  );
                }}
              />
              
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => {
                  const reasons = [
                    { value: "Slitage", label: "Slitage" },
                    { value: "Verktygsbrott", label: "Verktygsbrott" },
                    { value: "Övrigt", label: "Övrigt" }
                  ];
                  const selectedReason = reasons.find(reason => reason.value === field.value);

                  return (
                    <FormItem>
                      <FormLabel className="text-gray-600 text-sm font-medium">Anledning</FormLabel>
                      <FormControl>
                        <Popover open={reasonDropdownOpen} onOpenChange={setReasonDropdownOpen}>
                          <PopoverTrigger asChild>
        <Button 
                              variant="outline"
                              role="combobox"
                              aria-expanded={reasonDropdownOpen}
                              className="w-full justify-between hover:bg-[#f3f3f3] hover:text-black"
                            >
                              {selectedReason ? (
                                selectedReason.label
                              ) : (
                                "Välj anledning"
                              )}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="max-h-96 overflow-y-auto">
                              <div className="grid grid-cols-1 gap-0">
                                {reasons.map((reason) => (
                                  <div
                                    key={reason.value}
                                    className={`flex items-center space-x-2 px-4 py-2 cursor-pointer hover:bg-[#f3f3f3] ${
                                      field.value === reason.value ? "bg-[#f3f3f3]" : ""
                                    }`}
                                    onClick={() => {
                                      field.onChange(reason.value);
                                      setReasonDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={`h-4 w-4 ${
                                        field.value === reason.value ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">
                                        {reason.label}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                    </FormItem>
                  );
                }}
              />


              <FormField
                control={form.control}
                name="signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600 text-sm font-medium">Signatur</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ange signatur" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Switch in old tool checkbox and extra parts input */}
              <FormField
                control={form.control}
                name="switchInOldTool"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-gray-600 text-sm font-medium cursor-pointer">
                        Växla in gammalt verktyg
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Ange antal bitar som det gamla verktyget har gått
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {watchedValues.switchInOldTool && (
                <FormField
                  control={form.control}
                  name="extraPartsOldTool"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-600 text-sm font-medium">
                        Antal bitar (gammalt verktyg)<span className="text-red-600 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Ange antal bitar"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? undefined : parseInt(value, 10));
                          }}
                        />
                      </FormControl>
                      {watchedValues.switchInOldTool && field.value === undefined && (
                        <p className="text-sm text-red-600 mt-1">
                          Antal bitar är obligatoriskt när du växlar in gammalt verktyg
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              )}

             

              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => {
                  const isCommentRequired = watchedValues.reason === "Övrigt";
                  return (
                    <FormItem>
                      <FormLabel className="text-gray-600 text-sm font-medium">
                        Kommentar{isCommentRequired && <span className="text-red-600 ml-1">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={isCommentRequired ? "Kommentar är obligatoriskt för Övrigt" : "Skriv en kommentar (valfritt)"}
                          className={isCommentRequired && !field.value ? "border-red-300" : ""}
                        />
                      </FormControl>
                      {isCommentRequired && !field.value && (
                        <p className="text-sm text-red-600 mt-1">
                          Kommentar är obligatoriskt när anledning är Övrigt
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />

            </form>
          </Form>
      </div>
    </div>
  );
}
