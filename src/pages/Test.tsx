import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Test = () => {
  const [ipAddress, setIpAddress] = useState("192.168.3.105");
  const [macroNumber, setMacroNumber] = useState("700");
  const [macroValue, setMacroValue] = useState("0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

    try {
      const macroValueNum = parseFloat(macroValue);
      const macroNumberNum = parseInt(macroNumber);

      if (isNaN(macroValueNum)) {
        setResult("✗ Fel: Macro-värde måste vara ett nummer");
        setLoading(false);
        return;
      }

      if (isNaN(macroNumberNum) || macroNumberNum < 1) {
        setResult("✗ Fel: Macro-nummer måste vara ett positivt heltal");
        setLoading(false);
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5004';
      const response = await fetch(`${API_BASE_URL}/api/write-macro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ip_address: ipAddress,
          macro_number: macroNumberNum,
          macro_value: macroValueNum,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(`✓ ${data.message || `Macro-variabel #${macroNumberNum} satt till ${macroValueNum}`}`);
      } else {
        const errorMsg = data.error || "Okänt fel";
        setResult(`✗ Fel: ${errorMsg}`);
      }
    } catch (error) {
      setResult(`✗ Fel: ${error instanceof Error ? error.message : "Nätverksfel"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 max-w-2xl flex-1">
        <h1 className="text-3xl font-bold mb-8">Sätt Makro variabel</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ip-address">IP-adress</Label>
            <Input
              id="ip-address"
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.3.105"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="macro-number">Makro-nummer</Label>
            <Input
              id="macro-number"
              type="number"
              value={macroNumber}
              onChange={(e) => setMacroNumber(e.target.value)}
              placeholder="700"
              min="1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="macro-value">Makro-värde</Label>
            <Input
              id="macro-value"
              type="number"
              value={macroValue}
              onChange={(e) => setMacroValue(e.target.value)}
              placeholder="0"
              step="any"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? "Kör..." : "Enter"}
          </Button>

          {result && (
            <div
              className={`p-4 rounded-lg ${
                result.startsWith("✓")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {result}
            </div>
          )}
        </form>
      </div>
      <footer className="w-full py-2 text-center">
        <p className="text-xs text-gray-500">Falks Metall AB | V2025.01</p>
      </footer>
    </div>
  );
};

export default Test;
