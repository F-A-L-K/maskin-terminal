# Environment Configuration Setup

This guide explains how to configure the application to work with different IP addresses and ports.

## Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file with your specific configuration:**
   ```env
   # Frontend URL (where the React app is served)
   VITE_APP_URL=http://192.168.1.100:5173

   # Backend API Configuration
   VITE_API_BASE_URL=http://192.168.1.100:5004
   VITE_API_HOST=192.168.1.100
   VITE_API_PORT=5004

   # Development Configuration
   VITE_DEV_MODE=true
   ```

3. **Start the backend:**
   ```bash
   cd backend
   python app.py
   ```

4. **Start the frontend:**
   ```bash
   npm run dev
   ```

## Configuration Options

### Frontend Variables (VITE_*)
- `VITE_APP_URL`: The URL where the React app is accessible
- `VITE_API_BASE_URL`: The full URL to the backend API
- `VITE_API_HOST`: The IP address or hostname of the backend server
- `VITE_API_PORT`: The port number for the backend server
- `VITE_DEV_MODE`: Set to 'true' for development mode

### Backend Variables
- `API_HOST`: The host to bind the Flask server to (default: 0.0.0.0)
- `API_PORT`: The port to run the Flask server on (default: 5004)
- `DEBUG`: Set to 'true' for debug mode (default: true)

## Example Configurations

### Local Development
```env
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:5004
VITE_API_HOST=localhost
VITE_API_PORT=5004
VITE_DEV_MODE=true
```

### Network Deployment (IP: 192.168.1.100)
```env
VITE_APP_URL=http://192.168.1.100:5173
VITE_API_BASE_URL=http://192.168.1.100:5004
VITE_API_HOST=192.168.1.100
VITE_API_PORT=5004
VITE_DEV_MODE=false
```

### Production Deployment
```env
VITE_APP_URL=https://yourdomain.com
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_API_HOST=0.0.0.0
VITE_API_PORT=5004
VITE_DEV_MODE=false
```

## Backend Dependencies

Make sure to install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

## Troubleshooting

1. **CORS Issues**: Make sure the `VITE_API_BASE_URL` matches exactly where your backend is running
2. **Connection Refused**: Check that the backend is running and the IP/port are correct
3. **Environment Variables Not Loading**: Make sure the `.env` file is in the root directory and has the correct format

## File Structure
```
project/
├── .env                 # Your environment configuration (create this)
├── env.example          # Example environment file
├── backend/
│   ├── app.py          # Main Flask application (loads .env automatically)
│   └── requirements.txt
└── src/
    └── lib/
        ├── adambox.ts      # Uses VITE_API_BASE_URL
        └── machinestatus.ts # Uses VITE_API_BASE_URL
```
