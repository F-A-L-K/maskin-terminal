import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { MachineId } from "@/types";
import { getFocasIP } from "@/lib/adambox";

interface KompenseringarProps {
  activeMachine: MachineId;
}

interface ToolOffsetResponse {
  success: boolean;
  data?: {
    toolNumber: number;
    cutterRadiusWear: number;
    cutterRadiusGeometry: number;
    toolLengthWear: number;
    toolLengthGeometry: number;
  };
  error?: string;
  errorCode?: number;
}

// Note: ASP.NET Core serializes C# properties to camelCase JSON by default
// So CutterRadiusWear becomes cutterRadiusWear in JSON

export default function Kompenseringar({ activeMachine }: KompenseringarProps) {
  const [toolNumber, setToolNumber] = useState<string>("");
  const [offsets, setOffsets] = useState<ToolOffsetResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToolOffsets = async () => {
    const toolNum = parseInt(toolNumber);
    if (isNaN(toolNum) || toolNum < 0) {
      setError("Vänligen ange ett giltigt verktygsnummer");
      return;
    }

    setLoading(true);
    setError(null);
    setOffsets(null);

    try {
      // Get FOCAS IP address for the active machine
      const ipAddress = await getFocasIP(activeMachine);
      
      if (!ipAddress) {
        setError(`Ingen FOCAS IP-adress konfigurerad för maskin ${activeMachine}. Vänligen konfigurera ip_focas i databasen.`);
        setLoading(false);
        return;
      }

      // Use Flask backend which auto-connects and gets tool offsets
      const backendBase = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5001").replace(/\/$/, "");
      const response = await fetch(`${backendBase}/api/focas/tool-offsets/${encodeURIComponent(ipAddress)}/${toolNum}`);
      const data: ToolOffsetResponse = await response.json();

      if (data.success && data.data) {
        setOffsets(data.data);
        setError(null);
      } else {
        // Show specific error message from FocasService
        const errorMsg = data.error || "Kunde inte hämta kompenseringsvärden";
        setError(errorMsg);
      }
    } catch (err) {
      setError(`Fel vid anslutning: ${err instanceof Error ? err.message : "Okänt fel"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchToolOffsets();
  };

  // Helper function to format offset values (they are in 0.001mm units typically)
  const formatOffset = (value: number): string => {
    // Assuming values are in 0.001mm units, convert to mm
    return (value / 1000).toFixed(3);
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Kompenseringsvärden</CardTitle>
          <CardDescription>
            Ange verktygsnummer för att hämta kompenseringsvärden från CNC-maskinen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toolNumber">Verktygsnummer</Label>
              <div className="flex gap-2">
                <Input
                  id="toolNumber"
                  type="number"
                  min="0"
                  value={toolNumber}
                  onChange={(e) => setToolNumber(e.target.value)}
                  placeholder="Ange verktygsnummer"
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Hämtar...
                    </>
                  ) : (
                    "Hämta värden"
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {offsets && !error && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <p className="font-semibold mb-2">Kompenseringsvärden för verktyg {offsets.toolNumber}:</p>
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cutter Radius</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Geometry:</span>
                        <span className="font-mono">{formatOffset(offsets.cutterRadiusGeometry)} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Wear:</span>
                        <span className="font-mono">{formatOffset(offsets.cutterRadiusWear)} mm</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Tool Length</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Geometry:</span>
                        <span className="font-mono">{formatOffset(offsets.toolLengthGeometry)} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Wear:</span>
                        <span className="font-mono">{formatOffset(offsets.toolLengthWear)} mm</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

