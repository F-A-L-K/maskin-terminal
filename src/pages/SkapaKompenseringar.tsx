import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MachineId } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Minus, Plus } from "lucide-react";

const KATEGORIER = ["(1) Logga", "(2) Matrixkod", "(3) Bakspår", "(4) Framspår"] as const;
const TYPER = ["X", "Y", "Vinkel"] as const;

const formSchema = z.object({
  kategori: z.enum(KATEGORIER, { required_error: "Välj kategori" }),
  typ: z.enum(TYPER, { required_error: "Välj minst en kompenseringstyp" }),
  värde: z.string().min(1, "Ange kompenseringsvärde").refine((v) => !isNaN(Number(v.replace(",", "."))), "Ogiltigt tal"),
  signatur: z.string().min(1, "Signatur är obligatoriskt"),
});

type FormValues = z.infer<typeof formSchema>;

interface SkapaKompenseringarProps {
  activeMachine: MachineId;
}

const checkboxClass = "h-5 w-5 rounded-md border-[#507E95] data-[state=checked]:bg-[#507E95] data-[state=checked]:border-[#507E95] data-[state=checked]:text-white [&>span>svg]:h-5 [&>span>svg]:w-5";
const SIGNATUR_SNABB = ["ToC", "FrF", "CaR"] as const;

export default function SkapaKompenseringar({ activeMachine }: SkapaKompenseringarProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kategori: undefined,
      typ: undefined,
      värde: "",
      signatur: "",
    },
  });

  const watchedValues = form.watch();
  const isFormValid =
    watchedValues.kategori &&
    watchedValues.typ &&
    watchedValues.värde &&
    !isNaN(Number(watchedValues.värde.replace(",", "."))) &&
    watchedValues.signatur.trim().length > 0;

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const machineNumber = activeMachine.split(" ")[0];
      const { data: machineData } = await supabase
        .from("verktygshanteringssystem_maskiner")
        .select("id")
        .eq("maskiner_nummer", machineNumber)
        .single();

      if (!machineData) {
        toast.error("Maskin hittades inte");
        return;
      }

      const numValue = Number(values.värde.replace(",", "."));
      const { error } = await supabase.from("verktygshanteringssystem_kompenseringar_manuella").insert({
        machine_id: machineData.id,
        kategori: values.kategori,
        typ: values.typ,
        värde: numValue,
        signatur: values.signatur.trim(),
      });

      if (error) {
        toast.error(error.message || "Kunde inte spara kompensering");
        return;
      }

      toast.success("Kompensering sparad");
      form.reset({ kategori: undefined, typ: undefined, värde: "", signatur: "" });
    } catch (err) {
      toast.error("Något gick fel");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* SPARA-knapp överst, samma stil som Skapa Verktygsbyte */}
            <div className="flex justify-start mb-8">
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`${
                  isFormValid && !isSubmitting
                    ? "bg-white text-[#507E95] hover:bg-[#8BA5B8] border border-[#507E95]"
                    : "bg-white text-[#9DB5C8] hover:bg-[#8BA5B8] border border-[#7A95A8] cursor-not-allowed"
                } rounded-full px-6 py-2 flex items-center gap-2`}
              >
                <Save className="h-4 w-4" />
                SPARA
              </Button>
            </div>

            {/* Kategori: 4 checkboxes i en box (endast en vald) */}
            <div className="">
              <FormField
                control={form.control}
                name="kategori"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-gray-600 text-sm font-medium">Kategori</FormLabel>
                    <div className="flex flex-wrap gap-6">
                      {KATEGORIER.map((k) => (
                        <label
                          key={k}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={field.value === k}
                            onCheckedChange={() => field.onChange(k)}
                            aria-label={k}
                            className={checkboxClass}
                          />
                          <span className="text-sm font-medium">{k}</span>
                        </label>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Kompenseringstyp: 3 checkboxes i en box (endast en vald), samma stil som Gammalt Verktyg */}
            <div className="">
              <FormField
                control={form.control}
                name="typ"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-gray-600 text-sm font-medium">Kompenseringstyp</FormLabel>
                    <div className="flex flex-wrap gap-6">
                      {TYPER.map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={field.value === t}
                            onCheckedChange={() => field.onChange(t)}
                            aria-label={t}
                            className={checkboxClass}
                          />
                          <span className="text-sm font-medium">{t}</span>
                        </label>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="värde"
              render={({ field }) => {
                const num = (v: string) => {
                  const n = Number(String(v).trim().replace(",", "."));
                  return Number.isFinite(n) ? n : 0;
                };
                const adjust = (delta: number) => {
                  const current = num(field.value);
                  const next = Math.round((current + delta) * 100) / 100;
                  field.onChange(next.toString().replace(".", ","));
                };
                const typVinkel = form.watch("typ") === "Vinkel";
                return (
                  <FormItem>
                    <FormLabel className="text-gray-600 text-sm font-medium">Kompenseringsvärde</FormLabel>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-[#507E95] text-[#507E95] hover:bg-[#507E95]/10"
                        onClick={() => adjust(-0.01)}
                        aria-label="Minska med 0,01"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          className="flex-1 min-w-0 max-w-[100px] text-center"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-[#507E95] text-[#507E95] hover:bg-[#507E95]/10"
                        onClick={() => adjust(0.01)}
                        aria-label="Öka med 0,01"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {typVinkel && (
                      <p className="text-xs text-muted-foreground mt-1">Plus är medurs.</p>
                    )}
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="signatur"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-600 text-sm font-medium">Signatur</FormLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {SIGNATUR_SNABB.map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[#507E95] text-[#507E95] hover:bg-[#507E95]/10"
                        onClick={() => field.onChange(s)}
                      >
                        {s}
                      </Button>
                    ))}
                    <FormControl className="flex-1  max-w-[100px] text-center">
                      <Input placeholder="_ _ _" {...field} />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  );
}
