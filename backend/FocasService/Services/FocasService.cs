using FocasService.Models;

namespace FocasService.Services;

public class FocasService
{
    private ushort? _handle = null;
    private readonly ILogger<FocasService> _logger;

    public FocasService(ILogger<FocasService> logger)
    {
        _logger = logger;
    }

    public FocasResponse<string> Connect(string? ipAddress = null, int port = 8193, int timeout = 10)
    {
        try
        {
            ushort handle;
            short result;

            if (string.IsNullOrEmpty(ipAddress))
            {
                // Local connection
                result = Focas1.cnc_allclibhndl(out handle);
            }
            else
            {
                // Network connection using cnc_allclibhndl3
                object ipObj = ipAddress;
                result = Focas1.cnc_allclibhndl3(ipObj, (ushort)port, timeout, out handle);
            }

            if (result == Focas1.EW_OK)
            {
                _handle = handle;
                string connectionInfo = string.IsNullOrEmpty(ipAddress) 
                    ? "local connection" 
                    : $"IP: {ipAddress}, Port: {port}";
                _logger.LogInformation($"Connected to CNC with handle: {handle} ({connectionInfo})");
                return new FocasResponse<string>
                {
                    Success = true,
                    Data = $"Connected with handle: {handle}"
                };
            }
            else
            {
                string connectionInfo = string.IsNullOrEmpty(ipAddress) 
                    ? "local connection" 
                    : $"IP: {ipAddress}, Port: {port}";
                string errorMsg = $"{GetErrorString(result)} ({connectionInfo})";
                _logger.LogError($"Failed to connect to CNC: {errorMsg}");
                return new FocasResponse<string>
                {
                    Success = false,
                    Error = errorMsg,
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            string connectionInfo = string.IsNullOrEmpty(ipAddress) 
                ? "local connection" 
                : $"IP: {ipAddress}, Port: {port}";
            _logger.LogError(ex, "Error connecting to CNC ({ConnectionInfo})", connectionInfo);
            return new FocasResponse<string>
            {
                Success = false,
                Error = $"{ex.Message} (Attempted connection to: {connectionInfo})"
            };
        }
    }

    public FocasResponse<string> Disconnect()
    {
        if (_handle == null)
        {
            return new FocasResponse<string>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            short result = Focas1.cnc_freelibhndl(_handle.Value);
            if (result == Focas1.EW_OK)
            {
                _handle = null;
                return new FocasResponse<string>
                {
                    Success = true,
                    Data = "Disconnected"
                };
            }
            else
            {
                return new FocasResponse<string>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disconnecting from CNC");
            return new FocasResponse<string>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<FeedrateData> GetFeedrate()
    {
        if (_handle == null)
        {
            return new FocasResponse<FeedrateData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var act = new Focas1.ODBACT();
            short result = Focas1.cnc_actf(_handle.Value, act);

            if (result == Focas1.EW_OK)
            {
                return new FocasResponse<FeedrateData>
                {
                    Success = true,
                    Data = new FeedrateData { Feedrate = act.data }
                };
            }
            else
            {
                return new FocasResponse<FeedrateData>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading feedrate");
            return new FocasResponse<FeedrateData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<SpindleSpeedData> GetSpindleSpeed()
    {
        if (_handle == null)
        {
            return new FocasResponse<SpindleSpeedData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var act = new Focas1.ODBACT();
            short result = Focas1.cnc_acts(_handle.Value, act);

            if (result == Focas1.EW_OK)
            {
                return new FocasResponse<SpindleSpeedData>
                {
                    Success = true,
                    Data = new SpindleSpeedData { Speed = act.data }
                };
            }
            else
            {
                return new FocasResponse<SpindleSpeedData>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading spindle speed");
            return new FocasResponse<SpindleSpeedData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<AxisPositionData> GetAbsolutePosition()
    {
        if (_handle == null)
        {
            return new FocasResponse<AxisPositionData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var axis = new Focas1.ODBAXIS();
            // cnc_absolute requires: FlibHndl, a (axis type), b (dummy), ODBAXIS
            short result = Focas1.cnc_absolute(_handle.Value, Focas1.ALL_AXES, 0, axis);

            if (result == Focas1.EW_OK)
            {
                var positions = new List<int>();
                for (int i = 0; i < axis.data.Length; i++)
                {
                    positions.Add(axis.data[i]);
                }

                return new FocasResponse<AxisPositionData>
                {
                    Success = true,
                    Data = new AxisPositionData
                    {
                        Positions = positions,
                        AxisType = axis.type
                    }
                };
            }
            else
            {
                return new FocasResponse<AxisPositionData>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading absolute position");
            return new FocasResponse<AxisPositionData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<ToolRadiusData> GetToolRadius(short toolGroup, short toolNumber)
    {
        if (_handle == null)
        {
            return new FocasResponse<ToolRadiusData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var radiusData = new Focas1.ODBTLIFE4();
            short result = Focas1.cnc_rd1radius(_handle.Value, toolGroup, toolNumber, radiusData);

            if (result == Focas1.EW_OK)
            {
                return new FocasResponse<ToolRadiusData>
                {
                    Success = true,
                    Data = new ToolRadiusData
                    {
                        Radius = radiusData.data,
                        ToolGroup = radiusData.datano,
                        ToolNumber = radiusData.type
                    }
                };
            }
            else
            {
                return new FocasResponse<ToolRadiusData>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading tool radius");
            return new FocasResponse<ToolRadiusData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<ToolOffsetData> GetToolOffsets(short toolNumber)
    {
        if (_handle == null)
        {
            return new FocasResponse<ToolOffsetData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var offsetData = new ToolOffsetData
            {
                ToolNumber = toolNumber
            };

            // Read Cutter Radius Wear (type 0)
            var tofs = new Focas1.ODBTOFS();
            short result = Focas1.cnc_rdtofs(_handle.Value, toolNumber, 0, 8, tofs);
            if (result == Focas1.EW_OK)
            {
                offsetData.CutterRadiusWear = tofs.data;
            }
            else
            {
                _logger.LogWarning($"Failed to read Cutter Radius Wear for tool {toolNumber}: {GetErrorString(result)}");
            }

            // Read Cutter Radius Geometry (type 1)
            tofs = new Focas1.ODBTOFS();
            result = Focas1.cnc_rdtofs(_handle.Value, toolNumber, 1, 8, tofs);
            if (result == Focas1.EW_OK)
            {
                offsetData.CutterRadiusGeometry = tofs.data;
            }
            else
            {
                _logger.LogWarning($"Failed to read Cutter Radius Geometry for tool {toolNumber}: {GetErrorString(result)}");
            }

            // Read Tool Length Wear (type 2)
            tofs = new Focas1.ODBTOFS();
            result = Focas1.cnc_rdtofs(_handle.Value, toolNumber, 2, 8, tofs);
            if (result == Focas1.EW_OK)
            {
                offsetData.ToolLengthWear = tofs.data;
            }
            else
            {
                _logger.LogWarning($"Failed to read Tool Length Wear for tool {toolNumber}: {GetErrorString(result)}");
            }

            // Read Tool Length Geometry (type 3)
            tofs = new Focas1.ODBTOFS();
            result = Focas1.cnc_rdtofs(_handle.Value, toolNumber, 3, 8, tofs);
            if (result == Focas1.EW_OK)
            {
                offsetData.ToolLengthGeometry = tofs.data;
            }
            else
            {
                _logger.LogWarning($"Failed to read Tool Length Geometry for tool {toolNumber}: {GetErrorString(result)}");
            }

            // Return success even if some values failed to read (partial success)
            return new FocasResponse<ToolOffsetData>
            {
                Success = true,
                Data = offsetData
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading tool offsets");
            return new FocasResponse<ToolOffsetData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    private string GetErrorString(short errorCode)
    {
        // Use the enum values from focas_ret
        return errorCode switch
        {
            (short)Focas1.focas_ret.EW_OK => "No error",
            (short)Focas1.focas_ret.EW_PROTOCOL => "Protocol error",
            (short)Focas1.focas_ret.EW_SOCKET => "Windows socket error",
            (short)Focas1.focas_ret.EW_NODLL => "DLL not exist error",
            (short)Focas1.focas_ret.EW_BUS => "Bus error",
            (short)Focas1.focas_ret.EW_SYSTEM2 => "System error",
            (short)Focas1.focas_ret.EW_HSSB => "HSSB communication error",
            (short)Focas1.focas_ret.EW_HANDLE => "Windows library handle error",
            (short)Focas1.focas_ret.EW_VERSION => "CNC/PMC version mismatch",
            (short)Focas1.focas_ret.EW_UNEXP => "Abnormal error",
            (short)Focas1.focas_ret.EW_SYSTEM => "System error",
            (short)Focas1.focas_ret.EW_PARITY => "Shared RAM parity error",
            (short)Focas1.focas_ret.EW_MMCSYS => "emm386 or mmcsys install error",
            (short)Focas1.focas_ret.EW_RESET => "Reset or stop occurred error",
            (short)Focas1.focas_ret.EW_BUSY => "Busy error",
            _ => $"Unknown error: {errorCode}"
        };
    }
}
