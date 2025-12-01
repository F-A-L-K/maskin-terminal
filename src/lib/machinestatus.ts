/**
 * Machine Status API integration
 * Fetches real-time machine status from Monitor MI database
 */

interface MachineStatusResponse {
  work_center: string;
  status: string;
  stop_code: string;
  last_reporting_time: string | null;
  timestamp: string;
  status_code: string;
  active_order?: {
    order_number: string;
    part_number: string;
    report_number: number;
    start_time: string | null;
  } | null;
  display_info: string;
}

interface MachineStatusError {
  error: string;
  status: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5004';

export async function getMachineStatus(workCenter: string): Promise<MachineStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/machine-status?wc=${encodeURIComponent(workCenter)}`);
    
    if (!response.ok) {
      const errorData: MachineStatusError = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data: MachineStatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching machine status:', error);
    throw error;
  }
}

export function extractWorkCenterFromMachineId(machineId: string): string {
  // Extract work center number from machine ID
  // Examples: "5701 Fanuc Robodrill" -> "5701"
  const match = machineId.match(/^(\d+)/);
  return match ? match[1] : machineId;
}
