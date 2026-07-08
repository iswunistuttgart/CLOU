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

using System;
using Clou;
using Opc.Ua;
using System.Linq;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Clou
{
    public class Threshold
    {
        public int error;
        public int warning;
        public int info;
    }
    
    public class Thresholds
    {
        public required Threshold rDit;
        public required Threshold aggregates; 
    }
}
namespace ModelCompiler
{
        
    public class Linter
    {
        public Linter(IFileSystem fileSystem, ITelemetryContext telemetry)
        {
            m_telemetry = telemetry;
            m_fileSystem = fileSystem ?? throw new ArgumentNullException(nameof(fileSystem));

        }

        private ModelCompilerValidator m_validator;
        private ModelDesign m_model;
        private readonly IFileSystem m_fileSystem;
        private ITelemetryContext m_telemetry;

    
        private List<NodeDesign> rtNodes = new List<NodeDesign>();
        private List<NodeDesign> otNodes = new List<NodeDesign>();
        private List<NodeDesign> vtNodes = new List<NodeDesign>();
        private List<NodeDesign> dtNodes = new List<NodeDesign>();
        private List<NodeDesign> oNodes = new List<NodeDesign>();
        private List<NodeDesign> vNodes = new List<NodeDesign>();
        private List<NodeDesign> viNodes = new List<NodeDesign>();
        private List<NodeDesign> mNodes = new List<NodeDesign>();
        private List<NodeDesign> oDeclarations = new List<NodeDesign>();
        private List<NodeDesign> vDeclarations = new List<NodeDesign>();
        private List<NodeDesign> mDeclarations = new List<NodeDesign>();

        public event Func<LogMessageEventArgs, Task> LogMessage;

    public virtual void ReportNodesOverThreshold(string filePath, Thresholds t)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".OverThresh.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("Reason,NodeId,BrowseName,Value,Threshold,Level");

                // rDIT
                Dictionary<TypeDesign, int> Parents = new Dictionary<TypeDesign, int>();
                foreach (ReferenceTypeDesign node in rtNodes)
                {
                    int tdit = 0;
                    int rdit = 0;

                    ReferenceTypeDesign bType = node.BaseTypeNode as ReferenceTypeDesign;
                    if (Parents.ContainsKey(bType))
                    {
                        Parents[bType] += 1;
                    }
                    else
                    {
                        Parents[bType] = 1;
                    }
                    while (bType != null)
                    {
                        tdit += 1;                        
                        if (bType.SymbolicId.Namespace == m_model.TargetNamespace) { rdit += 1; }
                        bType = bType.BaseTypeNode as ReferenceTypeDesign;
                    }

                    
                    if( rdit >= t.rDit.error)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Major", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.error); }                            
                    else if (rdit >= t.rDit.warning)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Minor", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.warning); }
                    else if (rdit >= t.rDit.info)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Info", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.info); }
                }
                foreach (ObjectTypeDesign node in otNodes)
                {
                    int tdit = 0;
                    int rdit = 0;

                    ObjectTypeDesign bType = node.BaseTypeNode as ObjectTypeDesign;
                    if (Parents.ContainsKey(bType))
                    {
                        Parents[bType] += 1;
                    }
                    else
                    {
                        Parents[bType] = 1;
                    }
                    while (bType != null)
                    {
                        tdit += 1;                        
                        if (bType.SymbolicId.Namespace == m_model.TargetNamespace) { rdit += 1; }
                        bType = bType.BaseTypeNode as ObjectTypeDesign;
                    }

                    
                    if( rdit >= t.rDit.error)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Major", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.error); }                            
                    else if (rdit >= t.rDit.warning)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Minor", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.warning); }
                    else if (rdit >= t.rDit.info)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Info", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.info); }
                }
                foreach (VariableTypeDesign node in vtNodes)
                {
                    int tdit = 0;
                    int rdit = 0;

                    VariableTypeDesign bType = node.BaseTypeNode as VariableTypeDesign;
                    if (Parents.ContainsKey(bType))
                    {
                        Parents[bType] += 1;
                    }
                    else
                    {
                        Parents[bType] = 1;
                    }
                    while (bType != null)
                    {
                        tdit += 1;                        
                        if (bType.SymbolicId.Namespace == m_model.TargetNamespace) { rdit += 1; }
                        bType = bType.BaseTypeNode as VariableTypeDesign;
                    }

                    
                    if( rdit >= t.rDit.error)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Major", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.error); }                            
                    else if (rdit >= t.rDit.warning)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Minor", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.warning); }
                    else if (rdit >= t.rDit.info)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Info", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.info); }
                }
                foreach (DataTypeDesign node in dtNodes)
                {
                    int tdit = 0;
                    int rdit = 0;

                    DataTypeDesign bType = node.BaseTypeNode as DataTypeDesign;
                    if (Parents.ContainsKey(bType))
                    {
                        Parents[bType] += 1;
                    }
                    else
                    {
                        Parents[bType] = 1;
                    }
                    while (bType != null)
                    {
                        tdit += 1;                        
                        if (bType.SymbolicId.Namespace == m_model.TargetNamespace) { rdit += 1; }
                        bType = bType.BaseTypeNode as DataTypeDesign;
                    }

                    
                    if( rdit >= t.rDit.error)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Major", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.error); }                            
                    else if (rdit >= t.rDit.warning)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Minor", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.warning); }
                    else if (rdit >= t.rDit.info)
                        { writer.WriteLine("rDit,{0},{1},{2},{3},Info", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, rdit, t.rDit.info); }
                }
                // aggregates
                foreach(NodeDesign node in m_model.Items)
                {
                    this.AggregatesOverThreshold(node, t, writer);
                }
            }
        }
    
    private void AggregatesOverThreshold(NodeDesign node, Thresholds t, StreamWriter writer)
        {
            
            if (node.Children == null)
            {
                return;
            }
            else
            {
                int numAgg = node.Children.Items.Length;
                if (numAgg >= t.aggregates.error)
                {
                    writer.WriteLine("aggregates,{0},{1},{2},{3},Major", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, numAgg, t.aggregates.error); 
                }
                else if (numAgg >= t.aggregates.warning)
                {
                    writer.WriteLine("aggregates,{0},{1},{2},{3},Minor", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, numAgg, t.aggregates.warning); 
                }
                else if (numAgg >= t.aggregates.info)
                {
                    writer.WriteLine("aggregates,{0},{1},{2},{3},Info", node.NumericIdSpecified ? node.NumericId : node.StringId, node.BrowseName, numAgg, t.aggregates.info); 
                }
                foreach (NodeDesign child in node.Children.Items)
                {
                    this.AggregatesOverThreshold(child,t,writer);
                }
            }
        }



        public virtual void ListMissingCategories(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".MissingCategories.csv");
            List<NodeDesign> categories = new List <NodeDesign>();
            bool categoriesExist = false;
            foreach (NodeDesign node in m_model.Items)
            {
                if (node.State.Categories != null)
                {
                    categoriesExist = true;
                }
                else
                {
                    if((new [] {NodeClass.ReferenceType, NodeClass.ObjectType, NodeClass.VariableType, NodeClass.DataType}).Contains(node.State.NodeClass))
                    {categories.Add(node);}
                }
            }
            if (categoriesExist){
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName,NodeId");
                foreach (var category in categories)
                {
                    writer.WriteLine("{0},{1}", category.BrowseName, category.NumericIdSpecified ? category.NumericId : category.StringId);
                }
            }
            }
        }

        public virtual void ListInstancesOutOfTypes(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".InstancesOutOfTypes.csv");
            Dictionary<NodeDesign, int> roots = new Dictionary<NodeDesign, int>();
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("NodeId,BrowseName,SizeOfSubtree");

                foreach (InstanceDesign node in oNodes.Concat(vNodes.Concat(mNodes)))
                {

                    NodeDesign parent = node;
                    if (node.Parent != null)
                    {
                        parent = node.Parent;
                        while (parent.Parent != null)
                        {
                            parent = parent.Parent;
                        }
                    }
                    if (!node.DesignToolOnly && (parent.State.NodeClass == NodeClass.Object || parent.State.NodeClass == NodeClass.Method || parent.State.NodeClass == NodeClass.Variable || parent.State.NodeClass == NodeClass.View))
                    {
                        bool refs = false;
                        if (parent.References != null)
                        {
                            refs = parent.References.Length == 0;
                        }
                        if(parent.References == null || refs){
                            bool idsMatch;
                            if (node.NumericIdSpecified)
                            {
                                idsMatch = node.NumericId == parent.NumericId;
                            }
                            else
                            {
                                idsMatch = node.StringId == parent.StringId;
                            }
                            if (idsMatch)
                            {
                                // root of hierarchy
                                if (!roots.ContainsKey(parent))
                                {
                                    roots[parent] = 0;
                                }
                            }
                            else
                            {
                                // part of hierarchy
                                if (roots.ContainsKey(parent))
                                {
                                    roots[parent] += 1;
                                }
                                else
                                {
                                    roots[parent] = 1;
                                }
                            }
                        }
                        

                    }

                }
                foreach (var root in roots)
                {
                    writer.WriteLine("{0},{1},{2}",root.Key.NumericIdSpecified ? root.Key.NumericId : root.Key.StringId,root.Key.BrowseName,root.Value);
                }
            }
        }

        public virtual void ListMissingDescriptions(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".MissingDescriptions.csv");
            List<NodeDesign> descriptions = new List<NodeDesign>();
            bool descriptionsExist = false;

            foreach (NodeDesign node in rtNodes.Concat(otNodes.Concat(vtNodes.Concat(dtNodes.Concat(oNodes.Concat(vNodes.Concat(mNodes.Concat(viNodes.Concat(oDeclarations.Concat(vDeclarations.Concat(mDeclarations)))))))))))
            {
                if (node.Description != null)
                {
                    descriptionsExist = true;
                }
                else
                {
                    descriptions.Add(node);
                }
            }
            if (descriptionsExist)
            {
                using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
                {
                    writer.WriteLine("BrowseName, NodeId");
                    foreach (NodeDesign node in descriptions)
                    {
                        writer.WriteLine("{0},{1}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId);
                    }
                }
            }
        }

        public virtual void ListEventNotifier(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".EventNotifier.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName, NodeId");
                foreach (ObjectDesign node in oDeclarations)
                {
                    if (node.SupportsEventsSpecified)
                    { 
                        if (node.SupportsEvents == true)
                        {
                            writer.WriteLine("{0},{1},", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId);
                        }
                    }
                }
            }
        }

        public virtual void ListAccessLevel(string filePath)
        {
            // 1 is default - list everything that deviates as this should be intentional
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".AccessLevel.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName, NodeId, AccessLevel");
                foreach (VariableDesign node in vDeclarations)
                {
                    if (node.AccessLevel != AccessLevel.Read)
                    {
                        writer.WriteLine("{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.AccessLevel);
                    }
                }
            }
        }

        public virtual void ListNamingRules(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".NamingRules.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("Message,BrowseName,NodeId");
                if (Regex.IsMatch(m_model.TargetNamespace,"%[0-9A-Fa-f]{2}"))
                {
                    writer.WriteLine("NamespaceUri should avoid %-escaped characters,NamespaceUri,NamespaceUri");
                }
                if (!Uri.TryCreate(m_model.TargetNamespace,UriKind.Absolute,out _))
                {
                    writer.WriteLine("NamespaceUri should be a valid absolute URI,NamespaceUri,NamespaceUri");
                }
                foreach (NodeDesign node in rtNodes.Concat(otNodes.Concat(vtNodes.Concat(dtNodes.Concat(oNodes.Concat(vNodes.Concat(mNodes.Concat(viNodes.Concat(oDeclarations.Concat(vDeclarations.Concat(mDeclarations)))))))))))
                {
                    var nodeId = node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId;
                    var browseName = node.BrowseName;
                    var symbolicName = node.SymbolicName.Name;
                    if (string.IsNullOrWhiteSpace(browseName))
                    {
                        writer.WriteLine("Missing BrowseName,{0},{1}",browseName,nodeId);
                    }
                    if (!IsNamingRuleException(browseName, m_model.TargetNamespace) && !IsPascalCaseLike(browseName))
                    {
                        writer.WriteLine("BrowseName should be PascalCase,{0},{1}",browseName,nodeId);
                    }
                    if (!IsNamingRuleException(browseName, m_model.TargetNamespace) && !ContainsOnlyRecommendedBrowseNameCharacters(browseName))
                    {
                        writer.WriteLine("BrowseName should use only letters digits or '_' (placeholders also use '<' and '>'),{0},{1}",browseName,nodeId);
                    }
                    if (browseName.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '_')) && string.IsNullOrWhiteSpace(symbolicName))
                    {
                        writer.WriteLine("Node uses special characters in BrowseName and should define SymbolicName in the UANodeSet,{0},{1}",browseName,nodeId);
                    }
                }
                foreach (NodeDesign node in otNodes.Concat(vtNodes)){
                    var nodeId = node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId;
                    var browseName = node.BrowseName;
                    if (!browseName.EndsWith("Type"))
                    {
                        writer.WriteLine("ObjectType and VariableType BrowseName should end with 'Type',{0},{1}",browseName,nodeId);
                    }
                }

                foreach (DataTypeDesign node in dtNodes)
                {
                    
                    if (node.IsStructure)
                    {
                        if (!node.BrowseName.EndsWith("DataType"))
                        {                 
                            writer.WriteLine("Structured DataType BrowseName should end with 'DataType',{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId);
                        }
                        if (node.HasFields)
                        {
                            foreach (var field in node.Fields)
                            {
                                if (!IsPascalCaseLike(field.Name))
                                {
                                    writer.WriteLine("Structure field Name should be PascalCase but is {2},{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId,field.Name);
                                }
                            }
                        }
                        
                    }
                    else if (node.IsEnumeration)
                    {
                        if(node.BrowseName.EndsWith("Type") || node.BrowseName.EndsWith("Enumeration"))
                        {                       
                            writer.WriteLine("Enumeration DataType should have no suffix. If a suffix is used it should be 'Enum',{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId);
                        }
                        if (node.HasFields)
                        {
                            foreach (var field in node.Fields)
                            {
                                if (!IsPascalCaseLike(field.Name))
                                {
                                    writer.WriteLine("Enum value name should be PascalCase but is {2},{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId,field.Name);
                                }
                            }
                        }
                    }
                }
                foreach (ReferenceTypeDesign node in rtNodes)
                {
                    if (node.BrowseName.EndsWith("Type"))
                    {
                        writer.WriteLine("ReferenceType BrowseName should not have a suffix like 'Type',{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId);
                    }
                    string? inverseName = node.InverseName?.Value;
                    if (!string.IsNullOrWhiteSpace(inverseName) &&!IsPascalCaseLike(inverseName))
                    {
                        writer.WriteLine("ReferenceType InverseName should be PascalCase but is {2},{0},{1}",node.BrowseName,node.NumericIdSpecified ? node.NumericId : node.StringId,inverseName);
                    }
                }

                foreach (MethodDesign node in mNodes.Concat(mDeclarations))
                {
                    if (node.HasArguments)
                    {
                        if (node.InputArguments != null)
                        {
                            foreach (var arg in node.InputArguments)
                            {
                                if (!IsPascalCaseLike(arg.Name))
                                {
                                    writer.WriteLine("Method argument name should be PascalCase but is {2},{0},{1}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, arg.Name);
                                }
                            }
                        }
                        if (node.OutputArguments != null)
                        {
                            foreach (var arg in node.OutputArguments)
                            {
                                if (!IsPascalCaseLike(arg.Name))
                                {
                                    writer.WriteLine("Method argument name should be PascalCase but is {2},{0},{1}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, arg.Name);
                                }
                            }
                        }
                    }
                }
            }
            
        }

        static bool IsNamingRuleException(string value, string namespaceUri)
        {
            return (
                value.Equals(namespaceUri) ||
                value.Equals("Default Binary") ||
                value.Equals("Default XML") ||
                value.Equals("Default JSON") 
            );
        }

        static bool ContainsOnlyRecommendedBrowseNameCharacters(string value)
        {
            foreach (var ch in value)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '<' || ch == '>')
                    continue;

                return false;
            }

            return true;
        }

        static bool IsPascalCaseLike(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            var parts = value.Split('_', StringSplitOptions.RemoveEmptyEntries);

            foreach (var rawPart in parts)
            {
                var part = rawPart.Trim();

                if (part.StartsWith("<", StringComparison.Ordinal) &&
                    part.EndsWith(">", StringComparison.Ordinal) &&
                    part.Length > 2)
                {
                    var inner = part[1..^1];
                    if (!char.IsLetter(inner[0]) || !char.IsUpper(inner[0]))
                        return false;

                    if (!inner.All(char.IsLetterOrDigit))
                        return false;

                    continue;
                }

                if (!char.IsLetter(part[0]) || !char.IsUpper(part[0]))
                    return false;

                if (!part.All(char.IsLetterOrDigit))
                    return false;
            }

            return true;
        }



        public virtual void ValidateAndUpdateIds(
            IList<string> designFilePaths,
            string identifierFilePath,
            uint startId,
            string specificationVersion,
            bool useAllowSubtypes,
            IList<string> exclusions,
            string modelVersion,
            string modelPublicationDate,
            bool releaseCandidate)
        {
            m_validator = new ModelCompilerValidator(startId, exclusions, m_fileSystem, m_telemetry);
            m_validator.LogMessage += this.LogMessage;

            if (!String.IsNullOrEmpty(specificationVersion))
            {
                m_validator.EmbeddedModelDesignPath = $"{m_validator.EmbeddedModelDesignPath}.{specificationVersion}";

                if (specificationVersion == "v103")
                {
                    m_validator.EmbeddedCsvPath = m_validator.EmbeddedModelDesignPath;
                }
            }
            else
            {
                m_validator.EmbeddedModelDesignPath = $"{m_validator.EmbeddedModelDesignPath}.v104";
            }

            m_validator.UseAllowSubtypes = useAllowSubtypes;
            m_validator.ReleaseCandidate = releaseCandidate;
            m_validator.ModelVersion = modelVersion;
            m_validator.ModelPublicationDate = modelPublicationDate;
            m_validator.Validate(designFilePaths, identifierFilePath, false);
            m_model = m_validator.Dictionary;

            fillLists();

        }


        private void fillLists()
        {
            foreach (NodeDesign node in m_model.Items)
            {
                if (node != null)
                {
                    switch (node.State.NodeClass)
                    {
                        case NodeClass.ReferenceType:
                            rtNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateTypeListsWithIDs(oNodes, vNodes, mNodes, oDeclarations, vDeclarations, mDeclarations, node);
                            }
                            break;
                        case NodeClass.ObjectType:
                            otNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateTypeListsWithIDs(oNodes, vNodes, mNodes, oDeclarations, vDeclarations, mDeclarations, node);
                            }
                            break;
                        case NodeClass.VariableType:
                            vtNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateTypeListsWithIDs(oNodes, vNodes, mNodes, oDeclarations, vDeclarations, mDeclarations, node);
                            }
                            break;
                        case NodeClass.DataType:
                            dtNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateTypeListsWithIDs(oNodes, vNodes, mNodes, oDeclarations, vDeclarations, mDeclarations, node);
                            }
                            break;
                        case NodeClass.Object:
                            oNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateListsWithIDs(oNodes, vNodes, mNodes, node);
                            }
                            ;
                            break;
                        case NodeClass.Variable:
                            vNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateListsWithIDs(oNodes, vNodes, mNodes, node);
                            }
                            ;
                            break;
                        case NodeClass.View:
                            viNodes.Add(node);
                            if (node.HasChildren)
                            {
                                UpdateListsWithIDs(oNodes, vNodes, mNodes, node);
                            }
                            ;
                            break;
                        case NodeClass.Method:
                            if (node.SymbolicName.Name.EndsWith("MethodType"))
                            { continue; }
                            else
                            {
                                mNodes.Add(node);
                                if (node.HasChildren)
                                {
                                    UpdateListsWithIDs(oNodes, vNodes, mNodes, node);
                                }
                            }
                            ;
                            break;
                        default:
                            Console.WriteLine("different NodeClass!");
                            break;
                    }
                }
            }

        }

                public static void UpdateListsWithIDs(List<NodeDesign> objects, List<NodeDesign> variables, List<NodeDesign> methods, NodeDesign node)
        {
            ListOfChildren children = node.Children;
            foreach (var child in children.Items)
            {
                if (child.GetType() == typeof(ObjectDesign))
                {
                    objects.Add(child);
                }
                if (child.GetType() == typeof(VariableDesign))
                {
                    variables.Add(child);
                }
                if (child.GetType() == typeof(MethodDesign))
                {
                    if (child.SymbolicName.Name.EndsWith("MethodType"))
                    { continue; }
                    else
                    {
                        methods.Add(child);
                    }
                }
                if (child.GetType() != typeof(ObjectDesign) && child.GetType() != typeof(VariableDesign) && child.GetType() != typeof(MethodDesign))
                {
                    Console.WriteLine("Node {0} not counted", node.State.NodeId);
                }
                if (child.HasChildren)
                {
                    UpdateListsWithIDs(objects, variables, methods, child);
                }
            }
        }


        public static void UpdateTypeListsWithIDs(List<NodeDesign> objects, List<NodeDesign> variables, List<NodeDesign> methods, List<NodeDesign> objectIds, List<NodeDesign> variableIds, List<NodeDesign> methodIds, NodeDesign node)
        {
            ListOfChildren children = node.Children;
            foreach (var child in children.Items)
            {
                if (child.GetType() == typeof(ObjectDesign))
                {
                    if (child.ModellingRuleSpecified == true)
                    {
                        objectIds.Add(child);
                    }
                    else
                    {
                        objects.Add(child);
                    }
                }
                if (child.GetType() == typeof(VariableDesign))
                {
                    if (child.ModellingRuleSpecified == true)
                    {
                        variableIds.Add(child);
                    }
                    else
                    {
                        variables.Add(child);
                    }
                }
                if (child.GetType() == typeof(MethodDesign))
                {
                    if (child.SymbolicName.Name.EndsWith("MethodType"))
                    { continue; }
                    else
                    {
                        if (child.ModellingRuleSpecified == true)
                        {
                            methodIds.Add(child);
                        }
                        else
                        {
                            methods.Add(child);
                        }
                    }
                }
                if (child.GetType() != typeof(ObjectDesign) && child.GetType() != typeof(VariableDesign) && child.GetType() != typeof(MethodDesign))
                {
                    Console.WriteLine("Node {0} not counted", node.State.NodeId);
                }
                if (child.HasChildren)
                {
                    UpdateTypeListsWithIDs(objects, variables, methods, objectIds, variableIds, methodIds, child);
                }
            }
        }


    }
}
