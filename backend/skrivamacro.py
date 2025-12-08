#!/usr/bin/env python3
"""
Skript för att skriva macro-variabler till Fanuc CNC via FocasService.
Användning: python skrivamacro.py
"""

import requests
import sys
import os

# Konfiguration
FOCAS_SERVICE_URL = os.getenv('FOCAS_SERVICE_URL', 'http://localhost:5999')
CNC_IP = "192.168.3.105"
CNC_PORT = 8193
MACRO_NUMBER = 700
MACRO_VALUE = int(os.getenv('MACRO_VALUE', '1'))  # Läs från miljövariabel, default 1
MACRO_DEC_VAL = 0  # Antal decimaler (0 för heltal)

def connect_to_cnc(ip_address, port):
    """Anslut till CNC-maskin via FocasService"""
    try:
        response = requests.post(
            f"{FOCAS_SERVICE_URL}/api/focas/connect",
            json={"ipAddress": ip_address, "port": port},
            timeout=10
        )
        
        if not response.ok:
            print(f"Fel vid anslutning: HTTP {response.status_code}")
            print(f"Svar: {response.text}")
            return False
        
        data = response.json()
        if not data.get("success"):
            print(f"Kunde inte ansluta till CNC: {data.get('error', 'Okänt fel')}")
            return False
        
        print(f"✓ Ansluten till CNC {ip_address}:{port}")
        return True
    except requests.exceptions.ConnectionError:
        print(f"Fel: Kunde inte ansluta till FocasService på {FOCAS_SERVICE_URL}")
        print("Kontrollera att FocasService körs.")
        return False
    except Exception as e:
        print(f"Fel vid anslutning: {e}")
        return False

def write_macro(number, mcr_val, dec_val=0):
    """Skriv macro-variabel till CNC"""
    try:
        response = requests.post(
            f"{FOCAS_SERVICE_URL}/api/focas/write-macro",
            json={
                "number": number,
                "mcrVal": mcr_val,
                "decVal": dec_val
            },
            timeout=10
        )
        
        if not response.ok:
            print(f"Fel vid skrivning: HTTP {response.status_code}")
            print(f"Svar: {response.text}")
            return False
        
        data = response.json()
        if data.get("success"):
            print(f"✓ Macro-variabel #{number} satt till {mcr_val}")
            if dec_val != 0:
                print(f"  (Decimaler: {dec_val})")
            return True
        else:
            error_msg = data.get('error', 'Okänt fel')
            error_code = data.get('errorCode', '')
            print(f"✗ Kunde inte skriva macro-variabel: {error_msg}")
            if error_code:
                print(f"  Felkod: {error_code}")
            return False
    except Exception as e:
        print(f"Fel vid skrivning: {e}")
        return False

def disconnect():
    """Koppla från CNC"""
    try:
        response = requests.post(
            f"{FOCAS_SERVICE_URL}/api/focas/disconnect",
            timeout=5
        )
        if response.ok:
            print("✓ Frånkopplad från CNC")
    except:
        pass  # Ignorera disconnect-fel

def main():
    """Huvudfunktion"""
    print("=" * 60)
    print("Skriv Macro-variabel till Fanuc CNC")
    print("=" * 60)
    print(f"FocasService: {FOCAS_SERVICE_URL}")
    print(f"CNC IP: {CNC_IP}:{CNC_PORT}")
    print(f"Macro-variabel: #{MACRO_NUMBER}")
    print(f"Värde: {MACRO_VALUE}")
    print("=" * 60)
    print()
    
    # Anslut till CNC
    if not connect_to_cnc(CNC_IP, CNC_PORT):
        sys.exit(1)
    
    try:
        # Skriv macro-variabel
        if not write_macro(MACRO_NUMBER, MACRO_VALUE, MACRO_DEC_VAL):
            sys.exit(1)
        
        print()
        print("✓ Klart!")
        
    finally:
        # Koppla från
        disconnect()

if __name__ == "__main__":
    main()

