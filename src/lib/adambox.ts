/**
 * AdamBox integration utilities
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Get AdamBox value for a specific machine
 * @param machineId - The machine ID (e.g., "5701 Fanuc Robodrill")
 * @returns Promise<number | null> - The AdamBox value or null if error
 */
export async function getAdamBoxValue(machineId: string): Promise<number | null> {
  try {
    // Extract machine number from machine ID (e.g., "5701" from "5701 Fanuc Robodrill")
    const machineNumber = machineId.split(' ')[0];
    
    // Fetch machine from database to get IP address
    const { data: machine, error } = await supabase
      .from('verktygshanteringssystem_maskiner')
      .select('ip_adambox')
      .eq('maskiner_nummer', machineNumber)
      .maybeSingle();
    
    if (error) {
      console.error(`Error fetching machine IP: ${error.message}`);
      return null;
    }
    
    if (!machine || !machine.ip_adambox) {
      console.warn(`No IP address configured for machine: ${machineId}`);
      return null;
    }
    
    const ipAddress = machine.ip_adambox;

    // Call the backend API
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5004';
    const response = await fetch(`${API_BASE_URL}/api/adambox?ip=${encodeURIComponent(ipAddress)}`);
    
    if (!response.ok) {
      console.error(`Failed to get AdamBox value: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`AdamBox error: ${data.error}`);
      return null;
    }

    return data.value;
  } catch (error) {
    console.error('Error getting AdamBox value:', error);
    return null;
  }
}

/**
 * Get IP address for a machine from database
 * @param machineId - The machine ID
 * @returns Promise<string | null> - The IP address or null if not found
 */
export async function getMachineIP(machineId: string): Promise<string | null> {
  try {
    const machineNumber = machineId.split(' ')[0];
    
    const { data: machine, error } = await supabase
      .from('verktygshanteringssystem_maskiner')
      .select('ip_adambox')
      .eq('maskiner_nummer', machineNumber)
      .maybeSingle();
    
    if (error || !machine) {
      return null;
    }
    
    return machine.ip_adambox;
  } catch (error) {
    console.error('Error fetching machine IP:', error);
    return null;
  }
}

/**
 * Get FOCAS IP address for a machine from database
 * @param machineId - The machine ID (e.g., "5701 Fanuc Robodrill")
 * @returns Promise<string | null> - The FOCAS IP address or null if not found
 */
export async function getFocasIP(machineId: string): Promise<string | null> {
  try {
    const machineNumber = machineId.split(' ')[0];
    
    const { data: machine, error } = await supabase
      .from('verktygshanteringssystem_maskiner')
      .select('ip_focas')
      .eq('maskiner_nummer', machineNumber)
      .maybeSingle();
    
    if (error) {
      console.error(`Error fetching FOCAS IP: ${error.message}`);
      return null;
    }
    
    if (!machine || !machine.ip_focas) {
      console.warn(`No FOCAS IP address configured for machine: ${machineId}`);
      return null;
    }
    
    return machine.ip_focas;
  } catch (error) {
    console.error('Error fetching FOCAS IP:', error);
    return null;
  }
}

/**
 * Convert machine number to full machine ID
 * @param machineNumber - The machine number (e.g., "5701")
 * @returns string - The full machine ID (e.g., "5701 Fanuc Robodrill")
 */
export function getFullMachineId(machineNumber: string): string {
  const fullId = `${machineNumber} Fanuc Robodrill`;
  return fullId;
}
