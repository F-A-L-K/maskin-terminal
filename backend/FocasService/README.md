# FOCAS Service

ASP.NET Core Web API-tjänst för att använda Fanuc FOCAS-biblioteket via REST API.

## Krav

- .NET 8.0 SDK
- Windows (FOCAS-biblioteket är Windows-specifikt)
- FOCAS-drivrutiner installerade

## Installation

1. Navigera till projektmappen:
```powershell
cd backend\FocasService
```

2. Restaurera NuGet-paket:
```powershell
dotnet restore
```

3. Bygg projektet:
```powershell
dotnet build
```

## Körning

Starta tjänsten:
```powershell
dotnet run
```

Tjänsten körs på `http://localhost:5999` (eller porten angiven i `launchSettings.json`).

## API Endpoints

### Status
- `GET /api/focas/status` - Kontrollera om tjänsten körs

### Anslutning
- `POST /api/focas/connect` - Anslut till CNC-maskin
  ```json
  {
    "ipAddress": "192.168.1.100",  // Optional, null för lokal anslutning
    "port": 8193                    // Optional, default 8193
  }
  ```

- `POST /api/focas/disconnect` - Koppla från CNC-maskin

### Data
- `GET /api/focas/feedrate` - Läs aktuell matningshastighet
- `GET /api/focas/spindle-speed` - Läs aktuell spindelhastighet
- `GET /api/focas/absolute-position` - Läs absoluta axelpositioner

## Response Format

Alla endpoints returnerar JSON i följande format:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "errorCode": 0
}
```

Vid fel:
```json
{
  "success": false,
  "data": null,
  "error": "Error message",
  "errorCode": -1
}
```

## Swagger UI

När tjänsten körs i Development-läge kan du öppna Swagger UI på:
`http://localhost:5999/swagger`

## Integration med Flask Backend

I din Flask-backend kan du anropa tjänsten:

```python
import requests

FOCAS_SERVICE_URL = "http://localhost:5999"

# Anslut
response = requests.post(f"{FOCAS_SERVICE_URL}/api/focas/connect", 
                        json={"ipAddress": "192.168.1.100"})

# Läs feedrate
response = requests.get(f"{FOCAS_SERVICE_URL}/api/focas/feedrate")
```

## Felsökning

- **EW_NODLL**: FWLIB32.dll hittas inte. Kontrollera att DLL:en finns i `Focas`-mappen.
- **EW_SOCKET**: Nätverksfel. Kontrollera IP-adress och port.
- **EW_VERSION**: Version mismatch. Kontrollera FOCAS-drivrutinernas version.

