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
import { format } from "date-fns";

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

interface CompensationListProps {
  compensations: Compensation[];
}

export default function CompensationList({ compensations }: CompensationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredCompensations = compensations.filter((comp) => {
    const query = searchQuery.toLowerCase();
    return (
      comp.tool_number.toString().includes(query) ||
      (comp.cutter_radius_geometry !== null && comp.cutter_radius_geometry.toString().includes(query)) ||
      (comp.cutter_radius_wear !== null && comp.cutter_radius_wear.toString().includes(query)) ||
      (comp.tool_length_geometry !== null && comp.tool_length_geometry.toString().includes(query)) ||
      (comp.tool_length_wear !== null && comp.tool_length_wear.toString().includes(query))
    );
  });
  
  const sortedCompensations = [...filteredCompensations].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Helper function to format offset values (they are in 0.001mm units typically)
  const formatOffset = (value: number | null): string => {
    if (value === null) return "-";
    // Assuming values are in 0.001mm units, convert to mm
    return `${(value / 1000).toFixed(3)} mm`;
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Input
          placeholder="Sök efter verktygsnummer eller värde..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10%] text-center">Datum</TableHead>
              <TableHead className="w-[8%] text-center">Verktyg</TableHead>
              <TableHead className="w-[20%] text-center">Cutter Radius Geometry</TableHead>
              <TableHead className="w-[20%] text-center">Cutter Radius Wear</TableHead>
              <TableHead className="w-[20%] text-center">Tool Length Geometry</TableHead>
              <TableHead className="w-[20%] text-center">Tool Length Wear</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCompensations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Inga kompenseringsvärden registrerade
                </TableCell>
              </TableRow>
            ) : (
              sortedCompensations.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell className="text-center">
                    {format(new Date(comp.date), "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium text-center">
                    {comp.tool_number}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {formatOffset(comp.cutter_radius_geometry)}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {formatOffset(comp.cutter_radius_wear)}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {formatOffset(comp.tool_length_geometry)}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {formatOffset(comp.tool_length_wear)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

