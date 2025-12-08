using FocasService.Models;
using System.Linq;
using System.Runtime.InteropServices;

namespace FocasService.Services;

public class FocasService
{
    private ushort? _handle = null;
    private string? _lastIpAddress = null;
    private int _lastPort = 8193;
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
                _lastIpAddress = ipAddress;
                _lastPort = port;
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

    private bool TryReconnect()
    {
        if (string.IsNullOrEmpty(_lastIpAddress))
        {
            _logger.LogWarning("Cannot reconnect: No previous IP address stored");
            return false;
        }

        _logger.LogInformation($"Attempting to reconnect to {_lastIpAddress}:{_lastPort}...");
        var connectResult = Connect(_lastIpAddress, _lastPort);
        return connectResult.Success;
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

            // Helper function to read offset with retry on handle error
            int? ReadOffset(short type, string offsetName)
            {
                var tofs = new Focas1.ODBTOFS();
                short result = Focas1.cnc_rdtofs(_handle!.Value, toolNumber, type, 8, tofs);
                
                if (result == Focas1.EW_OK)
                {
                    _logger.LogInformation($"Tool {toolNumber} {offsetName} (type {type}): {tofs.data}");
                    return tofs.data;
                }
                else if (result == (short)Focas1.focas_ret.EW_HANDLE)
                {
                    // Handle error - try to reconnect
                    _logger.LogWarning($"Handle error for tool {toolNumber} {offsetName}. Attempting to reconnect...");
                    if (TryReconnect())
                    {
                        // Retry once after reconnection
                        tofs = new Focas1.ODBTOFS();
                        result = Focas1.cnc_rdtofs(_handle!.Value, toolNumber, type, 8, tofs);
                        if (result == Focas1.EW_OK)
                        {
                            _logger.LogInformation($"Tool {toolNumber} {offsetName} (type {type}) after reconnect: {tofs.data}");
                            return tofs.data;
                        }
                    }
                    _logger.LogWarning($"Failed to read {offsetName} for tool {toolNumber} after reconnect: {GetErrorString(result)} (Error code: {result})");
                    return null;
                }
                else
                {
                    // Other errors (EW_NUMBER, EW_ATTRIB, etc.) - tool might not exist or type not available
                    _logger.LogWarning($"Failed to read {offsetName} for tool {toolNumber}: {GetErrorString(result)} (Error code: {result})");
                    return null;
                }
            }

            // Read all four offset types
            offsetData.CutterRadiusWear = ReadOffset(0, "Cutter Radius Wear");
            offsetData.CutterRadiusGeometry = ReadOffset(1, "Cutter Radius Geometry");
            offsetData.ToolLengthWear = ReadOffset(2, "Tool Length Wear");
            offsetData.ToolLengthGeometry = ReadOffset(3, "Tool Length Geometry");

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

    public FocasResponse<ToolOffsetRangeData> GetToolOffsetsRange(short startToolNumber, short endToolNumber)
    {
        if (_handle == null)
        {
            return new FocasResponse<ToolOffsetRangeData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var result = new ToolOffsetRangeData();
            
            // Read all tools using the individual GetToolOffsets method
            // This uses cnc_rdtofs which is more reliable than cnc_rdtofsr
            // We'll read all tools sequentially but efficiently
            for (short toolNum = startToolNumber; toolNum <= endToolNumber; toolNum++)
            {
                try
                {
                    var toolResponse = GetToolOffsets(toolNum);
                    if (toolResponse.Success && toolResponse.Data != null)
                    {
                        result.Tools.Add(toolResponse.Data);
                    }
                    else
                    {
                        // Add tool with null values if read failed
                        result.Tools.Add(new ToolOffsetData { ToolNumber = toolNum });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error reading tool {toolNum}");
                    // Add tool with null values if read failed
                    result.Tools.Add(new ToolOffsetData { ToolNumber = toolNum });
                }
            }

            return new FocasResponse<ToolOffsetRangeData>
            {
                Success = true,
                Data = result
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading tool offsets range");
            return new FocasResponse<ToolOffsetRangeData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<WorkZeroOffsetRangeData> GetWorkZeroOffsetsRange(short startCoordinateSystem, short endCoordinateSystem)
    {
        if (_handle == null)
        {
            return new FocasResponse<WorkZeroOffsetRangeData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            var result = new WorkZeroOffsetRangeData();
            
            // Read work zero offsets for each coordinate system (P1, P2, etc.)
            // For each coordinate system, we need to read all axes (X, Y, Z, etc.)
            for (short coordSys = startCoordinateSystem; coordSys <= endCoordinateSystem; coordSys++)
            {
                try
                {
                    var coordData = new WorkZeroOffsetData
                    {
                        CoordinateSystemNumber = coordSys
                    };

                    // Read all axes for this coordinate system using cnc_rdzofs
                    // For G54.1P1-P48, use offset numbers 7-54 (coordSys should be 7-54)
                    // According to FOCAS documentation:
                    // - number: offset number (7-54 for G54.1P1-P48)
                    // - axis: ALL_AXES (-1) to read all axes at once, or axis number (1, 2, 3, etc.) for individual axis
                    // - length: size of IODBZOFS structure
                    try
                    {
                        // Calculate length: datano (2) + type (2) + data[MAX_AXIS] (4*MAX_AXIS)
                        // With Pack=4, structure is: 4 + 4*MAX_AXIS
                        short length = (short)(4 + 4 * Focas1.MAX_AXIS);
                        
                        // Try reading all axes at once first
                        var zofs = new Focas1.IODBZOFS();
                        short resultCode = Focas1.cnc_rdzofs(_handle.Value, coordSys, Focas1.ALL_AXES, length, zofs);

                        if (resultCode == Focas1.EW_OK)
                        {
                            // Extract values from the array
                            // The data array contains values for all axes, indexed by axis number
                            if (zofs.data != null && zofs.data.Length > 0)
                            {
                                // Read up to 3 axes (X, Y, Z) - adjust if needed
                                for (short axis = 0; axis < 3 && axis < zofs.data.Length; axis++)
                                {
                                    coordData.AxisOffsets[axis] = zofs.data[axis];
                                }
                                int? xVal = coordData.AxisOffsets.ContainsKey(0) ? coordData.AxisOffsets[0] : null;
                                int? yVal = coordData.AxisOffsets.ContainsKey(1) ? coordData.AxisOffsets[1] : null;
                                int? zVal = coordData.AxisOffsets.ContainsKey(2) ? coordData.AxisOffsets[2] : null;
                                // coordSys 7 = G54.1P1, coordSys 8 = G54.1P2, etc.
                                short pNumber = (short)(coordSys - 6); // Convert offset number to P number
                                _logger.LogInformation($"Read coordinate system G54.1P{pNumber} (offset {coordSys}): X={xVal}, Y={yVal}, Z={zVal}");
                            }
                        }
                        else if (resultCode == 2 || resultCode == (short)Focas1.focas_ret.EW_LENGTH)
                        {
                            // EW_LENGTH error - try with calculated length or read axes individually
                            _logger.LogWarning($"Length error for coordinate system {coordSys} (error {resultCode}). Trying individual axes...");
                            
                            // Fallback: Read each axis individually
                            for (short axis = 1; axis <= 3; axis++) // Axis 1=X, 2=Y, 3=Z (1-indexed in FOCAS)
                            {
                                zofs = new Focas1.IODBZOFS();
                                // For individual axis, length might be different - try smaller length
                                short axisLength = (short)(4 + 4); // datano + type + one axis value
                                resultCode = Focas1.cnc_rdzofs(_handle.Value, coordSys, axis, axisLength, zofs);
                                
                                if (resultCode == Focas1.EW_OK && zofs.data != null && zofs.data.Length > 0)
                                {
                                    // Axis numbers in FOCAS are 1-indexed, but we store as 0-indexed
                                    short axisIndex = (short)(axis - 1); // Convert to 0-indexed (0=X, 1=Y, 2=Z)
                                    coordData.AxisOffsets[axisIndex] = zofs.data[0];
                                }
                                else
                                {
                                    _logger.LogWarning($"Failed to read coordinate system {coordSys} axis {axis}: {GetErrorString(resultCode)}");
                                }
                            }
                        }
                        else if (resultCode == (short)Focas1.focas_ret.EW_HANDLE)
                        {
                            // Handle error - try to reconnect
                            _logger.LogWarning($"Handle error for coordinate system {coordSys}. Attempting to reconnect...");
                            if (TryReconnect())
                            {
                                zofs = new Focas1.IODBZOFS();
                                resultCode = Focas1.cnc_rdzofs(_handle.Value, coordSys, Focas1.ALL_AXES, length, zofs);
                                if (resultCode == Focas1.EW_OK && zofs.data != null && zofs.data.Length > 0)
                                {
                                    for (short axis = 0; axis < 3 && axis < zofs.data.Length; axis++)
                                    {
                                        coordData.AxisOffsets[axis] = zofs.data[axis];
                                    }
                                }
                            }
                            if (resultCode != Focas1.EW_OK)
                            {
                                _logger.LogWarning($"Failed to read coordinate system {coordSys} after reconnect: {GetErrorString(resultCode)}");
                            }
                        }
                        else
                        {
                            // Other errors - log but continue
                            _logger.LogWarning($"Failed to read coordinate system {coordSys}: {GetErrorString(resultCode)} (Error code: {resultCode})");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error reading coordinate system {coordSys}");
                    }

                    result.CoordinateSystems.Add(coordData);
                    _logger.LogInformation($"Read work zero offsets for coordinate system P{coordSys}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error reading coordinate system {coordSys}");
                    // Add coordinate system with null values if read failed
                    result.CoordinateSystems.Add(new WorkZeroOffsetData { CoordinateSystemNumber = coordSys });
                }
            }

            return new FocasResponse<WorkZeroOffsetRangeData>
            {
                Success = true,
                Data = result
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading work zero offsets range");
            return new FocasResponse<WorkZeroOffsetRangeData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<WorkZeroOffsetSingleData> GetWorkZeroOffset(short number, short axis, short length)
        {
            if (_handle == null)
            {
                return new FocasResponse<WorkZeroOffsetSingleData>
                {
                    Success = false,
                    Error = "Not connected"
                };
            }

            try
            {
                var zofs = new Focas1.IODBZOFS();
                short resultCode = Focas1.cnc_rdzofs(_handle.Value, number, axis, length, zofs);

                if (resultCode == Focas1.EW_OK)
                {
                    var result = new WorkZeroOffsetSingleData
                    {
                        Number = zofs.datano,
                        Axis = zofs.type,
                        Data = zofs.data != null ? (int[])zofs.data.Clone() : null
                    };

                    _logger.LogInformation($"Read work zero offset: number={number}, axis={axis}, length={length}");
                    return new FocasResponse<WorkZeroOffsetSingleData>
                    {
                        Success = true,
                        Data = result
                    };
                }
                else
                {
                    // Try to reconnect on handle error
                    if (resultCode == (short)Focas1.focas_ret.EW_HANDLE)
                    {
                        _logger.LogWarning($"Handle error for work zero offset. Attempting to reconnect...");
                        if (TryReconnect())
                        {
                            zofs = new Focas1.IODBZOFS();
                            resultCode = Focas1.cnc_rdzofs(_handle.Value, number, axis, length, zofs);
                            if (resultCode == Focas1.EW_OK)
                            {
                                var result = new WorkZeroOffsetSingleData
                                {
                                    Number = zofs.datano,
                                    Axis = zofs.type,
                                    Data = zofs.data != null ? (int[])zofs.data.Clone() : null
                                };
                                return new FocasResponse<WorkZeroOffsetSingleData>
                                {
                                    Success = true,
                                    Data = result
                                };
                            }
                        }
                    }

                    return new FocasResponse<WorkZeroOffsetSingleData>
                    {
                        Success = false,
                        Error = GetErrorString(resultCode),
                        ErrorCode = resultCode
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading work zero offset");
                return new FocasResponse<WorkZeroOffsetSingleData>
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

    public FocasResponse<WorkZeroOffsetRangeSingleData> GetWorkZeroOffsetsRangeSingle(short axis, short startNumber, short endNumber, short? length = null)
    {
        if (_handle == null)
        {
            return new FocasResponse<WorkZeroOffsetRangeSingleData>
            {
                Success = false,
                Error = "Not connected"
            };
        }

        try
        {
            // Calculate length if not provided
            // IODBZOR structure: datano_s (2) + type (2) + datano_e (2) + data[7*MAX_AXIS] (4*7*MAX_AXIS)
            // With Pack=4, structure is: 6 + 4*7*MAX_AXIS
            short calculatedLength = length ?? (short)(6 + 4 * 7 * Focas1.MAX_AXIS);
            
            var zor = new Focas1.IODBZOR();
            // cnc_rdzofsr signature: cnc_rdzofsr(FlibHndl, a, b, c, d, IODBZOR)
            // FOCAS API actually expects: a=s_number, b=axis, c=e_number, d=length
            // So we need to swap axis and startNumber when calling
            // User inputs: s_number=7, axis=1, e_number=12
            // We call: cnc_rdzofsr(handle, startNumber=7, axis=1, endNumber=12, length, zor)
            short resultCode = Focas1.cnc_rdzofsr(_handle.Value, startNumber, axis, endNumber, calculatedLength, zor);

            if (resultCode == Focas1.EW_OK)
            {
                var result = new WorkZeroOffsetRangeSingleData
                {
                    StartNumber = zor.datano_s,
                    EndNumber = zor.datano_e,
                    Axis = zor.type,
                    Data = zor.data != null ? (int[])zor.data.Clone() : null
                };

                _logger.LogInformation($"Read work zero offsets range: axis={axis}, start={startNumber}, end={endNumber}, length={calculatedLength}");
                return new FocasResponse<WorkZeroOffsetRangeSingleData>
                {
                    Success = true,
                    Data = result
                };
            }
            else
            {
                // Try to reconnect on handle error
                if (resultCode == (short)Focas1.focas_ret.EW_HANDLE)
                {
                    _logger.LogWarning($"Handle error for work zero offsets range. Attempting to reconnect...");
                    if (TryReconnect())
                    {
                        zor = new Focas1.IODBZOR();
                        // Swap startNumber and axis when calling FOCAS (a=s_number, b=axis)
                        resultCode = Focas1.cnc_rdzofsr(_handle.Value, startNumber, axis, endNumber, calculatedLength, zor);
                        if (resultCode == Focas1.EW_OK)
                        {
                            var result = new WorkZeroOffsetRangeSingleData
                            {
                                StartNumber = zor.datano_s,
                                EndNumber = zor.datano_e,
                                Axis = zor.type,
                                Data = zor.data != null ? (int[])zor.data.Clone() : null
                            };
                            return new FocasResponse<WorkZeroOffsetRangeSingleData>
                            {
                                Success = true,
                                Data = result
                            };
                        }
                    }
                }

                return new FocasResponse<WorkZeroOffsetRangeSingleData>
                {
                    Success = false,
                    Error = GetErrorString(resultCode),
                    ErrorCode = resultCode
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading work zero offsets range");
            return new FocasResponse<WorkZeroOffsetRangeSingleData>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public FocasResponse<WriteMacroData> WriteMacro(short number, int mcrVal, short decVal = 0)
    {
        if (_handle == null)
        {
            return new FocasResponse<WriteMacroData>
            {
                Success = false,
                Error = "Not connected. Please connect first."
            };
        }

        try
        {
            // cnc_wrmacro signature: cnc_wrmacro(ushort FlibHndl, short number, short length, int mcr_val, short dec_val)
            // length should be 10 according to documentation
            short length = 10;
            short result = Focas1.cnc_wrmacro(_handle.Value, number, length, mcrVal, decVal);

            if (result == Focas1.EW_OK)
            {
                return new FocasResponse<WriteMacroData>
                {
                    Success = true,
                    Data = new WriteMacroData
                    {
                        Number = number,
                        McrVal = mcrVal,
                        DecVal = decVal
                    }
                };
            }
            else if (result == (short)Focas1.focas_ret.EW_HANDLE)
            {
                // Handle error - try to reconnect
                _logger.LogWarning($"Handle error for macro #{number}. Attempting to reconnect...");
                if (TryReconnect())
                {
                    // Retry once after reconnection
                    result = Focas1.cnc_wrmacro(_handle.Value, number, length, mcrVal, decVal);
                    if (result == Focas1.EW_OK)
                    {
                        _logger.LogInformation($"Successfully wrote macro #{number} after reconnect");
                        return new FocasResponse<WriteMacroData>
                        {
                            Success = true,
                            Data = new WriteMacroData
                            {
                                Number = number,
                                McrVal = mcrVal,
                                DecVal = decVal
                            }
                        };
                    }
                }
                return new FocasResponse<WriteMacroData>
                {
                    Success = false,
                    Error = $"Failed to write macro #{number} after reconnect: {GetErrorString(result)}",
                    ErrorCode = result
                };
            }
            else
            {
                return new FocasResponse<WriteMacroData>
                {
                    Success = false,
                    Error = GetErrorString(result),
                    ErrorCode = result
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing macro variable {Number}", number);
            return new FocasResponse<WriteMacroData>
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
            (short)Focas1.focas_ret.EW_NUMBER => "Data number error / Range error",
            (short)Focas1.focas_ret.EW_ATTRIB => "Data attribute error / Type error",
            (short)Focas1.focas_ret.EW_DATA => "Data error",
            (short)Focas1.focas_ret.EW_LENGTH => "Data block length error",
            _ => $"Unknown error: {errorCode}"
        };
    }
}
