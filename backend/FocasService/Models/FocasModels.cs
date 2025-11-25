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
    public int CutterRadiusWear { get; set; }
    public int CutterRadiusGeometry { get; set; }
    public int ToolLengthWear { get; set; }
    public int ToolLengthGeometry { get; set; }
}

public class ToolOffsetRequest
{
    public short ToolNumber { get; set; }
}

