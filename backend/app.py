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
from datetime import datetime
from typing import Optional, Tuple
import requests

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

# Compensation list file paths
DEFAULT_KOMPENSERING_DIR = r"\\alpha\Interna System\Maskinterminal\Kompenseringslista"

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

def get_db_connection():
    """Create and return a database connection"""
    cs = f"DSN={DB_CONFIG['dsn']};" + (f"UID={DB_CONFIG['uid']};" if DB_CONFIG['uid'] else "") + (f"PWD={DB_CONFIG['pwd']};" if DB_CONFIG['pwd'] else "") + f"Timeout={DB_CONFIG['timeout']};"
    return pyodbc.connect(cs)

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
    
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG_MODE)
