# AdamBox Integration Backend

This backend provides API endpoints to read values from Advantech AdamBox devices.

## Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the API Server
```bash
python app.py
```

## API Endpoints

### GET /api/adambox
Get AdamBox value for a specific IP address.

**Query Parameters:**
- `ip` (required): IP address of the AdamBox

**Example:**
```bash
curl "http://localhost:5004/api/adambox?ip=192.168.3.25"
```

**Response:**
```json
{
  "ip_address": "192.168.3.25",
  "register_address": 2,
  "value": 13519,
  "timestamp": "2025-09-18T08:30:45.123456",
  "status": "success"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "AdamBox API"
}
```

## Configuration

### Machine IP Mapping
Update the IP addresses in `src/lib/adambox.ts`:

```typescript
const MACHINE_IP_MAPPING: Record<string, string> = {
  "5701 Fanuc Robodrill": "192.168.3.25",
  "5702 Fanuc Robodrill": "192.168.3.26",
  // Add more machines as needed
};
```

## Integration with Frontend

The frontend automatically calls the API when creating a new tool change:

1. User opens "Nytt verktygsbyte" dialog
2. Frontend calls `/api/adambox?ip=<machine_ip>`
3. Backend reads register 2 from AdamBox
4. Value is included in the tool change data
5. Data is saved to database with `number_of_parts_ADAM` field

## Troubleshooting

### Connection Issues
- Check if AdamBox is powered on
- Verify network connectivity to the IP address
- Ensure Modbus TCP is enabled on port 502

### API Issues
- Check if the API server is running on port 5004
- Verify CORS is enabled for frontend requests
- Check backend logs for error messages

### Frontend Issues
- Ensure the API server is running before using the frontend
- Check browser console for network errors
- Verify machine IP mapping is correct