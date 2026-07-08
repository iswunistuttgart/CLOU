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

using System.CommandLine;
using Newtonsoft.Json;
using Opc.Ua;
using System.Globalization;
using ModelCompiler;


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
                Console.WriteLine($"CLOU Linting Tool");
            }

            await Clou.LintingApplication.Run(args).ConfigureAwait(false);
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
    public static class LintingApplication
    {
        private static ITelemetryContext m_telemetry = DefaultTelemetry.Create(_ => { });
        private static readonly char[] trimChars = new char[] { '\\', '/' };

        public static async Task<int> Run(string[] args)
        {
            var rootCommand = new RootCommand("This application takes a NodeSet File and provides information for improvements.");

            //rootCommand.Subcommands.Add(CreateCompileCommand());
            //rootCommand.Subcommands.Add(CreateUnitsCommand());
            rootCommand.Subcommands.Add(CreateLintAllTargetsCommand());
            rootCommand.Subcommands.Add(CreateListInconsistenciesCommand());
            rootCommand.Subcommands.Add(CreateOverThresholdCommand());

            return await rootCommand.Parse(args).InvokeAsync().ConfigureAwait(false);
        }

        private static void WriteLine(string message, ConsoleColor color)
        {
            var current = System.Console.ForegroundColor;
            System.Console.ForegroundColor = color;
            System.Console.WriteLine(message);
            System.Console.ForegroundColor = current;
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

        private static NodeSetFile LoadConfigFile(DirectoryInfo directory)
        {
            var path = Path.Combine(directory.FullName, ".modelcompiler.json");

            NodeSetFile config = null;

            if (File.Exists(path))
            {
                using (var reader = new StreamReader(path))
                {
                    config = JsonConvert.DeserializeObject<NodeSetFile>(reader.ReadToEnd());
                }
            }

            return config;
        }

        private static void ApplyConfigFile(DirectoryInfo directory, NodeSetFile config, Dictionary<string, NodeSetInfo> nodesets)
        {
            if (config?.NodeSets != null)
            {
                foreach (var nodeset in config.NodeSets)
                {
                    if (String.IsNullOrEmpty(nodeset.ModelUri))
                    {
                        continue;
                    }

                    if (nodesets.TryGetValue(nodeset.ModelUri, out var existing))
                    {
                        if (existing.FileName == null || ComparePaths(Path.GetDirectoryName(existing.FileName), directory.FullName))
                        {
                            existing.Name = nodeset.Name;
                            existing.Prefix = nodeset.Prefix;
                            existing.Ignore = nodeset.Ignore;
                        }
                    }
                }
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
            var config = LoadConfigFile(directory);

            foreach (var file in directory.GetFiles("*.xml"))
            {
                if (config != null && config.NodeSets.Where(x => ComparePaths(x.FileName, file.Name) && x.Ignore).Any())
                {
                    continue;
                }

                LoadNodeSet(file, nodesets);
            }

            ApplyConfigFile(directory, config, nodesets);

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

        private static Linter PrepareLinter(
            NodeSetInfo nodeset,
            Dictionary<string, NodeSetInfo> dependencies
        )
        {
            Linter linter = new Linter(ModelCompiler.LocalFileSystem.Instance, m_telemetry);


            List<string> files = new List<string>();
            files.Add($"{nodeset.FileName},{nodeset.Prefix},{nodeset.Name}");

            foreach (var dependency in dependencies.Values.Where(x => x.ModelUri != Namespaces.OpcUa))
            {
                files.Add($"{dependency.FileName},{dependency.Prefix},{dependency.Name}");
            }
                        
            linter.ValidateAndUpdateIds(
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

            return linter;

        }

        private static async Task GenerateOverThreshold(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            var t = new Thresholds()
            {
                aggregates = new Threshold(),
                rDit = new Threshold()
            };
            t.aggregates.error = 100;
            t.aggregates.warning = 30;
            t.aggregates.info = 20;
            t.rDit.error = 10;
            t.rDit.warning = 5;
            t.rDit.info = 4;
            linter.ReportNodesOverThreshold(outputPath, t);
            WriteLine($"NodeSet ({nodeset.ModelUri}) Nodes over threshold reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        private static async Task GenerateMissingCategories(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListMissingCategories(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) missing categories reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        
        private static async Task GenerateInstancesOutOfTypes(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListInstancesOutOfTypes(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) unreferenced nodes reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        private static async Task GenerateMissingDescriptions(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListMissingDescriptions(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) missing descriptions reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        private static async Task GenerateEventNotifier(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListEventNotifier(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) eventNotifier reported ({outputPath}).", ConsoleColor.DarkGreen);
        }
        
        private static async Task GenerateAccessLevel(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListAccessLevel(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) AccessLevel reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        private static async Task GenerateNamingRules(
            string outputPath,
            NodeSetInfo nodeset,
            Linter linter
        )
        {
            linter.ListNamingRules(outputPath);
            WriteLine($"NodeSet ({nodeset.ModelUri}) naming rules reported ({outputPath}).", ConsoleColor.DarkGreen);
        }

        

        private static class OptionsNames
        {
            public const string DesignFiles = "d2";
            public const string IdentifierFile = "c";
            public const string GenerateIdentifierFile = "cg";
            public const string OutputPath = "o";
            public const string Version = "version";
            public const string AnsiCStackPath = "ansic";
            public const string DotNetStackPath = "stack";
            public const string UseAllowSubtypes = "useAllowSubtypes";
            public const string StartId = "id";
            public const string Exclusions = "exclude";
            public const string InputPath = "i";
            public const string FilePattern = "pattern";
            public const string LicenseType = "license";
            public const string Silent = "silent";
            public const string Annex1Path = "annex1";
            public const string Annex2Path = "annex2";
            public const string UnitsOutputPath = "output";
            public const string ModelVersion = "mv";
            public const string ModelPublicationDate = "pd";
            public const string ReleaseCandidate = "rc";
            public const string ModelUris = "uri";
            public const string OutputPrefix = "prefix";
            public const string SuppressOutput = "suppress";
        }

        private static Command CreateListInconsistenciesCommand()
        {
            var command = new Command("inconsistencies", "Takes an OPC UA NodeSet File and identifies if Type Nodes lack Category Tags.");
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
                Description = "The URI of the model to generate."
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
                WriteLine($"{nodesets.Count} NodeSets found.", ConsoleColor.Cyan);
                WriteLine($"Writing output to {outputPath}", ConsoleColor.Cyan);

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

                    WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.", ConsoleColor.DarkYellow);

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

                    Linter l = null;               
                    try
                    {
                        l = PrepareLinter(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateMissingCategories(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateInstancesOutOfTypes(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateMissingDescriptions(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateEventNotifier(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateAccessLevel(outputPath, nodeset, l).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) linting failed: {e.Message}");
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
        

        private static Command CreateOverThresholdCommand()
        {
            var command = new Command("overThreshold", "Takes an OPC UA NodeSet File and identifies Nodes that exceed model thresholds.");
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
                Description = "The URI of the model to generate."
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
                WriteLine($"{nodesets.Count} NodeSets found.", ConsoleColor.Cyan);
                WriteLine($"Writing output to {outputPath}", ConsoleColor.Cyan);

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

                    WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.", ConsoleColor.DarkYellow);

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

                    Linter l = null;               
                    try
                    {
                        l = PrepareLinter(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateOverThreshold(outputPath, nodeset, l).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) linting failed: {e.Message}");
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

        private static Command CreateLintAllTargetsCommand()
        {
            var command = new Command("all", "Takes an OPC UA NodeSet File and provides all available linting information.");
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
                Description = "The URI of the model to generate."
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
                WriteLine($"{nodesets.Count} NodeSets found.", ConsoleColor.Cyan);
                WriteLine($"Writing output to {outputPath}", ConsoleColor.Cyan);

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

                    WriteLine($"NodeSet ({nodeset.ModelUri}) dependencies found.", ConsoleColor.DarkYellow);

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

                    Linter l = null;               
                    try
                    {
                        l = PrepareLinter(nodeset, dependencies);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) preparation failed: {e.Message}");
                        Environment.Exit(1);
                    }

                    try
                    {
                        await GenerateOverThreshold(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateMissingCategories(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateInstancesOutOfTypes(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateMissingDescriptions(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateEventNotifier(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateAccessLevel(outputPath, nodeset, l).ConfigureAwait(false);
                        await GenerateNamingRules(outputPath, nodeset, l).ConfigureAwait(false);
                    }
                    catch (Exception e)
                    {
                        System.Console.Error.WriteLine($"NodeSet ({nodeset.ModelUri}) linting failed: {e.Message}");
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
