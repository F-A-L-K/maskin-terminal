#!/usr/bin/env python3
"""
Background service to monitor tool compensation values and log differences when changes occur.
Runs continuously and checks compensation values at regular intervals.
"""

import os
import time
import requests
from datetime import datetime
from typing import Optional, Dict, List
from supabase import create_client, Client
from dotenv import load_dotenv
import sys

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

# Configuration
FOCAS_SERVICE_URL = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5000')
FLASK_BACKEND_URL = os.getenv('VITE_BACKEND_URL', 'http://localhost:5001')
CHECK_INTERVAL = int(os.getenv('COMPENSATION_CHECK_INTERVAL', '300'))  # 5 minutes default
TOOL_RANGE_START = int(os.getenv('COMPENSATION_TOOL_RANGE_START', '1'))
TOOL_RANGE_END = int(os.getenv('COMPENSATION_TOOL_RANGE_END', '100'))

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL', 'https://xplqhaywcaaanzgzonpo.supabase.co')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwbHFoYXl3Y2FhYW56Z3pvbnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxOTY5MDEsImV4cCI6MjA1MTc3MjkwMX0.7mxLBeRLibTC6Evg4Ki1HGKqTNl48C8ouehMePXjvmc')

# Initialize Supabase client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Connected to Supabase: {SUPABASE_URL}")
except Exception as e:
    print(f"Error connecting to Supabase: {e}")
    sys.exit(1)

def get_machines_with_focas() -> List[Dict]:
    """Get all machines with FOCAS IP configured"""
    try:
        response = supabase.table('verktygshanteringssystem_maskiner')\
            .select('id, maskiner_nummer, ip_focas')\
            .not_.is_('ip_focas', 'null')\
            .execute()
        return response.data
    except Exception as e:
        print(f"Error fetching machines: {e}")
        return []

def get_tools_to_monitor() -> List[int]:
    """Get list of tools to monitor"""
    return list(range(TOOL_RANGE_START, TOOL_RANGE_END + 1))

def get_current_offsets(ip_address: str, tool_number: int) -> Optional[Dict]:
    """Get current compensation offsets from CNC via Flask backend"""
    try:
        response = requests.get(
            f"{FLASK_BACKEND_URL}/api/focas/tool-offsets/{ip_address}/{tool_number}",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                return data['data']
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching offsets for tool {tool_number}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error fetching offsets for tool {tool_number}: {e}")
        return None

def get_latest_stored_values(machine_id: str, tool_number: int) -> Optional[Dict]:
    """Get latest stored compensation values from database"""
    try:
        response = supabase.table('verktygshanteringssystem_kompenseringar')\
            .select('*')\
            .eq('machine_id', machine_id)\
            .eq('tool_number', tool_number)\
            .order('date', desc=True)\
            .limit(1)\
            .execute()
        
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error fetching stored values: {e}")
        return None

def store_current_values(machine_id: str, tool_number: int, offsets: Dict):
    """Store current compensation values in database"""
    try:
        data = {
            'machine_id': machine_id,
            'tool_number': tool_number,
            'cutter_radius_geometry': offsets.get('cutterRadiusGeometry'),
            'cutter_radius_wear': offsets.get('cutterRadiusWear'),
            'tool_length_geometry': offsets.get('toolLengthGeometry'),
            'tool_length_wear': offsets.get('toolLengthWear'),
            'date': datetime.utcnow().isoformat()
        }
        
        supabase.table('verktygshanteringssystem_kompenseringar')\
            .insert(data)\
            .execute()
            
    except Exception as e:
        print(f"Error storing values: {e}")

def log_difference(machine_id: str, tool_number: int, field_name: str, 
                  old_value: Optional[int], new_value: Optional[int]):
    """Log a compensation value difference"""
    try:
        # Calculate difference
        if old_value is None:
            old_value = 0
        if new_value is None:
            new_value = 0
        
        difference = new_value - old_value
        
        # Only log if there's actually a difference
        if difference == 0:
            return
        
        supabase.table('verktygshanteringssystem_kompensering_differanser')\
            .insert({
                'machine_id': machine_id,
                'tool_number': tool_number,
                'field_name': field_name,
                'old_value': old_value if old_value != 0 else None,
                'new_value': new_value if new_value != 0 else None,
                'difference': difference,
                'changed_at': datetime.utcnow().isoformat()
            })\
            .execute()
            
        print(f"✓ Logged change: Machine {machine_id} Tool {tool_number} {field_name}: {old_value} -> {new_value} (diff: {difference})")
    except Exception as e:
        print(f"Error logging difference: {e}")

def check_for_changes(machine_id: str, tool_number: int, 
                     current: Dict, stored: Optional[Dict]):
    """Compare current and stored values and log any differences"""
    fields = [
        ('cutter_radius_geometry', 'cutterRadiusGeometry'),
        ('cutter_radius_wear', 'cutterRadiusWear'),
        ('tool_length_geometry', 'toolLengthGeometry'),
        ('tool_length_wear', 'toolLengthWear')
    ]
    
    changes_detected = False
    
    for db_field, api_field in fields:
        current_val = current.get(api_field)
        stored_val = stored.get(db_field) if stored else None
        
        # Check if value has changed
        if current_val is not None and current_val != stored_val:
            log_difference(machine_id, tool_number, db_field, stored_val, current_val)
            changes_detected = True
    
    return changes_detected

def monitor_machine(machine_id: str, machine_number: str, ip_address: str):
    """Monitor all tools for a specific machine"""
    print(f"Monitoring machine {machine_number} ({ip_address})...")
    
    tools = get_tools_to_monitor()
    checked_count = 0
    changed_count = 0
    
    for tool_number in tools:
        try:
            # Get current offsets from CNC
            current_offsets = get_current_offsets(ip_address, tool_number)
            
            if not current_offsets:
                # Tool might not exist or CNC connection failed
                continue
            
            # Get latest stored values
            stored_values = get_latest_stored_values(machine_id, tool_number)
            
            # Check for changes and log differences
            if check_for_changes(machine_id, tool_number, current_offsets, stored_values):
                changed_count += 1
            
            # Store current values (always, for next comparison)
            store_current_values(machine_id, tool_number, current_offsets)
            checked_count += 1
            
            # Small delay between tools to avoid overwhelming the CNC
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Error monitoring tool {tool_number} on {machine_number}: {e}")
            continue
    
    print(f"  Checked {checked_count} tools, {changed_count} had changes")

def main():
    """Main monitoring loop"""
    print("=" * 60)
    print("Compensation Value Monitor")
    print("=" * 60)
    print(f"Check interval: {CHECK_INTERVAL} seconds ({CHECK_INTERVAL/60:.1f} minutes)")
    print(f"Tool range: {TOOL_RANGE_START} - {TOOL_RANGE_END}")
    print(f"FOCAS Service: {FOCAS_SERVICE_URL}")
    print(f"Flask Backend: {FLASK_BACKEND_URL}")
    print("=" * 60)
    print()
    
    while True:
        try:
            # Get all machines with FOCAS IP
            machines = get_machines_with_focas()
            
            if not machines:
                print(f"[{datetime.now()}] No machines with FOCAS IP configured. Waiting...")
                time.sleep(CHECK_INTERVAL)
                continue
            
            print(f"\n[{datetime.now()}] Checking {len(machines)} machine(s)...")
            
            for machine in machines:
                machine_id = machine['id']
                machine_number = machine['maskiner_nummer']
                ip_address = machine['ip_focas']
                
                if not ip_address:
                    continue
                
                try:
                    monitor_machine(machine_id, machine_number, ip_address)
                except Exception as e:
                    print(f"Error monitoring machine {machine_number}: {e}")
                    continue
            
            print(f"\n[{datetime.now()}] Check complete. Waiting {CHECK_INTERVAL} seconds until next check...")
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            print("\n\nStopping monitor...")
            print("Goodbye!")
            break
        except Exception as e:
            print(f"Error in main loop: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)  # Wait 1 minute before retrying on error

if __name__ == '__main__':
    main()

