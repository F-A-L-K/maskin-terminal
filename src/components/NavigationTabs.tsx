import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Machine } from "@/types";

interface NavigationTabsProps {
  machine: Machine | null;
}

export default function NavigationTabs({ machine }: NavigationTabsProps) {
  const hasVerktygsbyte = machine?.tillgång_verktygsbyte ?? true;
  const hasMatrixkod = machine?.tillgång_matrixkod ?? true;
  const hasStorningar = machine?.tillgång_störningar ?? true;
  const hasKompensering = machine?.tillgång_kompenseringslista ?? true;

  const verktygsbyteTabs = hasVerktygsbyte ? [
    { path: "historik", label: "Verktygsbyte" },
    { path: "skapa-verktygsbyte", label: "Skapa Verktygsbyte" },
  ] : [];

  const matrixkodTabs = hasMatrixkod ? [
    { path: "matrixkod", label: "Skapa Matrixkod" },
    { path: "matrixkod-historik", label: "Matrixkoder" },
  ] : [];

  const storningarTabs = hasStorningar ? [
    { path: "skapa-storning", label: "Skapa Störning" },
    { path: "storningar", label: "Störningar" },
  ] : [];

  const kompenseringTabs = hasKompensering ? [
    { path: "kompensering-egenskaper", label: "Kompenseringslista" },
    { path: "kompenseringar", label: "Kompenseringar" },
  ] : [];

  const rightTabs = hasVerktygsbyte ? [
    { path: "inställningar", label: "Inställningar" },
  ] : [];

  const renderTab = (tab: { path: string; label: string }) => (
    <NavLink
      key={tab.path}
      to={tab.path}
      className={({ isActive }) => cn(
        "px-6 py-3 font-medium transition-colors relative",
        isActive
          ? "text-[#507E95] border-b-[2px] border-[#507E95]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {tab.label}
    </NavLink>
  );

  const renderSeparator = () => (
    <div className="h-8 w-px bg-gray-300 self-center mx-2"></div>
  );

  return (
    <nav className="bg-background border-b">
      <div className="flex justify-between">
        <div className="flex items-center">
          {/* Verktygsbyte tabs */}
          {verktygsbyteTabs.map(renderTab)}
          
          {/* Separator after verktygsbyte if any other area exists */}
          {verktygsbyteTabs.length > 0 && (matrixkodTabs.length > 0 || storningarTabs.length > 0 || kompenseringTabs.length > 0) && renderSeparator()}
          
          {/* Matrixkod tabs */}
          {matrixkodTabs.map(renderTab)}
          
          {/* Separator after matrixkod if störningar or kompensering exists */}
          {matrixkodTabs.length > 0 && (storningarTabs.length > 0 || kompenseringTabs.length > 0) && renderSeparator()}
          
          {/* Störningar tabs */}
          {storningarTabs.map(renderTab)}
          
          {/* Separator after störningar if kompensering exists */}
          {storningarTabs.length > 0 && kompenseringTabs.length > 0 && renderSeparator()}
          
          {/* Kompensering tabs */}
          {kompenseringTabs.map(renderTab)}
        </div>
        <div className="flex">
          {rightTabs.map((tab) => {
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) => cn(
                  "px-6 py-3 font-medium transition-colors relative",
                  isActive
                    ? "text-[#507E95] border-b-[2px] border-[#507E95]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
