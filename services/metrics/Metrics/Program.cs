/* Copyright 2026 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. and Universität Stuttgart

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

using Clou;
using ModelCompiler;
using Opc.Ua;
using System.CommandLine;
using Newtonsoft.Json;
using System.Globalization;

internal sealed class Program
{
    private static async Task Main(string[] args)
    {
        try
        {
            for (int ii = 0; ii < args.Length; ii++)
            {
                args[ii] = args[ii].Replace("\n", "\\n", StringComparison.InvariantCulture);
            }

            if (args.Length < 2)
            {
                Console.WriteLine($"CLOU Metrics Tool");
            }

            await Clou.MetricsApplication.Run(args).ConfigureAwait(false);
        }
        catch (AggregateException e)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[{e.GetType().Name}] {e.Message}");

            foreach (var ie in e.InnerExceptions)
            {
                Console.WriteLine($">>> [{ie.GetType().Name}] {ie.Message}");
            }

            Environment.Exit(3);
        }
        catch (Exception e)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[{e.GetType().Name}] {e.Message}");

            Exception ie = e.InnerException;

            while (ie != null)
            {
                Console.WriteLine($">>> [{ie.GetType().Name}] {ie.Message}");
                ie = ie.InnerException;
            }

            Console.WriteLine();
            Console.WriteLine($"========================");
            Console.WriteLine($"{e.StackTrace}");
            Console.WriteLine($"========================");
            Console.WriteLine();

            Environment.Exit(3);
        }
    }
}



namespace Clou
{
    public static class MetricsApplication
    {
        private static ITelemetryContext m_telemetry = DefaultTelemetry.Create(_ => { });
        private static readonly char[] trimChars = new char[] { '\\', '/' };

        public static async Task<int> Run(string[] args)
        {
            var rootCommand = new RootCommand("An application that calculates metrics for OPC UA Models presented as NodeSet2.xml files.");

            rootCommand.Subcommands.Add(CreateCalcMetricsCommand());
            rootCommand.Subcommands.Add(CreateListAttributesCommand());
            rootCommand.Subcommands.Add(CreateListCategoriesCommand());

            return await rootCommand.Parse(args).InvokeAsync().ConfigureAwait(false);
        }

	internal sealed class NodeSetInfo
        {
            public string FileName { get; set; }
            public string ModelUri { get; set; }
            public string Name { get; set; }
            public string Prefix { get; set; }
            public bool Ignore { get; set; }
            public string Version { get; set; }

            [JsonIgnore]
            public Opc.Ua.Export.UANodeSet NodeSet { get; set; }

            [JsonIgnore]
            public List<NodeSetInfo> PreviousVersions { get; set; }
        }

#pragma warning disable CA1812
        internal sealed class NodeSetFile
        {
            public List<NodeSetInfo> NodeSets { get; set; }
        }
#pragma warning restore CA1812

        private static string GetNameFromUri(string uri)
        {
            var builder = new Uri(uri);
            var path = builder.LocalPath.TrimEnd('/');

            if (builder.Scheme == "urn")
            {
                var fields = builder.PathAndQuery.Split(':', StringSplitOptions.RemoveEmptyEntries);
                path = String.Join(".", fields, 2, fields.Length - 2);
            }

            if (path.StartsWith("/UA/", StringComparison.InvariantCulture))
            {
                path = path.Substring(4);
            }

            if (path.StartsWith("/OpcUa/", StringComparison.InvariantCulture))
            {
                path = path.Substring(7);
            }

            if (path == "/UA")
            {
                path = builder.DnsSafeHost;
            }

            return path.Trim('/')
                .Replace("/", "", StringComparison.InvariantCulture)
                .Replace('-', '_')
                .Replace('+', '_')
                .Replace(':', '_')
                .Replace('.', '_');
        }

        private static void LoadNodeSet(FileInfo file, Dictionary<string, NodeSetInfo> nodesets)
        {
            try
            {
                if (!NodeSetToModelDesign.IsNodeSet(ModelCompiler.LocalFileSystem.Instance, file.FullName))
                {
                    return;
                }

                using (var istrm = file.OpenRead())
                {
                    SystemContext context = new SystemContext(m_telemetry);
                    Opc.Ua.Export.UANodeSet nodeset = Opc.Ua.Export.UANodeSet.Read(istrm);
                    var collection = new NodeStateCollection();
                    context.NamespaceUris = new NamespaceTable(
                        new List<string>([Namespaces.OpcUa]).Concat(nodeset.NamespaceUris ?? Enumerable.Empty<string>()
                    ));
                    context.ServerUris = new StringTable(nodeset.ServerUris ?? []);

                    try
                    {
                        nodeset.Import(context, collection);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet could not be loaded ({file.FullName}): {e.Message}");
                        return;
                    }

                    if (nodeset.Models == null || nodeset.Models.Length == 0 || String.IsNullOrEmpty(nodeset.Models[0].ModelUri))
                    {
                        System.Console.Error.WriteLine($"NodeSet is missing model definition ({file.FullName}).");
                        return;
                    }

                    var model = nodeset.Models[0];

                    if (!Uri.IsWellFormedUriString(model.ModelUri, UriKind.Absolute))
                    {
                        System.Console.Error.WriteLine($"NodeSet ModelURI is not valid ({model.ModelUri}).");
                        return;
                    }

                    var name = GetNameFromUri(model.ModelUri);

                    var info = new NodeSetInfo()
                    {
                        FileName = file.FullName,
                        ModelUri = model.ModelUri,
                        Version = model.PublicationDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        Name = name,
                        Prefix = "UAModel." + name,
                        Ignore = false,
                        NodeSet = nodeset
                    };

                    if (nodesets.TryGetValue(model.ModelUri, out var existing))
                    {
                        if (string.Compare(existing.Version, info.Version, StringComparison.Ordinal) < 0)
                        {
                            info.PreviousVersions = new List<NodeSetInfo>();

                            if (existing.PreviousVersions != null)
                            {
                                info.PreviousVersions.AddRange(existing.PreviousVersions);
                            }

                            existing.PreviousVersions = null;
                            info.PreviousVersions.Add(existing);
                        }
                    }

                    nodesets[model.ModelUri] = info;
                }
            }
            catch (Exception e)
            {
                System.Console.Error.WriteLine($"Could not parse NodeSet ({file.Name}): {e.Message}.");
            }
        }

	private static bool ComparePaths(string path1, string path2)
        {
            if (path1 == null || path2 == null)
            {
                return false;
            }

            var a = new FileInfo(".\\" + path1).FullName.ToUpperInvariant().Trim(trimChars);
            var b = new FileInfo(path2).FullName.ToUpperInvariant().Trim(trimChars);

            return a == b;
        }

        private static void CollectNodeSets(DirectoryInfo directory, Dictionary<string, NodeSetInfo> nodesets)
        {

            foreach (var file in directory.GetFiles("*.xml"))
            {

                LoadNodeSet(file, nodesets);
            }


            foreach (var child in directory.GetDirectories())
            {
                CollectNodeSets(child, nodesets);
            }
        }

        private static bool CollectDependencies(NodeSetInfo target, Dictionary<string, NodeSetInfo> nodesets, Dictionary<string, NodeSetInfo> dependencies)
        {
            if (target.NodeSet.NamespaceUris == null)
            {
                return true;
            }

            foreach (var ns in target.NodeSet.NamespaceUris)
            {
                if (dependencies.ContainsKey(ns) || ns == target.ModelUri || ns == Namespaces.OpcUa)
                {
                    continue;
                }

                if (!nodesets.TryGetValue(ns, out NodeSetInfo nodeset))
                {
                    System.Console.Error.WriteLine($"NodeSet ({target.ModelUri}) dependency is missing ({ns}).");
                    return false;
                }

                // favour the version in the same directory as the target.
                if (nodeset.PreviousVersions != null)
                {
                    if (Path.GetDirectoryName(nodeset.FileName) != Path.GetDirectoryName(target.FileName))
                    {
                        foreach (var ii in nodeset.PreviousVersions)
                        {
                            if (Path.GetDirectoryName(ii.FileName) == Path.GetDirectoryName(target.FileName))
                            {
                                nodeset = ii;
                                break;
                            }
                        }
                    }
                }

                dependencies[ns] = nodeset;

                if (!CollectDependencies(nodeset, nodesets, dependencies))
                {
                    return false;
                }
            }

            return true;
        }

        private static Metrics PrepareMetrics(
            NodeSetInfo nodeset,
            Dictionary<string, NodeSetInfo> dependecies)
        {
            Metrics metrics = new Metrics(ModelCompiler.LocalFileSystem.Instance, m_telemetry);

            List<string> files = new List<string>();
            files.Add($"{nodeset.FileName},{nodeset.Prefix},{nodeset.Name}");

            foreach (var dependency in dependecies.Values.Where(x => x.ModelUri != Namespaces.OpcUa))
            {
                files.Add($"{dependency.FileName},{dependency.Prefix},{dependency.Name}");
            }
                        
            metrics.ValidateAndUpdateIds(
                files.ToArray(),
                null,
                0,
                "v105",
                true,
                null,
                null,
                null,
                true);

            System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) loaded.");

            return metrics;
        }

	private static async Task GenerateCalculateMetrics(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.CalculateMetrics(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) metrics calculated ({output}).");
        }

	private static async Task GenerateCalcInheritanceMetrics(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.CalcInheritanceMetrics(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) inheritance metrics calculated ({output}).");
        }

	private static async Task GenerateListCategories(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.ListCategories(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) categories examined ({output}).");
        }

	private static async Task GenerateCountInstances(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.CountInstances(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) instances counted ({output}).");
        }

	private static async Task GenerateIdentifyIncludedNodes(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.IdentifyIncludedNodes(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) included nodes identified ({output}).");
        }

	private static async Task GenerateListInstancesOutOfTypes(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.ListInstancesOutOfTypes(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) instances out of types listed ({output}).");
        }

	private static async Task GenerateListAttributes(
            string output,
            NodeSetInfo nodeset,
            Metrics metrics 
        )
        {
            metrics.ListAttributes(output);
	    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) Attributes listed ({output}).");
        }



	private static class OptionsNames
        {
            public const string OutputPath = "o";
            public const string InputPath = "i";
            public const string ModelUris = "uri";
            public const string OutputPrefix = "prefix";
        }

            
	private static Command CreateCalcMetricsCommand()
        {
            var command = new Command("calc-metrics", "Takes an OPC UA Model and calculates metrics");
            var inputPathOpt = new Option<string>($"-{OptionsNames.InputPath}")
            {
                Description = "The path to the directory containing the nodesets."
            };

            var outputPathOpt = new Option<string>($"-{OptionsNames.OutputPath}")
            {
                Description = "The path to the directory to use to write the generated files."
            };

            var outputPrefixOpt = new Option<string>($"-{OptionsNames.OutputPrefix}")
            {
                Description = "The prefix on generated files."
            };

            var modelUrisOpt = new Option<string[]>($"-{OptionsNames.ModelUris}")
            {
                Description = "The URI of the model to calculate metrics for."
            };

            command.Options.Add(inputPathOpt);
            command.Options.Add(outputPathOpt);
            command.Options.Add(outputPrefixOpt);
            command.Options.Add(modelUrisOpt);

            command.SetAction(async (ParseResult parseResult, CancellationToken ct) =>
            {
                var inputPath = parseResult.GetValue(inputPathOpt) ?? "";
                var outputPath = parseResult.GetValue(outputPathOpt) ?? "";
                var outputPrefix = parseResult.GetValue(outputPrefixOpt) ?? "";
                var modelUris = parseResult.GetValue(modelUrisOpt) ?? Array.Empty<string>();

                var input = new DirectoryInfo(inputPath);

                if (!input.Exists)
                {
                    throw new ArgumentException($"The input directory does not exist ({inputPath}).");
                }

                Dictionary<string, NodeSetInfo> nodesets = new();
                CollectNodeSets(input, nodesets);
                System.Console.WriteLine($"{nodesets.Count} NodeSets found.");
                System.Console.WriteLine($"Writing output to {outputPath}");

                HashSet<string> found = new();

                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    var relativePath = new FileInfo(nodeset.FileName).DirectoryName;

                    if (relativePath.Length > input.FullName.Length)
                    {
                        relativePath = relativePath.Substring(input.FullName.Length);
                    }
                    else
                    {
                        relativePath = ".";
                    }

                    var output = Path.Combine(outputPath, relativePath);

                    if (!Directory.Exists(output))
                    {
                        Directory.CreateDirectory(output);
                    }
                }
                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    found.Add(modelUri);

                    Dictionary<string, NodeSetInfo> dependencies = new();

                    if (!CollectDependencies(nodeset, nodesets, dependencies))
                    {
                        continue;
                    }

                    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.");

                    if (!String.IsNullOrEmpty(outputPrefix))
                    {
                        nodeset.Prefix = nodeset.Prefix.Replace(
                            "UAModel",
                            outputPrefix,
                            StringComparison.Ordinal);

                        foreach (var dependency in dependencies)
                        {
                            dependency.Value.Prefix = dependency.Value.Prefix.Replace(
                                "UAModel",
                                outputPrefix,
                                StringComparison.Ordinal);
                        }
                    }

                    Metrics m = null;
                    try
                    {
                        m = PrepareMetrics(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateCalculateMetrics(outputPath, nodeset, m).ConfigureAwait(false);
                        await GenerateCalcInheritanceMetrics(outputPath, nodeset, m).ConfigureAwait(false);
                        await GenerateListCategories(outputPath, nodeset, m).ConfigureAwait(false);
                        await GenerateCountInstances(outputPath, nodeset, m).ConfigureAwait(false);
                        await GenerateIdentifyIncludedNodes(outputPath, nodeset, m).ConfigureAwait(false);
                        await GenerateListInstancesOutOfTypes(outputPath, nodeset, m).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) metrics calculation failed: {e.Message}");
                        Environment.Exit(1);
                    }
                }

                foreach (var uri in modelUris)
                {
                    if (!found.Contains(uri))
                    {
                        System.Console.Error.WriteLine($"NodeSet ({uri}) not found!");
                        Environment.Exit(1);
                    }
                }
            }
            );

            return command;

        }

	private static Command CreateListAttributesCommand()
        {
            var command = new Command("list-attrs", "Takes an OPC UA Model and lists attribute values");
            var inputPathOpt = new Option<string>($"-{OptionsNames.InputPath}")
            {
                Description = "The path to the directory containing the nodesets."
            };

            var outputPathOpt = new Option<string>($"-{OptionsNames.OutputPath}")
            {
                Description = "The path to the directory to use to write the generated files."
            };

            var outputPrefixOpt = new Option<string>($"-{OptionsNames.OutputPrefix}")
            {
                Description = "The prefix on generated files."
            };

            var modelUrisOpt = new Option<string[]>($"-{OptionsNames.ModelUris}")
            {
                Description = "The URI of the model to calculate metrics for."
            };

            command.Options.Add(inputPathOpt);
            command.Options.Add(outputPathOpt);
            command.Options.Add(outputPrefixOpt);
            command.Options.Add(modelUrisOpt);

            command.SetAction(async (ParseResult parseResult, CancellationToken ct) =>
            {
                var inputPath = parseResult.GetValue(inputPathOpt) ?? "";
                var outputPath = parseResult.GetValue(outputPathOpt) ?? "";
                var outputPrefix = parseResult.GetValue(outputPrefixOpt) ?? "";
                var modelUris = parseResult.GetValue(modelUrisOpt) ?? Array.Empty<string>();

                var input = new DirectoryInfo(inputPath);

                if (!input.Exists)
                {
                    throw new ArgumentException($"The input directory does not exist ({inputPath}).");
                }

                Dictionary<string, NodeSetInfo> nodesets = new();
                CollectNodeSets(input, nodesets);
                System.Console.WriteLine($"{nodesets.Count} NodeSets found.");
                System.Console.WriteLine($"Writing output to {outputPath}");

                HashSet<string> found = new();

                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    var relativePath = new FileInfo(nodeset.FileName).DirectoryName;

                    if (relativePath.Length > input.FullName.Length)
                    {
                        relativePath = relativePath.Substring(input.FullName.Length);
                    }
                    else
                    {
                        relativePath = ".";
                    }

                    var output = Path.Combine(outputPath, relativePath);

                    if (!Directory.Exists(output))
                    {
                        Directory.CreateDirectory(output);
                    }
                }
                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    found.Add(modelUri);

                    Dictionary<string, NodeSetInfo> dependencies = new();

                    if (!CollectDependencies(nodeset, nodesets, dependencies))
                    {
                        continue;
                    }

                    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.");

                    if (!String.IsNullOrEmpty(outputPrefix))
                    {
                        nodeset.Prefix = nodeset.Prefix.Replace(
                            "UAModel",
                            outputPrefix,
                            StringComparison.Ordinal);

                        foreach (var dependency in dependencies)
                        {
                            dependency.Value.Prefix = dependency.Value.Prefix.Replace(
                                "UAModel",
                                outputPrefix,
                                StringComparison.Ordinal);
                        }
                    }

                    Metrics m = null;
                    try
                    {
                        m = PrepareMetrics(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateListAttributes(outputPath, nodeset, m).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) metrics calculation failed: {e.Message}");
                        Environment.Exit(1);
                    }
                }

                foreach (var uri in modelUris)
                {
                    if (!found.Contains(uri))
                    {
                        System.Console.Error.WriteLine($"NodeSet ({uri}) not found!");
                        Environment.Exit(1);
                    }
                }
            }
            );

            return command;

        }
	private static Command CreateListCategoriesCommand()
        {
            var command = new Command("list-categories", "Takes an OPC UA Model and lists the categories (conformance units)");
            var inputPathOpt = new Option<string>($"-{OptionsNames.InputPath}")
            {
                Description = "The path to the directory containing the nodesets."
            };

            var outputPathOpt = new Option<string>($"-{OptionsNames.OutputPath}")
            {
                Description = "The path to the directory to use to write the generated files."
            };

            var outputPrefixOpt = new Option<string>($"-{OptionsNames.OutputPrefix}")
            {
                Description = "The prefix on generated files."
            };

            var modelUrisOpt = new Option<string[]>($"-{OptionsNames.ModelUris}")
            {
                Description = "The URI of the model to calculate metrics for."
            };

            command.Options.Add(inputPathOpt);
            command.Options.Add(outputPathOpt);
            command.Options.Add(outputPrefixOpt);
            command.Options.Add(modelUrisOpt);

            command.SetAction(async (ParseResult parseResult, CancellationToken ct) =>
            {
                var inputPath = parseResult.GetValue(inputPathOpt) ?? "";
                var outputPath = parseResult.GetValue(outputPathOpt) ?? "";
                var outputPrefix = parseResult.GetValue(outputPrefixOpt) ?? "";
                var modelUris = parseResult.GetValue(modelUrisOpt) ?? Array.Empty<string>();

                var input = new DirectoryInfo(inputPath);

                if (!input.Exists)
                {
                    throw new ArgumentException($"The input directory does not exist ({inputPath}).");
                }

                Dictionary<string, NodeSetInfo> nodesets = new();
                CollectNodeSets(input, nodesets);
                System.Console.WriteLine($"{nodesets.Count} NodeSets found.");
                System.Console.WriteLine($"Writing output to {outputPath}");

                HashSet<string> found = new();

                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    var relativePath = new FileInfo(nodeset.FileName).DirectoryName;

                    if (relativePath.Length > input.FullName.Length)
                    {
                        relativePath = relativePath.Substring(input.FullName.Length);
                    }
                    else
                    {
                        relativePath = ".";
                    }

                    var output = Path.Combine(outputPath, relativePath);

                    if (!Directory.Exists(output))
                    {
                        Directory.CreateDirectory(output);
                    }
                }
                foreach (var modelUri in modelUris)
                {
                    if (!nodesets.TryGetValue(modelUri, out NodeSetInfo nodeset))
                    {
                        continue;
                    }

                    found.Add(modelUri);

                    Dictionary<string, NodeSetInfo> dependencies = new();

                    if (!CollectDependencies(nodeset, nodesets, dependencies))
                    {
                        continue;
                    }

                    System.Console.WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.");

                    if (!String.IsNullOrEmpty(outputPrefix))
                    {
                        nodeset.Prefix = nodeset.Prefix.Replace(
                            "UAModel",
                            outputPrefix,
                            StringComparison.Ordinal);

                        foreach (var dependency in dependencies)
                        {
                            dependency.Value.Prefix = dependency.Value.Prefix.Replace(
                                "UAModel",
                                outputPrefix,
                                StringComparison.Ordinal);
                        }
                    }

                    Metrics m = null;
                    try
                    {
                        m = PrepareMetrics(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateListCategories(outputPath, nodeset, m).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) metrics generation failed: {e.Message}");
                        Environment.Exit(1);
                    }
                }

                foreach (var uri in modelUris)
                {
                    if (!found.Contains(uri))
                    {
                        System.Console.Error.WriteLine($"NodeSet ({uri}) not found!");
                        Environment.Exit(1);
                    }
                }
            }
            );

            return command;

        }


    }
}
