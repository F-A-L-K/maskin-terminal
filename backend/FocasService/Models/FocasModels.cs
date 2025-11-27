namespace FocasService.Models;

public class FocasResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public int ErrorCode { get; set; }
}

public class FeedrateData
{
    public int Feedrate { get; set; }
}

public class SpindleSpeedData
{
    public int Speed { get; set; }
}

public class AxisPositionData
{
    public List<int> Positions { get; set; } = new();
    public short AxisType { get; set; }
}

public class ConnectionRequest
{
    public string? IpAddress { get; set; }
    public int Port { get; set; } = 8193; // Default FOCAS port
}

public class ToolRadiusData
{
    public int Radius { get; set; }
    public short ToolGroup { get; set; }
    public short ToolNumber { get; set; }
}

public class ToolRadiusRequest
{
    public short ToolGroup { get; set; } = 0; // 0 = aktuell grupp
    public short ToolNumber { get; set; }
}

public class ToolOffsetData
{
    public short ToolNumber { get; set; }
    public int? CutterRadiusWear { get; set; }
    public int? CutterRadiusGeometry { get; set; }
    public int? ToolLengthWear { get; set; }
    public int? ToolLengthGeometry { get; set; }
}

public class ToolOffsetRequest
{
    public short ToolNumber { get; set; }
}

public class ToolOffsetRangeRequest
{
    public short StartToolNumber { get; set; }
    public short EndToolNumber { get; set; }
}

public class ToolOffsetRangeData
{
    public List<ToolOffsetData> Tools { get; set; } = new();
}

public class WorkZeroOffsetData
{
    public short CoordinateSystemNumber { get; set; } // P1 = 1, P2 = 2, etc.
    public Dictionary<short, int?> AxisOffsets { get; set; } = new(); // Key: axis number (0=X, 1=Y, 2=Z), Value: offset in 0.001mm
}

public class WorkZeroOffsetRangeData
{
    public List<WorkZeroOffsetData> CoordinateSystems { get; set; } = new();
}

public class WorkZeroOffsetRangeRequest
{
    public short StartCoordinateSystem { get; set; } = 1; // P1 = 1
    public short EndCoordinateSystem { get; set; } = 7; // P7 = 7
}

public class WorkZeroOffsetSingleRequest
{
    public short Number { get; set; } // Offset number
    public short Axis { get; set; } // Axis number (or -1 for ALL_AXES)
    public short Length { get; set; } // Size of IODBZOFS structure
}

public class WorkZeroOffsetSingleData
{
    public short Number { get; set; }
    public short Axis { get; set; }
    public int[]? Data { get; set; } // Array of offset values
}

public class WorkZeroOffsetRangeSingleRequest
{
    public short Axis { get; set; } // Axis number (1=X, 2=Y, 3=Z, 4=C, 5=B, or -1 for ALL_AXES)
    public short StartNumber { get; set; } // Start offset number (s_number)
    public short EndNumber { get; set; } // End offset number (e_number)
    public short? Length { get; set; } // Size of IODBZOR structure (null = calculate automatically)
}

public class WorkZeroOffsetRangeSingleData
{
    public short StartNumber { get; set; }
    public short EndNumber { get; set; }
    public short Axis { get; set; }
    public int[]? Data { get; set; } // Array of offset values (7*MAX_AXIS elements)
}

