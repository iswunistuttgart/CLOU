# CLOU Linting Service

C# CLI tool for linting OPC UA nodeset files.

## Purpose

Validates OPC UA information models against quality rules during import.

> **For running CLOU**: See [README.md](../../README.md) - only Docker is required.

## Development

### Requirements

- .NET 10.0

### Building

UA-Modelcompiler is a prerequisite (cloning is only required once)

```bash
git clone https://github.com/OPCFoundation/UA-ModelCompiler.git services/linting/UA-ModelCompiler
```

```bash
cd services/linting/App
dotnet build -c Release
```

Output: `bin/Release/net10.0/CLOU.Linting`

## Usage

```bash
CLOU.Linting all -i [Input Dir with NodeSet XMLs] -uri [NamespaceUri of Namespace to calculate Metrics for] -o [Output Dir]
```

## Integration

This service is bundled into the backend Docker image. It's called automatically during nodeset import via the API.

## Dependencies

- .NET 10.0
- System.CommandLine
- Serilog
- Newtonsoft.Json
- JsonSchema.Net
- UA-Modelcompiler (as C# Project)

## License

Licensed under the Apache License 2.0. See [LICENSE](../../LICENSE) file for details.