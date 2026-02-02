import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { MachineId } from "./types";
import { NumericInputProvider } from "./hooks/useNumericInput";
import { useMachineFromUrl } from "./hooks/useMachineFromUrl";
import { useMachines } from "./hooks/useMachines";
import StatusBar from "./components/StatusBar";
import NavigationTabs from "./components/NavigationTabs";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import CreateToolChange from "./pages/CreateToolChange";
import History from "./pages/History";
import ToolHistory from "./pages/ToolHistory";
import Settings from "./pages/Settings";
import MI from "./pages/MI";
import Matplan from "./pages/Matplan";
import CMM from "./pages/CMM";
import Matrixkod from "./pages/Matrixkod";
import MatrixkodHistorik from "./pages/MatrixkodHistorik";
import CreateDisturbance from "./pages/CreateDisturbance";
import Disturbances from "./pages/Disturbances";
import KompenseringEgenskaper from "./pages/KompenseringEgenskaper";
import Kompenseringar from "./pages/Kompenseringar";
import SmorjaBackarna from "./pages/SmorjaBackarna";
import Test from "./pages/Test";
import Instruktioner from "./pages/Instruktioner";

const queryClient = new QueryClient();

// First path the machine has access to (same order as NavigationTabs)
function getDefaultPathForMachine(machine: { tillgång_verktygsbyte?: boolean | null; tillgång_matrixkod?: boolean | null; tillgång_störningar?: boolean | null; tillgång_kompenseringslista?: boolean | null } | null): string {
  const hasVerktygsbyte = machine?.tillgång_verktygsbyte ?? true;
  const hasMatrixkod = machine?.tillgång_matrixkod ?? true;
  const hasStorningar = machine?.tillgång_störningar ?? true;
  const hasKompensering = machine?.tillgång_kompenseringslista ?? true;
  if (hasVerktygsbyte) return "historik";
  if (hasMatrixkod) return "matrixkod";
  if (hasStorningar) return "skapa-storning";
  if (hasKompensering) return "kompensering-egenskaper";
  return "historik";
}

// Redirects from "/" to first page the machine has access to; waits for machine data so 7101 -> matrixkod
const DefaultRedirect = () => {
  const { data: allMachines = [], isLoading } = useMachines();
  const location = useLocation();
  const pathname = location.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const machineSegment = segments[0] ?? "";
  const machineNumber = machineSegment.includes("-") ? machineSegment.split("-")[0] : machineSegment;
  const currentMachine = allMachines.find((m) => m.maskiner_nummer === machineNumber) ?? null;
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  return <Navigate to={getDefaultPathForMachine(currentMachine)} replace />;
};

const AppContent = () => {
  const { availableMachines, activeMachine: defaultMachine, isValidUrl, isLoading } = useMachineFromUrl();
  const { data: allMachines = [] } = useMachines();
  const [activeMachine, setActiveMachine] = useState<MachineId>(defaultMachine);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Update active machine when URL changes
  useEffect(() => {
    if (defaultMachine !== "0000") {
      setActiveMachine(defaultMachine);
    }
  }, [defaultMachine]);

  // Handle machine change - navigate to first page the machine has access to
  const handleMachineChange = (machine: MachineId) => {
    setActiveMachine(machine);
    
    // Extract the machine pattern from current URL
    const pathParts = location.pathname.split('/').filter(Boolean);
    const currentMachinePattern = pathParts.find(part => /^\d{4}(-\d{4})*$/.test(part));
    
    // Get the new machine number and its default path
    const newMachineNumber = machine.split(' ')[0];
    const newMachine = allMachines.find(m => m.maskiner_nummer === newMachineNumber) || null;
    const defaultPath = getDefaultPathForMachine(newMachine);
    
    // If we have multiple machines in URL, preserve all except change the active one
    if (currentMachinePattern && currentMachinePattern.includes('-')) {
      navigate(`/${currentMachinePattern}/${defaultPath}`);
    } else {
      navigate(`/${newMachineNumber}/${defaultPath}`);
    }
  };
  
  // Show loading while checking machines
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If URL is invalid, show 404 page
  if (!isValidUrl) {
    return <NotFound />;
  }

  const hasMultipleMachines = availableMachines.length > 1;
  
  // Find the actual machine object from activeMachine string
  const machineNumber = activeMachine.split(' ')[0];
  const currentMachine = allMachines.find(m => m.maskiner_nummer === machineNumber) || null;
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        {hasMultipleMachines && (
          <AppSidebar
            activeMachine={activeMachine}
            onMachineChange={handleMachineChange}
            availableMachines={availableMachines}
          />
        )}
        <div className="flex-1 flex flex-col">
          <StatusBar activeMachine={activeMachine} />
          <NavigationTabs machine={currentMachine} />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<DefaultRedirect />} />
              <Route path="mi" element={<MI />} />
              <Route path="skapa-verktygsbyte" element={<CreateToolChange activeMachine={activeMachine} />} />
              <Route path="historik" element={<History activeMachine={activeMachine} />} />
              <Route path="verktygshistorik/:machineNumber/:toolId" element={<ToolHistory />} />
              <Route path="inställningar" element={<Settings />} />
              <Route path="mätplan" element={<Matplan />} />
              <Route path="cmm" element={<CMM />} />
              <Route path="matrixkod" element={<Matrixkod activeMachine={activeMachine} />} />
              <Route path="matrixkod-historik" element={<MatrixkodHistorik activeMachine={activeMachine} />} />
              <Route path="skapa-storning" element={<CreateDisturbance activeMachine={activeMachine} />} />
              <Route path="storningar" element={<Disturbances activeMachine={activeMachine} />} />
              <Route path="kompensering-egenskaper" element={<KompenseringEgenskaper activeMachine={activeMachine} />} />
              <Route path="kompenseringar" element={<Kompenseringar activeMachine={activeMachine} />} />
              <Route path="smorja-backarna" element={<SmorjaBackarna activeMachine={activeMachine} />} />
              <Route path="instruktioner" element={<Instruktioner />} />
            </Routes>
          </main>
          <footer className="w-full py-2 text-center">
            <p className="text-xs text-gray-500">V2025.01 | Falks Metall AB | Maskinterminal</p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

const App = () => {
  return (
    <NumericInputProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/test" element={<Test />} />
              <Route path="/:machineId/*" element={<AppContent />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </NumericInputProvider>
  );
};

export default App;
