import { MachineId } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeMachine: MachineId;
  onMachineChange: (machine: MachineId) => void;
  availableMachines: MachineId[];
}

export function AppSidebar({ activeMachine, onMachineChange, availableMachines }: AppSidebarProps) {
  return (
    <Sidebar collapsible="none">
      <SidebarContent className="">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {availableMachines.map((machine) => {
                const isActive = activeMachine === machine;
                const machineNumber = machine.split(' ')[0];
                const machineName = machine.split(' ').slice(1).join(' ');

                return (
                  <SidebarMenuItem key={machine} className="mb-2">
                    <SidebarMenuButton
                      onClick={() => onMachineChange(machine)}
                      isActive={isActive}
                      className="h-auto py-4 px-4 "
                    >
                      <div className="flex items-center gap-4 w-full">
                        {/* Icon */}
                        {/* <div className="flex-shrink-0">
                          <img 
                            src={isActive ? "/millingblue.png" : "/milling.png"}
                            alt="Machine" 
                            className="h-10 w-10 object-contain" 
                          />
                        </div> */}
                        
                        {/* Machine Info */}
                        <div className="flex flex-col items-start gap-1 flex-1">
                          {/* Machine Number - Most Important */}
                          <span className="text-2xl font-bold text-foreground leading-none">
                            {machineNumber}
                          </span>
                          
                          {/* Machine Name */}
                          <span className="text-sm font-normal text-muted-foreground leading-none">
                            {machineName}
                          </span>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
