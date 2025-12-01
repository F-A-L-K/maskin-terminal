# Compensation Value Monitor

Bakgrundstjänst som kontinuerligt övervakar kompenseringsvärden från CNC-maskiner och loggar differanser när värden ändras.

## Funktioner

- ✅ Automatisk övervakning av kompenseringsvärden för alla verktyg
- ✅ Kontrollerar var 10:e minut (konfigurerbart)
- ✅ Uppdaterar `verktygshanteringssystem_kompenseringar_nuvarande` tabellen med nuvarande värden
- ✅ Loggar endast differanser när ändringar upptäcks i `verktygshanteringssystem_kompensering_differanser`
- ✅ Verktygsnummer formateras som "T4", "T5", etc. i `verktyg_koordinat_num` kolumnen
- ✅ Stöd för flera maskiner med FOCAS IP
- ✅ Robust felhantering

## Installation

1. Installera dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Konfigurera miljövariabler i `.env` (i projektets rot):
```env
COMPENSATION_CHECK_INTERVAL=600  # Kontrollera var 10:e minut (i sekunder, default: 600)
COMPENSATION_TOOL_RANGE_START=1  # Första verktygsnummer att kontrollera
COMPENSATION_TOOL_RANGE_END=100  # Sista verktygsnummer att kontrollera
FOCAS_SERVICE_URL=http://localhost:5999
VITE_BACKEND_URL=http://localhost:5004
VITE_SUPABASE_URL=https://xplqhaywcaaanzgzonpo.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Kör programmet

### Manuellt
```bash
cd backend
python compensation_monitor.py
```

### Som Windows-tjänst (rekommenderat)

Använd NSSM (Non-Sucking Service Manager) eller Windows Task Scheduler:

1. **Med NSSM:**
```powershell
# Ladda ner NSSM från https://nssm.cc/download
nssm install CompensationMonitor "C:\Python\python.exe" "C:\path\to\backend\compensation_monitor.py"
nssm set CompensationMonitor AppDirectory "C:\path\to\backend"
nssm start CompensationMonitor
```

2. **Med Task Scheduler:**
   - Öppna Task Scheduler
   - Skapa ny uppgift
   - Trigger: "At startup" eller "On a schedule"
   - Action: Starta program `python.exe` med argument `compensation_monitor.py`
   - Working directory: `backend` mappen

## Databasstruktur

### Tabell: `verktygshanteringssystem_kompenseringar_nuvarande`
Lagrar nuvarande kompenseringsvärden för varje verktyg:
- `machine_id`: Maskinens ID
- `verktyg_koordinat_num`: Verktygsnummer i format "T4", "T5", etc.
- `cutter_radius_geometry`: Nuvarande cutter radius geometry värde
- `cutter_radius_wear`: Nuvarande cutter radius wear värde
- `tool_length_geometry`: Nuvarande tool length geometry värde
- `tool_length_wear`: Nuvarande tool length wear värde
- `created_at`: När posten skapades
- `updated_at`: När posten senast uppdaterades

### Tabell: `verktygshanteringssystem_kompensering_differanser`
Loggar endast differanser när värden ändras:
- `machine_id`: Maskinens ID
- `tool_number`: Verktygsnummer (som integer, t.ex. 4)
- `field_name`: Vilket fält som ändrats (cutter_radius_geometry, etc.)
- `old_value`: Gammalt värde
- `new_value`: Nytt värde
- `difference`: Differansen (new_value - old_value)
- `changed_at`: När ändringen upptäcktes

## Exempel på queries

```sql
-- Se alla ändringar för ett verktyg
SELECT * FROM verktygshanteringssystem_kompensering_differanser
WHERE machine_id = '...' AND tool_number = 5
ORDER BY changed_at DESC;

-- Se senaste ändringarna för alla verktyg
SELECT * FROM verktygshanteringssystem_kompensering_differanser
WHERE machine_id = '...'
ORDER BY changed_at DESC
LIMIT 20;

-- Se största ändringarna (stora differanser)
SELECT * FROM verktygshanteringssystem_kompensering_differanser
WHERE machine_id = '...'
ORDER BY ABS(difference) DESC
LIMIT 10;
```

## Felsökning

### Programmet kan inte ansluta till CNC
- Kontrollera att FocasService körs på port 5999
- Kontrollera att Flask backend körs på port 5004
- Verifiera att `ip_focas` är korrekt konfigurerat i databasen

### Inga ändringar loggas
- Kontrollera att verktyg finns i det angivna nummerintervallet
- Verifiera att verktyg har kompenseringsvärden i CNC
- Kontrollera loggar för felmeddelanden

### Programmet kraschar
- Kontrollera att alla dependencies är installerade
- Verifiera Supabase-anslutning
- Kontrollera att databastabellerna finns (kör migrations)

## Loggning

Programmet skriver ut:
- Status för varje kontroll
- Antal kontrollerade verktyg
- Antal verktyg med ändringar
- Alla loggade differanser

Stoppa programmet med `Ctrl+C`.

