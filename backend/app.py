#!/usr/bin/env python3
"""
Flask API for AdamBox integration
All backend functionality in one file
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import socket
import struct
import pyodbc
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Set
import requests
import threading
import time
from supabase import create_client, Client

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    # Look for .env file in parent directory
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded environment variables from {env_path}")
    else:
        print("No .env file found, using system environment variables")
except ImportError:
    print("python-dotenv not installed, using system environment variables only")

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL', 'https://xplqhaywcaaanzgzonpo.supabase.co')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwbHFoYXl3Y2FhYW56Z3pvbnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxOTY5MDEsImV4cCI6MjA1MTc3MjkwMX0.7mxLBeRLibTC6Evg4Ki1HGKqTNl48C8ouehMePXjvmc')

# Initialize Supabase client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Connected to Supabase: {SUPABASE_URL}")
except Exception as e:
    print(f"Warning: Could not connect to Supabase: {e}")
    supabase = None

# Track which tools have already sent macro notifications
# Format: (machine_id, tool_id) -> timestamp
macro_notifications_sent: Dict[Tuple[str, str], datetime] = {}
macro_notifications_lock = threading.Lock()

# Suppress recurring logs
SUPPRESS_RECURRING_LOGS = os.getenv('SUPPRESS_RECURRING_LOGS', 'false').lower() == 'true'

# Monitor MI database configuration
STATE_MAP = {0:"Unknown",1:"Running",2:"ShortStop",3:"Stopped",4:"PlannedStop",5:"Setup"}

# SQL queries from test.py
SQL_CURRENT = r'''
SELECT
  mi.machine_id,
  mi.work_center_number,
  mi.state,
  mi.is_setup,
  mi.indirect_code,
  mi.last_reporting_time
FROM "mi_001.1".public.machine_information mi
WHERE mi.work_center_number = ?
'''

SQL_FALLBACK_STOP = r'''
SELECT
  wli.indirect_code,
  wli.report_time
FROM "mi_001.1".public.work_log_item wli
WHERE wli.work_center_number = ?
  AND wli.indirect_code IS NOT NULL AND wli.indirect_code <> ''
ORDER BY wli.report_time DESC
LIMIT 1
'''

SQL_ACTIVE_ORDER = r'''
SELECT
  cw.order_number,
  cw.part_number,
  cw.report_number,
  cw.start_time,
  cw.end_time
FROM "mi_001.1".public.current_work cw
WHERE cw.work_center_number = ?
ORDER BY (cw.end_time IS NULL) DESC, cw.start_time DESC
LIMIT 1
'''

# Kassationer: senaste 7 dagarna för en maskin (param: start_utc, end_utc, work_center, start_utc, end_utc, work_center)
# Schema "mi_001.1".public för att matcha övriga MI-frågor (monitormi DSN)
SQL_KASSATIONER = r'''
WITH
ri_agg AS (
  SELECT
    report_number,
    MAX(part_number)  AS part_number,
    MAX(extra_info)   AS extra_info
  FROM "mi_001.1".public.report_item
  GROUP BY report_number
),
mat_raw AS (
  SELECT
    (m.report_time AT TIME ZONE 'Europe/Stockholm') AS event_time_local,
    'material'::text AS source,
    m.report_number,
    COALESCE(ri.part_number, m.part_number) AS part_number,
    m.rejected_pieces::numeric AS rejected_qty,
    TRIM(COALESCE(m.rejected_code, '')) AS rejected_code,
    NULL::text AS manual_comment_raw,
    COALESCE(ri.extra_info, NULL) AS extra_info_raw,
    m.operator_id AS operator_id
  FROM "mi_001.1".public.material_work_log_item m
  LEFT JOIN ri_agg ri ON ri.report_number = m.report_number
  INNER JOIN "mi_001.1".public.machine_information mi ON mi.machine_id = m.machine_id
  WHERE m.rejected_pieces != 0
    AND m.report_time >= ?
    AND m.report_time < ?
    AND TRIM(COALESCE(mi.work_center_number, '')) = ?
),
man_raw AS (
  SELECT
    (mm.report_time AT TIME ZONE 'Europe/Stockholm') AS event_time_local,
    'manual'::text AS source,
    mm.report_number,
    COALESCE(ri.part_number, mm.part_number) AS part_number,
    mm.rejected_pieces::numeric AS rejected_qty,
    TRIM(COALESCE(mm.rejected_code, '')) AS rejected_code,
    mm.comment::text AS manual_comment_raw,
    COALESCE(ri.extra_info, NULL) AS extra_info_raw,
    mm.operator_id AS operator_id
  FROM "mi_001.1".public.manual_work_log_item mm
  LEFT JOIN ri_agg ri ON ri.report_number = mm.report_number
  INNER JOIN "mi_001.1".public.machine_information mi ON mi.machine_id = mm.machine_id
  WHERE mm.rejected_pieces != 0
    AND mm.report_time >= ?
    AND mm.report_time < ?
    AND TRIM(COALESCE(mi.work_center_number, '')) = ?
)
SELECT
  event_time_local,
  source,
  report_number,
  part_number,
  rejected_qty,
  rejected_code,
  manual_comment_raw,
  extra_info_raw,
  operator_id
FROM (
  SELECT * FROM mat_raw
  UNION ALL
  SELECT * FROM man_raw
) u
ORDER BY event_time_local DESC
'''

# Kassationer: antal producerade och kasserade samma period (param: start_utc, end_utc, work_center_number)
SQL_KASSATIONER_SUMMARY = r'''
SELECT
  SUM(COALESCE(ri.reported_quantity, 0))::bigint AS producerade,
  SUM(COALESCE(ri.rejected_quantity, 0))::bigint AS kasserade,
  (SUM(COALESCE(ri.reported_quantity, 0)) + SUM(COALESCE(ri.rejected_quantity, 0)))::bigint AS totalt
FROM "mi_001.1".public.report_item ri
JOIN "mi_001.1".public.report_item_summary ris ON ris.id = ri.report_item_summary_id
INNER JOIN "mi_001.1".public.machine_information mi ON mi.machine_id = ri.machine_id
WHERE ris.start_time >= ?
  AND ris.end_time < ?
  AND TRIM(COALESCE(mi.work_center_number, '')) = ?
'''

# Compensation list file paths
DEFAULT_KOMPENSERING_DIR = r"Z:\Maskinterminal\Kompenseringslista"

KOMPENSERING_DIR = os.environ.get(
    "KOMPENSERING_EGENSKAPER_DIR",
    DEFAULT_KOMPENSERING_DIR,
)

# Database connection configuration
DB_CONFIG = {
    "dsn": "monitormi",
    "uid": None,
    "pwd": None,
    "timeout": 5
}

DB_CONFIG_MONITOR = {
    "dsn": "monitor",
    "uid": None,
    "pwd": None,
    "timeout": 5
}

def get_db_connection():
    """Create and return a database connection"""
    cs = f"DSN={DB_CONFIG['dsn']};" + (f"UID={DB_CONFIG['uid']};" if DB_CONFIG['uid'] else "") + (f"PWD={DB_CONFIG['pwd']};" if DB_CONFIG['pwd'] else "") + f"Timeout={DB_CONFIG['timeout']};"
    return pyodbc.connect(cs)

def get_db_connection_monitor():
    """Anslutning till DSN=monitor (Person-tabell för operatörsnamn)."""
    c = DB_CONFIG_MONITOR
    cs = f"DSN={c['dsn']};" + (f"UID={c['uid']};" if c.get('uid') else "") + (f"PWD={c.get('pwd')};" if c.get('pwd') else "") + f"Timeout={c.get('timeout', 5)};"
    return pyodbc.connect(cs)

def fetch_operator_names(operator_ids: list) -> Dict[int, str]:
    """Hämta Id -> 'Förnamn Efternamn' från monitor.Person. Returnerar dict; saknade id:n finns inte i dict."""
    if not operator_ids:
        return {}
    seen = set()
    unique_ids = []
    for x in operator_ids:
        if x is None:
            continue
        try:
            pid = int(x)
        except (TypeError, ValueError):
            continue
        if pid not in seen:
            seen.add(pid)
            unique_ids.append(pid)
    if not unique_ids:
        return {}
    placeholders = ", ".join("?" for _ in unique_ids)
    sql = f"SELECT Id, FirstName, LastName FROM monitor.Person WHERE Id IN ({placeholders})"
    try:
        conn = get_db_connection_monitor()
        cur = conn.cursor()
        cur.execute(sql, unique_ids)
        rows = cur.fetchall()
        conn.close()
        return {
            int(row.Id): " ".join(filter(None, [str(row.FirstName or "").strip(), str(row.LastName or "").strip()])).strip() or str(row.Id)
            for row in rows
        }
    except Exception:
        return {}

def fetch_current_status(cur, wc: str):
    """Status + stopkod från machine_information (+ ev. fallback i work_log_item)."""
    cur.execute(SQL_CURRENT, wc)
    row = cur.fetchone()
    if not row: 
        return None
    
    wcnum = str(row.work_center_number)
    state = int(row.state) if row.state is not None else 0
    stop = (row.indirect_code or '').strip() or None
    t = row.last_reporting_time
    is_setup = bool(row.is_setup)

    if not stop and STATE_MAP.get(state) != "Running":
        try:
            cur.execute(SQL_FALLBACK_STOP, wc)
            r2 = cur.fetchone()
            if r2 and r2.indirect_code:
                stop = str(r2.indirect_code).strip()
        except Exception:
            pass
    
    return wcnum, state, stop, t, is_setup

def fetch_active_order(cur, wc: str):
    """Returnerar (order_number, part_number, report_number, start_time) om aktiv, annars None."""
    cur.execute(SQL_ACTIVE_ORDER, wc)
    row = cur.fetchone()
    if not row:
        return None
    
    # aktiv om end_time är NULL
    if getattr(row, "end_time", None) is None:
        return (
            (row.order_number or "").strip() or None,
            (row.part_number or "").strip() or None,
            row.report_number,
            row.start_time,
        )
    return None

def read_adambox_value(ip_address, port=502, unit_id=1, register_address=2):
    """
    Read a single value from AdamBox
    
    Args:
        ip_address (str): IP address of the AdamBox
        port (int): Modbus TCP port (default: 502)
        unit_id (int): Modbus unit ID (default: 1)
        register_address (int): Register address to read (default: 2)
    
    Returns:
        dict: Result with value or error
    """
    socket_obj = None
    
    try:
        # Create socket connection
        socket_obj = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        socket_obj.settimeout(10)
        socket_obj.connect((ip_address, port))
        
        # Build Modbus TCP request
        transaction_id = 1
        protocol_id = 0
        length = 6
        function_code = 3  # Read Holding Registers
        
        request = struct.pack('>HHHBBHH',
            transaction_id,
            protocol_id,
            length,
            unit_id,
            function_code,
            register_address,
            1  # Read 1 register
        )
        
        # Send request
        socket_obj.send(request)
        
        # Receive response
        response = socket_obj.recv(1024)
        
        if len(response) < 8:
            return {
                "error": f"Response too short: {len(response)} bytes",
                "timestamp": datetime.now().isoformat()
            }
        # Parse response header
        (t_id, p_id, l_id, u_id, f_code) = struct.unpack('>HHHBB', response[:8])
        
        # Check for Modbus exception
        if f_code & 0x80:
            exception_code = response[8] if len(response) > 8 else 0
            return {
                "error": f"Modbus exception: function code {f_code & 0x7F}, exception {exception_code}",
                "timestamp": datetime.now().isoformat()
            }
        
        if f_code != 3:
            return {
                "error": f"Unexpected function code: {f_code}",
                "timestamp": datetime.now().isoformat()
            }
        
        # Get byte count and value
        if len(response) < 9:
            return {
                "error": "Response too short for data",
                "timestamp": datetime.now().isoformat()
            }
        
        byte_count = response[8]
        
        if len(response) < 9 + byte_count:
            return {
                "error": f"Response too short: expected {9 + byte_count} bytes, got {len(response)}",
                "timestamp": datetime.now().isoformat()
            }
        
        # Extract register value
        value = struct.unpack('>H', response[9:11])[0]
        
        return {
            "ip_address": ip_address,
            "register_address": register_address,
            "value": value,
            "timestamp": datetime.now().isoformat(),
            "status": "success"
        }
        
    except socket.timeout:
        return {
            "error": "Connection timeout",
            "timestamp": datetime.now().isoformat()
        }
    except ConnectionRefusedError:
        return {
            "error": "Connection refused - check if AdamBox is running",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
    finally:
        if socket_obj:
            socket_obj.close()

# API Routes

@app.route('/api/adambox', methods=['GET'])
def get_adambox_value():
    """
    Get AdamBox value for a specific IP address
    Query parameters:
    - ip: IP address of the AdamBox
    """
    ip_address = request.args.get('ip')
    
    if not ip_address:
        return jsonify({
            "error": "IP address parameter is required",
            "status": "error"
        }), 400
    
    # Read value from AdamBox
    result = read_adambox_value(ip_address)
    
    if "error" in result:
        return jsonify(result), 500
    
    return jsonify(result)


@app.route('/api/kassationer', methods=['GET'])
def get_kassationer():
    """
    Kassationer för en maskin, senaste 7 dagarna (UTC).
    Query params: wc = work_center_number (t.ex. '5123')
    """
    wc = request.args.get('wc', '').strip()
    if not wc:
        return jsonify({
            "error": "Query parameter 'wc' (work_center_number) is required",
            "status": "error"
        }), 400

    # Sluttid = exakt tidsslag just nu (UTC). Starttid = exakt samma tid för precis en vecka sedan.
    now_utc = datetime.now(timezone.utc)
    end_utc = now_utc
    start_utc = now_utc - timedelta(days=7)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Sammanfattning: producerade, kasserade
        cur.execute(SQL_KASSATIONER_SUMMARY, (start_utc, end_utc, wc))
        sum_row = cur.fetchone()
        producerade = int(sum_row.producerade) if sum_row and sum_row.producerade is not None else 0
        kasserade = int(sum_row.kasserade) if sum_row and sum_row.kasserade is not None else 0

        # Lista kassationer
        cur.execute(
            SQL_KASSATIONER,
            (start_utc, end_utc, wc, start_utc, end_utc, wc)
        )
        rows = cur.fetchall()
        columns = [col[0] for col in cur.description]
        conn.close()
    except pyodbc.Error as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

    def serialize_value(v):
        if v is None:
            return None
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        if isinstance(v, (int, float)):
            return v
        try:
            return float(v)  # Decimal / numeric från pyodbc
        except (TypeError, ValueError):
            return v

    kassationer = [
        {col: serialize_value(row[i]) for i, col in enumerate(columns)}
        for row in rows
    ]

    # Operatörsid -> namn från monitor.Person (DSN=monitor)
    operator_ids = []
    for row in kassationer:
        oid = row.get("operator_id")
        if oid is not None:
            operator_ids.append(oid)
    name_map = fetch_operator_names(operator_ids)

    for row in kassationer:
        oid = row.get("operator_id")
        if oid is None:
            row["operator_name"] = None
        else:
            try:
                row["operator_name"] = name_map.get(int(oid)) or str(oid)
            except (TypeError, ValueError):
                row["operator_name"] = str(oid)

    return jsonify({
        "work_center_number": wc,
        "start_utc": start_utc.isoformat(),
        "end_utc": end_utc.isoformat(),
        "producerade": producerade,
        "kasserade": kasserade,
        "kassationer": kassationer
    })


def load_csv_content(file_path: str) -> Tuple[Optional[str], Optional[str]]:
    """Return csv file content as string and error message if any."""
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            return f.read(), None
    except FileNotFoundError:
        return None, f"File not found: {file_path}"
    except PermissionError:
        return None, f"Permission denied when accessing: {file_path}"
    except Exception as exc:  # pragma: no cover - unexpected errors
        return None, str(exc)


@app.route('/api/kompensering/egenskaper', methods=['GET'])
def get_kompensering_egenskaper():
    """Return the egenskaper compensation list CSV from network share."""
    try:
        entries = sorted(
            os.path.join(KOMPENSERING_DIR, name)
            for name in os.listdir(KOMPENSERING_DIR)
            if name.lower().endswith('.csv')
        )
        file_path = entries[0] if entries else None
    except FileNotFoundError:
        return jsonify({
            "error": f"Directory not found: {KOMPENSERING_DIR}",
            "path": KOMPENSERING_DIR
        }), 404
    except PermissionError:
        return jsonify({
            "error": f"Permission denied when accessing directory: {KOMPENSERING_DIR}",
            "path": KOMPENSERING_DIR
        }), 500

    if not file_path:
        return jsonify({
            "error": "No CSV files found in directory",
            "path": KOMPENSERING_DIR
        }), 404

    content, error = load_csv_content(file_path)
    if error:
        status = 404 if "not found" in error.lower() else 500
        return jsonify({
            "error": error,
            "path": file_path
        }), status

    return app.response_class(
        response=content,
        status=200,
        mimetype='text/csv'
    )


@app.route('/api/machine-status', methods=['GET'])
def get_machine_status():
    """
    Get machine status from Monitor MI database
    Query parameters:
    - wc: Work center number (machine ID)
    """
    work_center = request.args.get('wc')
    
    if not work_center:
        return jsonify({
            "error": "Work center parameter is required",
            "status": "error"
        }), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get current status
        status_data = fetch_current_status(cur, work_center)
        if not status_data:
            return jsonify({
                "error": f"No data found for work center {work_center}",
                "status": "error"
            }), 404
        
        wc, state_i, stop, ts, is_setup = status_data
        status = STATE_MAP.get(state_i, f"State({state_i})")
        if is_setup and status == "Running":
            status = "Setup (Running)"
        
        # Get active order
        active_order = fetch_active_order(cur, work_center)
        
        # Determine stop code - if machine is running and no stop code, return empty
        final_stop_code = ""
        if "running" in status.lower() and not stop:
            final_stop_code = ""  # Empty for running machine
        elif stop:
            final_stop_code = stop
        else:
            final_stop_code = ""  # Default to empty (running) instead of stop code

        result = {
            "work_center": wc,
            "status": status,
            "stop_code": final_stop_code,
            "last_reporting_time": ts.isoformat() if isinstance(ts, datetime) else None,
            "timestamp": datetime.now().isoformat(),
            "status_code": "success"
        }
        
        if active_order:
            order_no, part_no, report_no, start_time = active_order
            result["active_order"] = {
                "order_number": order_no,
                "part_number": part_no,
                "report_number": report_no,
                "start_time": start_time.isoformat() if isinstance(start_time, datetime) else None
            }
            # Add part and order info to the response for frontend display
            if order_no or part_no:
                result["display_info"] = f"{part_no or 'Unknown'} - {order_no or 'Unknown'}"
        else:
            result["active_order"] = None
            result["display_info"] = "No active order"
        
        cur.close()
        conn.close()
        
        return jsonify(result)
        
    except pyodbc.OperationalError as e:
        return jsonify({
            "error": f"Database connection error: {str(e)}",
            "status": "error"
        }), 500
    except Exception as e:
        return jsonify({
            "error": f"Unexpected error: {str(e)}",
            "status": "error"
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "AdamBox API with Monitor MI integration"
    })

@app.route('/api/focas/tool-radius/<int:tool_number>', methods=['GET'])
def get_tool_radius(tool_number):
    """Proxy endpoint to FocasService for tool radius (legacy - requires manual connection)"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    
    try:
        response = requests.get(
            f"{focas_service_url}/api/focas/tool-radius/{tool_number}",
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        # FocasService returns 200 even on errors, with success: false
        # Pass through the response as-is
        return jsonify(data), 200
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/tool-radius/<ip_address>/<int:tool_number>', methods=['GET'])
def get_tool_radius_with_auto_connect(ip_address, tool_number):
    """Get tool radius with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get tool radius
        radius_response = requests.get(
            f"{focas_service_url}/api/focas/tool-radius/{tool_number}",
            timeout=5
        )
        radius_response.raise_for_status()
        radius_data = radius_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(radius_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/tool-radius', methods=['POST'])
def get_tool_radius_post():
    """Proxy endpoint to FocasService for tool radius (POST)"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    
    try:
        data = request.get_json() or {}
        response = requests.post(
            f"{focas_service_url}/api/focas/tool-radius",
            json=data,
            timeout=5
        )
        response.raise_for_status()
        result = response.json()
        # FocasService returns 200 even on errors, with success: false
        # Pass through the response as-is
        return jsonify(result), 200
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/tool-offsets/<ip_address>/<int:tool_number>', methods=['GET'])
def get_tool_offsets_with_auto_connect(ip_address, tool_number):
    """Get tool offsets with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get tool offsets
        offsets_response = requests.get(
            f"{focas_service_url}/api/focas/tool-offsets/{tool_number}",
            timeout=5
        )
        offsets_response.raise_for_status()
        offsets_data = offsets_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(offsets_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/tool-offsets-range/<ip_address>/<int:start_tool>/<int:end_tool>', methods=['GET'])
def get_tool_offsets_range_with_auto_connect(ip_address, start_tool, end_tool):
    """Get tool offsets for a range of tools with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get tool offsets for the range
        offsets_response = requests.get(
            f"{focas_service_url}/api/focas/tool-offsets-range/{start_tool}/{end_tool}",
            timeout=30  # Longer timeout for range requests
        )
        offsets_response.raise_for_status()
        offsets_data = offsets_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(offsets_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/work-zero-offsets-range/<ip_address>/<int:start_coord>/<int:end_coord>', methods=['GET'])
def get_work_zero_offsets_range_with_auto_connect(ip_address, start_coord, end_coord):
    """Get work zero offsets for a range of coordinate systems (P1-P7) with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get work zero offsets for the range
        offsets_response = requests.get(
            f"{focas_service_url}/api/focas/work-zero-offsets-range/{start_coord}/{end_coord}",
            timeout=30  # Longer timeout for range requests
        )
        offsets_response.raise_for_status()
        offsets_data = offsets_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(offsets_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/work-zero-offset/<ip_address>/<int:number>/<int:axis>/<int:length>', methods=['GET'])
def get_work_zero_offset_with_auto_connect(ip_address, number, axis, length):
    """Get work zero offset using cnc_rdzofs with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get work zero offset
        offset_response = requests.get(
            f"{focas_service_url}/api/focas/work-zero-offset/{number}/{axis}/{length}",
            timeout=10
        )
        offset_response.raise_for_status()
        offset_data = offset_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(offset_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/focas/work-zero-offsets-range-single/<ip_address>/<int:axis>/<int:start_number>/<int:end_number>', methods=['GET'])
def get_work_zero_offsets_range_single_with_auto_connect(ip_address, axis, start_number, end_number):
    """Get work zero offsets range using cnc_rdzofsr with automatic connection to CNC machine"""
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    focas_port = 8193  # Default FOCAS port
    
    try:
        # First, connect to the CNC machine
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": focas_port},
            timeout=10
        )
        
        if not connect_response.ok:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_response.text}"
            }), 502
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            return jsonify({
                "success": False,
                "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
            }), 502
        
        # Now get work zero offsets range
        offset_response = requests.get(
            f"{focas_service_url}/api/focas/work-zero-offsets-range-single/{axis}/{start_number}/{end_number}",
            timeout=10
        )
        offset_response.raise_for_status()
        offset_data = offset_response.json()
        
        # Disconnect after getting the data (optional, but good practice)
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass  # Ignore disconnect errors
        
        return jsonify(offset_data), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": False,
            "error": "FocasService is not running. Please start the FocasService on port 5999."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "success": False,
            "error": "FocasService request timed out"
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Error communicating with FocasService: {str(e)}"
        }), 502
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/write-macro', methods=['POST'])
def write_macro_api():
    """API endpoint to write macro variable via FocasService"""
    try:
        data = request.get_json() or {}
        macro_value = data.get('macro_value')
        ip_address = data.get('ip_address', '192.168.3.105')
        macro_number = data.get('macro_number', 700)
        
        if macro_value is None:
            return jsonify({
                "success": False,
                "error": "macro_value parameter is required"
            }), 400
        
        # Validate macro_value is a number and convert to int (FocasService requires Int32)
        try:
            macro_value_float = float(macro_value)
            macro_value = int(macro_value_float)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "macro_value must be a number"
            }), 400
        
        # Validate macro_number is a positive integer
        try:
            macro_number = int(macro_number)
            if macro_number < 1:
                return jsonify({
                    "success": False,
                    "error": "macro_number must be a positive integer"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "macro_number must be a positive integer"
            }), 400
        
        # Validate IP address format (basic check)
        if not ip_address or not isinstance(ip_address, str):
            return jsonify({
                "success": False,
                "error": "ip_address must be a valid IP address"
            }), 400
        
        focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
        cnc_ip = ip_address
        cnc_port = 8193
        macro_dec_val = 0
        
        # Connect to CNC
        try:
            connect_response = requests.post(
                f"{focas_service_url}/api/focas/connect",
                json={"ipAddress": cnc_ip, "port": cnc_port},
                timeout=10
            )
            
            if not connect_response.ok:
                return jsonify({
                    "success": False,
                    "error": f"Failed to connect to CNC: HTTP {connect_response.status_code} - {connect_response.text}"
                }), 502
            
            connect_data = connect_response.json()
            if not connect_data.get("success"):
                return jsonify({
                    "success": False,
                    "error": f"Failed to connect to CNC: {connect_data.get('error', 'Unknown error')}"
                }), 502
        except requests.exceptions.ConnectionError:
            return jsonify({
                "success": False,
                "error": f"Could not connect to FocasService at {focas_service_url}. Please ensure FocasService is running."
            }), 503
        except requests.exceptions.Timeout:
            return jsonify({
                "success": False,
                "error": "Connection to FocasService timed out"
            }), 504
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Error connecting to CNC: {str(e)}"
            }), 500
        
        # Write macro variable
        try:
            write_response = requests.post(
                f"{focas_service_url}/api/focas/write-macro",
                json={
                    "number": macro_number,
                    "mcrVal": macro_value,
                    "decVal": macro_dec_val
                },
                timeout=10
            )
            
            if not write_response.ok:
                return jsonify({
                    "success": False,
                    "error": f"Failed to write macro: HTTP {write_response.status_code} - {write_response.text}"
                }), 500
            
            write_data = write_response.json()
            if write_data.get("success"):
                # Disconnect
                try:
                    requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
                except:
                    pass  # Ignore disconnect errors
                
                return jsonify({
                    "success": True,
                    "message": f"Macro variable #{macro_number} set to {macro_value}"
                }), 200
            else:
                error_msg = write_data.get('error', 'Unknown error')
                error_code = write_data.get('errorCode', '')
                error_message = f"Failed to write macro variable: {error_msg}"
                if error_code:
                    error_message += f" (Error code: {error_code})"
                
                # Disconnect even on error
                try:
                    requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
                except:
                    pass
                
                return jsonify({
                    "success": False,
                    "error": error_message
                }), 500
                
        except requests.exceptions.Timeout:
            return jsonify({
                "success": False,
                "error": "Write macro request timed out"
            }), 504
        except Exception as e:
            # Disconnect on error
            try:
                requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
            except:
                pass
            return jsonify({
                "success": False,
                "error": f"Error writing macro: {str(e)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/check-tool-max-limits', methods=['POST'])
def check_tool_max_limits_endpoint():
    """
    Manual endpoint to trigger tool max limit check
    """
    try:
        check_tool_max_limits()
        return jsonify({
            "success": True,
            "message": "Tool max limit check completed"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error checking tool max limits: {str(e)}"
        }), 500

def write_macro_to_cnc(ip_address: str, macro_number: int, macro_value: int) -> bool:
    """
    Write macro variable to CNC machine via FocasService
    
    Args:
        ip_address: IP address of the CNC machine
        macro_number: Macro variable number (default: 700)
        macro_value: Value to write to macro variable
    
    Returns:
        bool: True if successful, False otherwise
    """
    focas_service_url = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
    cnc_port = 8193
    macro_dec_val = 0
    
    try:
        # Connect to CNC
        connect_response = requests.post(
            f"{focas_service_url}/api/focas/connect",
            json={"ipAddress": ip_address, "port": cnc_port},
            timeout=10
        )
        
        if not connect_response.ok:
            print(f"Failed to connect to CNC {ip_address}: HTTP {connect_response.status_code}")
            return False
        
        connect_data = connect_response.json()
        if not connect_data.get("success"):
            print(f"Failed to connect to CNC {ip_address}: {connect_data.get('error', 'Unknown error')}")
            return False
        
        # Write macro variable
        write_response = requests.post(
            f"{focas_service_url}/api/focas/write-macro",
            json={
                "number": macro_number,
                "mcrVal": macro_value,
                "decVal": macro_dec_val
            },
            timeout=10
        )
        
        if not write_response.ok:
            print(f"Failed to write macro to {ip_address}: HTTP {write_response.status_code}")
            # Disconnect on error
            try:
                requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
            except:
                pass
            return False
        
        write_data = write_response.json()
        if write_data.get("success"):
            # Disconnect
            try:
                requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
            except:
                pass
            if not SUPPRESS_RECURRING_LOGS:
                print(f"✓ Macro variable #{macro_number} set to {macro_value} on {ip_address}")
            return True
        else:
            error_msg = write_data.get('error', 'Unknown error')
            print(f"Failed to write macro to {ip_address}: {error_msg}")
            # Disconnect on error
            try:
                requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
            except:
                pass
            return False
            
    except Exception as e:
        print(f"Error writing macro to {ip_address}: {str(e)}")
        # Disconnect on error
        try:
            requests.post(f"{focas_service_url}/api/focas/disconnect", timeout=2)
        except:
            pass
        return False

def check_tool_max_limits():
    """
    Check all machines for tools that have reached max limit and send macro notifications.
    This function runs periodically in the background.
    """
    if not supabase:
        print("Supabase not available, skipping tool max limit check")
        return
    
    try:
        # Get all machines with ip_focas configured
        response = supabase.table('verktygshanteringssystem_maskiner')\
            .select('id, maskiner_nummer, ip_focas, ip_adambox')\
            .execute()
        
        machines = [
            m for m in (response.data or [])
            if m.get('ip_focas') and m.get('ip_focas') != '' and m.get('ip_adambox') and m.get('ip_adambox') != ''
        ]
        
        if not machines:
            return
        
        for machine in machines:
            machine_id = machine['id']
            machine_number = machine['maskiner_nummer']
            ip_focas = machine['ip_focas']
            ip_adambox = machine['ip_adambox']
            
            try:
                # Get current AdamBox value
                adam_result = read_adambox_value(ip_adambox)
                if "error" in adam_result or "value" not in adam_result:
                    if not SUPPRESS_RECURRING_LOGS:
                        print(f"Could not read AdamBox value for machine {machine_number}")
                    continue
                
                current_adam_value = adam_result["value"]
                
                # Get all tools (verktyg are shared across all machines, no machine_id filter)
                tools_response = supabase.table('verktygshanteringssystem_verktyg')\
                    .select('id, plats, maxgräns')\
                    .execute()
                
                tools = tools_response.data or []
                
                for tool in tools:
                    tool_id = tool['id']
                    tool_plats = tool.get('plats')
                    maxgräns = tool.get('maxgräns')
                    
                    if not tool_plats or not maxgräns:
                        continue
                    
                    # Get the latest tool change for this tool
                    tool_change_response = supabase.table('verktygshanteringssystem_verktygsbyteslista')\
                        .select('number_of_parts_ADAM, date_created')\
                        .eq('tool_id', tool_id)\
                        .eq('machine_id', machine_id)\
                        .order('date_created', desc=True)\
                        .limit(1)\
                        .execute()
                    
                    if not tool_change_response.data or len(tool_change_response.data) == 0:
                        continue
                    
                    latest_tool_change = tool_change_response.data[0]
                    last_adam_value = latest_tool_change.get('number_of_parts_ADAM')
                    
                    if last_adam_value is None:
                        continue
                    
                    parts_since_last_change = current_adam_value - last_adam_value
                    
                    # Check if tool has reached max limit
                    if parts_since_last_change >= maxgräns:
                        # Check if we've already sent a notification for this tool
                        notification_key = (str(machine_id), str(tool_id))
                        
                        with macro_notifications_lock:
                            # Check if we've already sent notification
                            if notification_key in macro_notifications_sent:
                                # Check if there's been a new tool change since we sent the notification
                                notification_time = macro_notifications_sent[notification_key]
                                
                                # Parse tool change time (handle both with and without timezone)
                                tool_change_str = latest_tool_change['date_created']
                                if tool_change_str.endswith('Z'):
                                    tool_change_time = datetime.fromisoformat(tool_change_str.replace('Z', '+00:00'))
                                else:
                                    tool_change_time = datetime.fromisoformat(tool_change_str)
                                
                                # Convert to naive datetime for comparison
                                if tool_change_time.tzinfo:
                                    tool_change_time = tool_change_time.replace(tzinfo=None)
                                
                                # If tool change is newer than notification, we should send again
                                if tool_change_time > notification_time:
                                    # Remove old notification to allow resending
                                    del macro_notifications_sent[notification_key]
                                else:
                                    # Already sent and no new tool change, skip
                                    continue
                            
                            # Send macro notification
                            try:
                                tool_number = int(tool_plats) if tool_plats.isdigit() else None
                                if tool_number is None:
                                    print(f"Warning: Tool plats '{tool_plats}' is not a valid number for machine {machine_number}")
                                    continue
                                
                                success = write_macro_to_cnc(ip_focas, 700, tool_number)
                                
                                if success:
                                    # Mark as sent
                                    macro_notifications_sent[notification_key] = datetime.now()
                                    if not SUPPRESS_RECURRING_LOGS:
                                        print(f"Sent macro notification: Machine {machine_number}, Tool T{tool_plats} reached max limit ({parts_since_last_change}/{maxgräns})")
                                else:
                                    print(f"Failed to send macro notification for machine {machine_number}, tool T{tool_plats}")
                            except Exception as e:
                                print(f"Error sending macro notification for machine {machine_number}, tool T{tool_plats}: {str(e)}")
                    
            except Exception as e:
                print(f"Error checking tools for machine {machine_number}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
                
    except Exception as e:
        print(f"Error in check_tool_max_limits: {str(e)}")
        import traceback
        traceback.print_exc()

def background_tool_checker():
    """
    Background thread that periodically checks for tools reaching max limits
    """
    check_interval = int(os.getenv('TOOL_MAX_CHECK_INTERVAL', '300'))  # Default 5 minutes
    
    while True:
        try:
            check_tool_max_limits()
        except Exception as e:
            print(f"Error in background tool checker: {str(e)}")
        
        time.sleep(check_interval)

if __name__ == '__main__':
    # Get configuration from environment variables
    API_HOST = os.getenv('API_HOST', '0.0.0.0')
    API_PORT = int(os.getenv('API_PORT', '5004'))
    DEBUG_MODE = os.getenv('DEBUG', 'true').lower() == 'true'
    
    print("Starting AdamBox API server with Monitor MI integration...")
    print("=" * 50)
    print(f"API will be available at: http://{API_HOST}:{API_PORT}")
    print(f"Host: {API_HOST}")
    print(f"Port: {API_PORT}")
    print(f"Debug: {DEBUG_MODE}")
    print("\nEndpoints:")
    print("  GET /api/adambox?ip=<ip_address> - Get AdamBox value")
    print("  GET /api/machine-status?wc=<work_center> - Get machine status from Monitor MI")
    print("  GET /health - Health check")
    print("\nMonitor MI Database:")
    print(f"  DSN: {DB_CONFIG['dsn']}")
    print("  Features: Real-time status, stop codes, active orders")
    print("\nPress Ctrl+C to stop the server")
    print("=" * 50)
    
    # Start background thread for tool max limit checking
    if supabase:
        print("\nStarting background tool max limit checker...")
        tool_checker_thread = threading.Thread(target=background_tool_checker, daemon=True)
        tool_checker_thread.start()
        print("Background tool checker started")
    else:
        print("\nWarning: Supabase not available, tool max limit checker not started")
    
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG_MODE)
