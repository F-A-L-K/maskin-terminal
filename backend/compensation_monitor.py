#!/usr/bin/env python3
"""
Background service to monitor tool compensation values and log differences when changes occur.
Runs continuously and checks compensation values at regular intervals.
"""

import os
import time
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, List
from supabase import create_client, Client
from dotenv import load_dotenv
import sys

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

# Configuration
FOCAS_SERVICE_URL = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
FLASK_BACKEND_URL = os.getenv('VITE_BACKEND_URL', 'http://localhost:5004')
CHECK_INTERVAL = int(os.getenv('COMPENSATION_CHECK_INTERVAL', '1800'))  # 30 minutes default (1800 seconds)
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
        # Get all machines first
        response = supabase.table('verktygshanteringssystem_maskiner')\
            .select('id, maskiner_nummer, ip_focas')\
            .execute()
        
        # Filter to only include machines with non-null ip_focas
        machines_with_focas = [
            machine for machine in (response.data or [])
            if machine.get('ip_focas') is not None and machine.get('ip_focas') != ''
        ]
        
        return machines_with_focas
    except Exception as e:
        print(f"Error fetching machines: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_tools_to_monitor() -> List[int]:
    """Get list of tools to monitor"""
    return list(range(TOOL_RANGE_START, TOOL_RANGE_END + 1))

def get_current_offsets(ip_address: str, tool_number: int) -> Optional[Dict]:
    """Get current compensation offsets from CNC via Flask backend (single tool)"""
    try:
        url = f"{FLASK_BACKEND_URL}/api/focas/tool-offsets/{ip_address}/{tool_number}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                offset_data = data['data']
                # Log what we received for debugging
                print(f"    Received: CR_G={offset_data.get('cutterRadiusGeometry')}, CR_W={offset_data.get('cutterRadiusWear')}, TL_G={offset_data.get('toolLengthGeometry')}, TL_W={offset_data.get('toolLengthWear')}")
                return offset_data
            else:
                # Log error from response
                error_msg = data.get('error', 'Unknown error')
                print(f"    API returned error: {error_msg}")
                return None
        else:
            print(f"    HTTP {response.status_code}: {response.text[:100]}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"    Request error: {e}")
        return None
    except Exception as e:
        print(f"    Unexpected error: {e}")
        return None

def get_current_offsets_range(ip_address: str, start_tool: int, end_tool: int) -> Optional[Dict[int, Dict]]:
    """Get current compensation offsets for a range of tools from CNC via Flask backend"""
    try:
        url = f"{FLASK_BACKEND_URL}/api/focas/tool-offsets-range/{ip_address}/{start_tool}/{end_tool}"
        response = requests.get(url, timeout=30)  # Longer timeout for range requests
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                range_data = data['data']
                tools = range_data.get('tools', [])
                
                # Convert list to dictionary keyed by tool number for easier lookup
                result = {}
                for tool_data in tools:
                    tool_num = tool_data.get('toolNumber')
                    if tool_num is not None:
                        result[tool_num] = {
                            'cutterRadiusGeometry': tool_data.get('cutterRadiusGeometry'),
                            'cutterRadiusWear': tool_data.get('cutterRadiusWear'),
                            'toolLengthGeometry': tool_data.get('toolLengthGeometry'),
                            'toolLengthWear': tool_data.get('toolLengthWear')
                        }
                
                print(f"    Received {len(result)} tools in range {start_tool}-{end_tool}")
                return result
            else:
                # Log error from response
                error_msg = data.get('error', 'Unknown error')
                print(f"    API returned error: {error_msg}")
                return None
        else:
            print(f"    HTTP {response.status_code}: {response.text[:100]}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"    Request error: {e}")
        return None
    except Exception as e:
        print(f"    Unexpected error: {e}")
        return None

def get_work_zero_offset(ip_address: str, number: int, axis: int, length: int = 8) -> Optional[Dict]:
    """Get work zero offset for a specific coordinate system and axis using cnc_rdzofs"""
    try:
        url = f"{FLASK_BACKEND_URL}/api/focas/work-zero-offset/{ip_address}/{number}/{axis}/{length}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                return data['data']
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"    API returned error for number={number}, axis={axis}: {error_msg}")
                return None
        else:
            print(f"    HTTP {response.status_code} for number={number}, axis={axis}: {response.text[:100]}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"    Request error for number={number}, axis={axis}: {e}")
        return None
    except Exception as e:
        print(f"    Unexpected error for number={number}, axis={axis}: {e}")
        return None

def get_work_zero_offsets_range_single(ip_address: str, axis: int, start_number: int, end_number: int) -> Optional[Dict]:
    """Get work zero offsets range using cnc_rdzofsr"""
    try:
        url = f"{FLASK_BACKEND_URL}/api/focas/work-zero-offsets-range-single/{ip_address}/{axis}/{start_number}/{end_number}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                return data['data']
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"    API returned error for axis={axis}, start={start_number}, end={end_number}: {error_msg}")
                return None
        else:
            print(f"    HTTP {response.status_code} for axis={axis}, start={start_number}, end={end_number}: {response.text[:100]}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"    Request error for axis={axis}, start={start_number}, end={end_number}: {e}")
        return None
    except Exception as e:
        print(f"    Unexpected error for axis={axis}, start={start_number}, end={end_number}: {e}")
        return None

def get_work_zero_offsets_for_coordinate_systems(ip_address: str, start_p: int, end_p: int) -> Optional[Dict[int, Dict]]:
    """Get work zero offsets for coordinate systems using cnc_rdzofsr
    Uses s_number=7, e_number=54, length=n (auto-calculated)
    Reads all axes: 1=X, 2=Y, 3=Z, 4=C, 5=B
    
    Offset 7-54 corresponds to P1-P48 (offset = P_number + 6)
    """
    result = {}
    
    # Axis mapping: 1=X, 2=Y, 3=Z, 4=C, 5=B
    axis_map = {1: 'X', 2: 'Y', 3: 'Z', 4: 'C', 5: 'B'}
    
    # Use cnc_rdzofsr with s_number=7, e_number=54
    # This covers P1-P48 (offset 7-54)
    actual_start_number = 7  # This is what we want to read (P1)
    actual_end_number = 54   # This is what we want to read (P48)
    
    # Read all 5 axes
    for axis_num, axis_name in axis_map.items():
        print(f"    Reading axis {axis_name} (axis={axis_num}) for offset range {actual_start_number}-{actual_end_number}...")
        range_data = get_work_zero_offsets_range_single(ip_address, axis_num, actual_start_number, actual_end_number)
        
        if range_data and range_data.get('data'):
            data_array = range_data.get('data', [])
            if data_array:
                # The data array contains values for all coordinate systems in the range
                # For range 7-54, we have 48 coordinate systems (7, 8, 9, ..., 54)
                # These correspond to P1-P48 (offset = P_number + 6)
                # Data is organized as: [offset7_axis, offset8_axis, ..., offset54_axis]
                for idx, offset_value in enumerate(data_array):
                    if offset_value is not None:
                        # Calculate P number from offset number
                        offset_num = actual_start_number + idx
                        p_num = offset_num - 6  # P1 = offset 7, P2 = offset 8, etc.
                        
                        if start_p <= p_num <= end_p:
                            if p_num not in result:
                                result[p_num] = {}
                            # Store with 0-indexed axis (0=X, 1=Y, 2=Z, 3=C, 4=B)
                            result[p_num][axis_num - 1] = offset_value
                print(f"      ✓ Read {len([v for v in data_array if v is not None])} values for axis {axis_name}")
            else:
                print(f"      ✗ No data array returned for axis {axis_name}")
        else:
            print(f"      ✗ Failed to read axis {axis_name}")
    
    print(f"    Received {len(result)} coordinate systems in range P{start_p}-P{end_p}")
    return result if result else None

def get_stored_current_values(machine_id: str, tool_coordinate_num: str) -> Optional[Dict]:
    """Get stored current compensation values from nuvarande table"""
    try:
        response = supabase.table('verktygshanteringssystem_kompenseringar_nuvarande')\
            .select('*')\
            .eq('maskin_id', machine_id)\
            .eq('verktyg_koordinat_num', tool_coordinate_num)\
            .limit(1)\
            .execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error fetching stored current values: {e}")
        return None

def update_current_values(machine_id: str, tool_coordinate_num: str, offsets: Dict):
    """Update or insert current compensation values in nuvarande table"""
    try:
        # Check if this is a coordinate system (P1, P2, etc.) or a tool (T1, T2, etc.)
        is_coordinate_system = tool_coordinate_num.startswith('P')
        
        if is_coordinate_system:
            # Handle coordinate system (work zero offsets)
            # offsets should be a dict with axis offsets: {0: value_x, 1: value_y, 2: value_z, 3: value_c, 4: value_b}
            axis_offsets = offsets.get('axisOffsets', {}) if isinstance(offsets, dict) and 'axisOffsets' in offsets else offsets
            
            # Get axis values (0=X, 1=Y, 2=Z, 3=C, 4=B)
            x_raw = axis_offsets.get(0) if isinstance(axis_offsets, dict) else None
            y_raw = axis_offsets.get(1) if isinstance(axis_offsets, dict) else None
            z_raw = axis_offsets.get(2) if isinstance(axis_offsets, dict) else None
            c_raw = axis_offsets.get(3) if isinstance(axis_offsets, dict) else None
            b_raw = axis_offsets.get(4) if isinstance(axis_offsets, dict) else None
            
            # Check if all values are 0 or None (skip if all are 0/None)
            x_val = x_raw if x_raw is not None else 0
            y_val = y_raw if y_raw is not None else 0
            z_val = z_raw if z_raw is not None else 0
            c_val = c_raw if c_raw is not None else 0
            b_val = b_raw if b_raw is not None else 0
            
            if x_val == 0 and y_val == 0 and z_val == 0 and c_val == 0 and b_val == 0:
                print(f"    ⊘ Skipped {tool_coordinate_num} (all values are 0 or None)")
                return
            
            # Convert from 0.001mm units to mm (divide by 1000)
            x_mm = (x_raw / 1000.0) if x_raw is not None else None
            y_mm = (y_raw / 1000.0) if y_raw is not None else None
            z_mm = (z_raw / 1000.0) if z_raw is not None else None
            c_mm = (c_raw / 1000.0) if c_raw is not None else None
            b_mm = (b_raw / 1000.0) if b_raw is not None else None
            
            print(f"    Saving to DB: P={tool_coordinate_num}, X={x_mm}, Y={y_mm}, Z={z_mm}, C={c_mm}, B={b_mm}")
            
            # Prepare data - for coordinate systems, use koord_x, koord_y, koord_z, koord_c, koord_b columns
            now = datetime.now(timezone.utc).isoformat()
            data = {
                'maskin_id': machine_id,
                'verktyg_koordinat_num': tool_coordinate_num,
                'koord_x': x_mm,  # X axis
                'koord_y': y_mm,  # Y axis
                'koord_z': z_mm,  # Z axis
                'koord_c': c_mm,  # C axis
                'koord_b': b_mm,  # B axis
                'datum': now,
                'updated_at': now
            }
        else:
            # Handle tool offsets (existing logic)
            # Get all 4 compensation values (they come in 0.001mm units)
            # Note: 0 is a valid value from CNC, None means the value wasn't read (error or not available)
            cr_geometry_raw = offsets.get('cutterRadiusGeometry')
            cr_wear_raw = offsets.get('cutterRadiusWear')
            tl_geometry_raw = offsets.get('toolLengthGeometry')
            tl_wear_raw = offsets.get('toolLengthWear')
            
            # Check if all values are 0 or None (skip if all are 0/None)
            # Use 0 as default if None for comparison
            cr_geometry_val = cr_geometry_raw if cr_geometry_raw is not None else 0
            cr_wear_val = cr_wear_raw if cr_wear_raw is not None else 0
            tl_geometry_val = tl_geometry_raw if tl_geometry_raw is not None else 0
            tl_wear_val = tl_wear_raw if tl_wear_raw is not None else 0
            
            # Skip if all values are 0 or None
            if cr_geometry_val == 0 and cr_wear_val == 0 and tl_geometry_val == 0 and tl_wear_val == 0:
                print(f"    ⊘ Skipped {tool_coordinate_num} (all values are 0 or None)")
                return
            
            # Convert from 0.001mm units to mm (divide by 1000)
            # Store as float/double precision in database
            # Keep None as None (don't convert if value wasn't read)
            cr_geometry_mm = (cr_geometry_raw / 1000.0) if cr_geometry_raw is not None else None
            cr_wear_mm = (cr_wear_raw / 1000.0) if cr_wear_raw is not None else None
            tl_geometry_mm = (tl_geometry_raw / 1000.0) if tl_geometry_raw is not None else None
            tl_wear_mm = (tl_wear_raw / 1000.0) if tl_wear_raw is not None else None
            
            # Debug: Print what we're about to save
            print(f"    Saving to DB: CR_G={cr_geometry_mm}, CR_W={cr_wear_mm}, TL_G={tl_geometry_mm}, TL_W={tl_wear_mm}")
            
            # Prepare data with all required fields
            now = datetime.now(timezone.utc).isoformat()
            data = {
                'maskin_id': machine_id,
                'verktyg_koordinat_num': tool_coordinate_num,
                'verktyg_radie_geometry': cr_geometry_mm,
                'verktyg_radie_wear': cr_wear_mm,
                'verktyg_längd_geometry': tl_geometry_mm,
                'verktyg_längd_wear': tl_wear_mm,
                'datum': now,
                'updated_at': now
            }
        
        # Check if record exists
        existing = get_stored_current_values(machine_id, tool_coordinate_num)
        
        if existing:
            # Update existing record
            response = supabase.table('verktygshanteringssystem_kompenseringar_nuvarande')\
                .update(data)\
                .eq('maskin_id', machine_id)\
                .eq('verktyg_koordinat_num', tool_coordinate_num)\
                .execute()
            
            if response.data:
                print(f"    ✓ Updated {tool_coordinate_num} in database")
            else:
                print(f"    ✗ Update failed for {tool_coordinate_num} - no data returned")
        else:
            # Insert new record
            data['created_at'] = now
            response = supabase.table('verktygshanteringssystem_kompenseringar_nuvarande')\
                .insert(data)\
                .execute()
            
            if response.data:
                print(f"    ✓ Inserted {tool_coordinate_num} into database")
            else:
                print(f"    ✗ Insert failed for {tool_coordinate_num} - no data returned")
                print(f"    Data attempted: {data}")
            
    except Exception as e:
        print(f"    ✗ Error updating current values for {tool_coordinate_num}: {e}")
        import traceback
        traceback.print_exc()

def save_compensation_change(machine_id: str, tool_coordinate_num: str, field_name: str, 
                             old_value_mm: Optional[float], new_value_mm: Optional[float]):
    """Save compensation change to verktygshanteringssystem_kompenseringar table with the difference"""
    try:
        # Calculate difference in mm
        if old_value_mm is None:
            old_value_mm = 0.0
        if new_value_mm is None:
            new_value_mm = 0.0
        
        difference_mm = new_value_mm - old_value_mm
        
        # Only save if there's actually a difference
        if abs(difference_mm) < 0.001:  # Less than 0.001mm difference, ignore
            return
        
        # Determine if this is a coordinate system or tool
        is_coordinate_system = tool_coordinate_num.startswith('P')
        
        # Prepare data with only the changed field set to the difference
        now = datetime.now(timezone.utc).isoformat()
        data = {
            'machine_id': machine_id,
            'verktyg_koordinat_num': tool_coordinate_num,
            'date': now,
            'created_at': now,
            'updated_at': now,
        }
        
        if is_coordinate_system:
            # For coordinate systems, set the changed axis field to the difference
            if field_name == 'koord_x':
                data['koord_x'] = difference_mm
            elif field_name == 'koord_y':
                data['koord_y'] = difference_mm
            elif field_name == 'koord_z':
                data['koord_z'] = difference_mm
            elif field_name == 'koord_c':
                data['koord_c'] = difference_mm
            elif field_name == 'koord_b':
                data['koord_b'] = difference_mm
        else:
            # For tools, set the changed field to the difference
            if field_name == 'verktyg_radie_geometry':
                data['verktyg_radie_geometry'] = difference_mm
            elif field_name == 'verktyg_radie_wear':
                data['verktyg_radie_wear'] = difference_mm
            elif field_name == 'verktyg_längd_geometry':
                data['verktyg_längd_geometry'] = difference_mm
            elif field_name == 'verktyg_längd_wear':
                data['verktyg_längd_wear'] = difference_mm
        
        # Insert into verktygshanteringssystem_kompenseringar
        response = supabase.table('verktygshanteringssystem_kompenseringar')\
            .insert(data)\
            .execute()
        
        if response.data:
            print(f"✓ Saved change to kompenseringar: {tool_coordinate_num} {field_name}: {old_value_mm:.3f}mm -> {new_value_mm:.3f}mm (diff: {difference_mm:.3f}mm)")
        else:
            print(f"✗ Failed to save change for {tool_coordinate_num} {field_name}")
            
    except Exception as e:
        print(f"Error saving compensation change: {e}")
        import traceback
        traceback.print_exc()

def check_for_changes(machine_id: str, tool_coordinate_num: str, 
                     current: Dict, stored: Optional[Dict]):
    """Compare current and stored values and log any differences"""
    fields = [
        ('verktyg_radie_geometry', 'cutterRadiusGeometry'),
        ('verktyg_radie_wear', 'cutterRadiusWear'),
        ('verktyg_längd_geometry', 'toolLengthGeometry'),
        ('verktyg_längd_wear', 'toolLengthWear')
    ]
    
    changes_detected = False
    
    for db_field, api_field in fields:
        # Get current value from CNC (in 0.001mm units)
        current_val_raw = current.get(api_field)
        
        # Skip if current value is None (wasn't read successfully)
        if current_val_raw is None:
            continue
        
        # Convert to mm for comparison
        current_val_mm = current_val_raw / 1000.0
        
        # Get stored value from database (already in mm)
        stored_val_mm = stored.get(db_field) if stored else None
        
        # Check if value has changed (compare in mm)
        if current_val_mm != stored_val_mm:
            # Save the change to kompenseringar table with the difference
            save_compensation_change(machine_id, tool_coordinate_num, db_field, stored_val_mm, current_val_mm)
            changes_detected = True
    
    return changes_detected

def initialize_machine_values(machine_id: str, machine_number: str, ip_address: str):
    """Initialize all tool values for a machine on startup - reads all current values using range API"""
    print(f"Initializing values for machine {machine_number} ({ip_address})...")
    print(f"  Machine ID: {machine_id}")
    
    tools = get_tools_to_monitor()
    if not tools:
        print("  No tools to monitor")
        return
    
    start_tool = min(tools)
    end_tool = max(tools)
    
    try:
        # Get all tools in one range request
        print(f"  Fetching tools {start_tool}-{end_tool} in batch...", end=" ")
        all_offsets = get_current_offsets_range(ip_address, start_tool, end_tool)
        
        if not all_offsets:
            print("FAILED (no data)")
            return
        
        print(f"OK - Received {len(all_offsets)} tools")
        
        initialized_count = 0
        failed_count = 0
        
        # Process each tool from the batch
        for tool_number in tools:
            try:
                # Format tool coordinate number (e.g., 4 -> "T4")
                tool_coordinate_num = f"T{tool_number}"
                
                # Get offsets from the batch result
                current_offsets = all_offsets.get(tool_number)
                
                if not current_offsets:
                    # Tool might not exist in the batch
                    failed_count += 1
                    continue
                
                # Display values - show raw values first, then converted
                cr_g_raw = current_offsets.get('cutterRadiusGeometry')
                cr_w_raw = current_offsets.get('cutterRadiusWear')
                tl_g_raw = current_offsets.get('toolLengthGeometry')
                tl_w_raw = current_offsets.get('toolLengthWear')
                
                # Convert to mm for display
                cr_g_mm = (cr_g_raw / 1000.0) if cr_g_raw is not None else 0
                cr_w_mm = (cr_w_raw / 1000.0) if cr_w_raw is not None else 0
                tl_g_mm = (tl_g_raw / 1000.0) if tl_g_raw is not None else 0
                tl_w_mm = (tl_w_raw / 1000.0) if tl_w_raw is not None else 0
                
                print(f"  Tool {tool_coordinate_num}: Raw: CR_G={cr_g_raw}, CR_W={cr_w_raw}, TL_G={tl_g_raw}, TL_W={tl_w_raw} | MM: CR_G={cr_g_mm:.3f}, CR_W={cr_w_mm:.3f}, TL_G={tl_g_mm:.3f}, TL_W={tl_w_mm:.3f}")
                
                # Store current values in nuvarande table (initial load, always update)
                # This ensures we have the latest values as baseline
                update_current_values(machine_id, tool_coordinate_num, current_offsets)
                initialized_count += 1
                
            except Exception as e:
                print(f"  ERROR processing tool {tool_number}: {e}")
                import traceback
                traceback.print_exc()
                failed_count += 1
                continue
        
        print(f"  Summary: Initialized {initialized_count} tools, {failed_count} failed or not found")
        
        # Also initialize coordinate systems (P1-P48)
        print(f"  Fetching coordinate systems P1-P48...", end=" ")
        coord_offsets = get_work_zero_offsets_for_coordinate_systems(ip_address, 1, 48)
        
        if coord_offsets:
            print(f"OK - Received {len(coord_offsets)} coordinate systems")
            coord_initialized_count = 0
            
            for coord_num in range(1, 49):  # P1 to P48
                try:
                    coord_coordinate_num = f"P{coord_num}"
                    axis_offsets = coord_offsets.get(coord_num)
                    
                    if axis_offsets:
                        # Format as dict with axisOffsets key for update_current_values
                        # Convert axis numbers: 0=X, 1=Y, 2=Z, 3=C, 4=B
                        coord_data = {'axisOffsets': axis_offsets}
                        update_current_values(machine_id, coord_coordinate_num, coord_data)
                        coord_initialized_count += 1
                except Exception as e:
                    print(f"  ERROR processing coordinate system P{coord_num}: {e}")
                    continue
            
            print(f"  Summary: Initialized {coord_initialized_count} coordinate systems")
        else:
            print("FAILED (no data)")
        
    except Exception as e:
        print(f"  ERROR fetching tool range: {e}")
        import traceback
        traceback.print_exc()

def monitor_machine(machine_id: str, machine_number: str, ip_address: str):
    """Monitor all tools for a specific machine using range API"""
    print(f"Monitoring machine {machine_number} ({ip_address})...")
    
    tools = get_tools_to_monitor()
    if not tools:
        print("  No tools to monitor")
        return
    
    start_tool = min(tools)
    end_tool = max(tools)
    
    try:
        # Get all tools in one range request
        print(f"  Fetching tools {start_tool}-{end_tool} in batch...")
        all_offsets = get_current_offsets_range(ip_address, start_tool, end_tool)
        
        if not all_offsets:
            print("  Failed to fetch tool offsets")
            return
        
        checked_count = 0
        changed_count = 0
        
        # Process each tool from the batch
        for tool_number in tools:
            try:
                # Format tool coordinate number (e.g., 4 -> "T4")
                tool_coordinate_num = f"T{tool_number}"
                
                # Get offsets from the batch result
                current_offsets = all_offsets.get(tool_number)
                
                if not current_offsets:
                    # Tool might not exist in the batch
                    continue
                
                # Get stored current values from nuvarande table
                stored_values = get_stored_current_values(machine_id, tool_coordinate_num)
                
                # Check for changes and log differences
                if check_for_changes(machine_id, tool_coordinate_num, current_offsets, stored_values):
                    changed_count += 1
                
                # Update current values in nuvarande table (always, for next comparison)
                update_current_values(machine_id, tool_coordinate_num, current_offsets)
                checked_count += 1
                
            except Exception as e:
                print(f"  Error monitoring tool {tool_number}: {e}")
                continue
        
        print(f"  Checked {checked_count} tools, {changed_count} had changes")
        
        # Also monitor coordinate systems (P1-P48)
        print(f"  Fetching coordinate systems P1-P48...")
        coord_offsets = get_work_zero_offsets_for_coordinate_systems(ip_address, 1, 48)
        
        if coord_offsets:
            coord_checked_count = 0
            coord_changed_count = 0
            
            for coord_num in range(1, 49):  # P1 to P48
                try:
                    coord_coordinate_num = f"P{coord_num}"
                    axis_offsets = coord_offsets.get(coord_num)
                    
                    if not axis_offsets:
                        continue
                    
                    # Format as dict with axisOffsets key
                    # axis_offsets uses 0-indexed: 0=X, 1=Y, 2=Z, 3=C, 4=B
                    coord_data = {'axisOffsets': axis_offsets}
                    
                    # Get stored current values
                    stored_values = get_stored_current_values(machine_id, coord_coordinate_num)
                    
                    # For coordinate systems, we compare axis offsets
                    # Use koord_x, koord_y, koord_z, koord_c, koord_b columns
                    x_raw = axis_offsets.get(0)
                    y_raw = axis_offsets.get(1)
                    z_raw = axis_offsets.get(2)
                    c_raw = axis_offsets.get(3)  # C axis
                    b_raw = axis_offsets.get(4)  # B axis
                    
                    if x_raw is not None:
                        x_mm = x_raw / 1000.0
                        stored_x = stored_values.get('koord_x') if stored_values else None
                        if x_mm != stored_x:
                            save_compensation_change(machine_id, coord_coordinate_num, 'koord_x', stored_x, x_mm)
                            coord_changed_count += 1
                    
                    if y_raw is not None:
                        y_mm = y_raw / 1000.0
                        stored_y = stored_values.get('koord_y') if stored_values else None
                        if y_mm != stored_y:
                            save_compensation_change(machine_id, coord_coordinate_num, 'koord_y', stored_y, y_mm)
                            coord_changed_count += 1
                    
                    if z_raw is not None:
                        z_mm = z_raw / 1000.0
                        stored_z = stored_values.get('koord_z') if stored_values else None
                        if z_mm != stored_z:
                            save_compensation_change(machine_id, coord_coordinate_num, 'koord_z', stored_z, z_mm)
                            coord_changed_count += 1
                    
                    if c_raw is not None:
                        c_mm = c_raw / 1000.0
                        stored_c = stored_values.get('koord_c') if stored_values else None
                        if c_mm != stored_c:
                            save_compensation_change(machine_id, coord_coordinate_num, 'koord_c', stored_c, c_mm)
                            coord_changed_count += 1
                    
                    if b_raw is not None:
                        b_mm = b_raw / 1000.0
                        stored_b = stored_values.get('koord_b') if stored_values else None
                        if b_mm != stored_b:
                            save_compensation_change(machine_id, coord_coordinate_num, 'koord_b', stored_b, b_mm)
                            coord_changed_count += 1
                    
                    # Update current values
                    update_current_values(machine_id, coord_coordinate_num, coord_data)
                    coord_checked_count += 1
                    
                except Exception as e:
                    print(f"  Error monitoring coordinate system P{coord_num}: {e}")
                    continue
            
            print(f"  Checked {coord_checked_count} coordinate systems, {coord_changed_count} had changes")
        
    except Exception as e:
        print(f"  Error fetching tool range: {e}")
        import traceback
        traceback.print_exc()

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
    
    # Initial load: Read all current values on startup
    print("=" * 60)
    print("INITIAL LOAD: Reading all current tool values...")
    print("=" * 60)
    
    machines = get_machines_with_focas()
    if machines:
        for machine in machines:
            machine_id = machine['id']
            machine_number = machine['maskiner_nummer']
            ip_address = machine['ip_focas']
            
            if not ip_address:
                continue
            
            try:
                initialize_machine_values(machine_id, machine_number, ip_address)
            except Exception as e:
                print(f"Error initializing machine {machine_number}: {e}")
                continue
        
        print("\n" + "=" * 60)
        print("Initial load complete! Starting monitoring loop...")
        print("=" * 60)
        print()
    else:
        print("No machines with FOCAS IP configured for initial load.")
        print()
    
    # Main monitoring loop
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

