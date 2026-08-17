# CLOU Metrics Service

C# CLI tool for calculating metrics on OPC UA nodeset files.

## Purpose

Analyzes OPC UA information models and calculates node counts, reference types, and category distributions.

> **For running CLOU**: See [README.md](../../README.md) - only Docker is required.

## Development

### Requirements

- .NET 10.0

### Building

UA-Modelcompiler is a prerequisite (cloning is only required once)

```bash
git clone https://github.com/OPCFoundation/UA-ModelCompiler.git services/metrics/UA-ModelCompiler
```

```bash
cd services/metrics/Metrics
dotnet build -c Release
```

Output: `bin/Release/net10.0/Metrics`

## Usage

```bash
Metrics calc-metrics -i [Input Dir with NodeSet XMLs] -uri [NamespaceUri of Namespace to calculate Metrics for] -o [Output Dir]
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