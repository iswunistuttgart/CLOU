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
using System.Collections.Generic;
using System.ComponentModel.Design.Serialization;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using CodeGenerator;
using CsvHelper;
using Opc.Ua;

namespace ModelCompiler
{
    public class Metrics
    {
        #region Constructors
        public Metrics(IFileSystem fileSystem, ITelemetryContext telemetry)
        {
            m_telemetry = telemetry;
            m_fileSystem = fileSystem ?? throw new ArgumentNullException(nameof(fileSystem));
        }
        #endregion

        #region Private Fields
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
        #endregion

        public event Func<LogMessageEventArgs, Task> LogMessage;

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

        public virtual void ListInstancesOutOfTypes(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".InstOutOfTypes.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("NodeId,NodeClass,BrowseName,NSRoot");

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
                    if (parent.State.NodeClass == NodeClass.Object || parent.State.NodeClass == NodeClass.Method || parent.State.NodeClass == NodeClass.Variable || parent.State.NodeClass == NodeClass.View)
                    {
                        string nodeClass = "";
                        MethodDesign mtest = node as MethodDesign; 
                        if (mtest != null) 
                        { 
                            nodeClass = "Method";
                        }
                        VariableDesign vtest = node as VariableDesign;
                        if (vtest != null)
                        {
                            nodeClass = "Variable";
                        }
                        ObjectDesign otest = node as ObjectDesign;
                        if (otest != null)
                        {
                            nodeClass = "Object";
                        }

                        writer.WriteLine("{0},{1},{2},{3}",node.NumericIdSpecified ? node.NumericId : node.StringId ,nodeClass,node.BrowseName,parent.NumericId);
                    }

                }
            }

        }
        public virtual void ListAttributes(string filePath)
        {
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".Attributes.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("NodeId,Attribute,Value,Value (Secondary)");
                foreach (NodeDesign node in rtNodes.Concat(otNodes.Concat(vtNodes.Concat(dtNodes.Concat(oNodes.Concat(vNodes.Concat(mNodes.Concat(viNodes.Concat(oDeclarations.Concat(vDeclarations.Concat(mDeclarations)))))))))))
                {
                    if (node.AccessRestrictionsSpecified)
                    {
                        writer.WriteLine("{0},AccessRestrictions,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.AccessRestrictions);
                    }
                    if (node.RolePermissions != null)
                    {
                        writer.WriteLine("{0},RolePermissions,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.RolePermissions.ToString());
                    }
                    if (node.WriteAccess != 0)
                    {
                        writer.WriteLine("{0},WriteAccess,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.WriteAccess);
                    }
                    if (node.Description != null)
                    {
                        writer.WriteLine("{0},Description,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.Description);
                    }
                }
                List<NodeDesign> variables = vNodes;
                variables.AddRange(vDeclarations);
                bool diff = false;
                Regex sWhitespace = new Regex(@"\s+");
                for (int i = 0; i < variables.Count()-1; i++ )
                {
                    VariableDesign onode = variables[i] as VariableDesign;
                    VariableDesign node = variables[i+1] as VariableDesign;
                    
                    if (!diff && (node.AccessLevel != onode.AccessLevel))
                    {
                        diff = true;

                        i = -1; continue;
                    }
                    if (diff)
                    {
                        if (i == 0)
                        {
                            writer.WriteLine("{0},AccessLevel,{1},{2}", onode.NumericIdSpecified ? onode.NumericId : onode.StringId, onode.AccessLevel, onode.InstanceAccessLevel);
                        }
                        writer.WriteLine("{0},AccessLevel,{1},{2}", node.NumericIdSpecified ? node.NumericId : node.StringId, node.AccessLevel, node.InstanceAccessLevel);
                    }
                }
                foreach (VariableDesign node in variables)
                {
                    if (node.DecodedValue != null)
                    {

                        writer.WriteLine("{0},Value,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, sWhitespace.Replace(node.DecodedValue.ToString(), " "));
                    }
                    if (node.MinimumSamplingInterval != 0)
                    {
                        writer.WriteLine("{0},MinimumSamplingInterval,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.MinimumSamplingInterval);
                    }
                }
                foreach (VariableTypeDesign node in vtNodes)
                {
                    if (node.DecodedValue != null)
                    {
                        writer.WriteLine("{0},Value,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.DecodedValue);
                    }
                }
                foreach (ObjectDesign node in oNodes.Concat(oDeclarations))
                {
                    if (node.SupportsEventsSpecified)
                    { 
                        writer.WriteLine("{0},EventNotifier,{1},", node.NumericIdSpecified ? node.NumericId : node.StringId, node.SupportsEvents);
                    }
                }
             }
        }

        public virtual void ListCategories(string filePath)
        {
            // jede Category: welchem Type zugeordnet?
            // f. Auswertung: wie viele Spec haben Categories? wie viele versch. Categories gibt es je Spec? Innerhalb einer Spec: Wie vielen Types ist die Category zugeordnet? Je Type: wie viele Categories sind zugeordnet?
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".Categories.csv");
            Dictionary<string, List<NodeDesign>> categories = new Dictionary<string, List <NodeDesign>>();
            foreach (NodeDesign node in m_model.Items)
            {
                if (node.State.Categories != null)
                {
                    foreach (string category in node.State.Categories)
                    {
                        if (!categories.ContainsKey(category))
                        {
                            categories.Add(category, new List<NodeDesign>());
                        }
                        categories[category].Add(node);
                    }
                    continue;
                }
            }
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("Category,BrowseNames,NodeIds");
                foreach (var category in categories)
                {
                    int n = category.Value.Count();
                    string[] browseNames = new string[n];
                    uint[] nodeIds = new uint[n];
                    for (int i = 0; i<n; i++) 
                    {
                        NodeDesign node = category.Value[i];
                        browseNames[i]= node.BrowseName;
                        nodeIds[i] =node.NumericId; // what if String NodeId?
                    }
                    writer.WriteLine("{0},[{1}],[{2}]", category.Key, string.Join(" ", browseNames), string.Join(" ", nodeIds));
                }
            }
        }

        private void CountReferenceUses(Dictionary<String, int[]> types, NodeDesign node, Dictionary<String, bool> hierarchical)
        {
            if (node.HasChildren)
            {
                foreach (InstanceDesign child in node.Children.Items)
                {
                    if (child.ReferenceType.Namespace == m_model.TargetNamespace)
                    {
                        types[child.ReferenceType.Name][0] += 1;
                        if (hierarchical[child.ReferenceType.Name] && child.ModellingRuleSpecified)
                        {
                            types[child.ReferenceType.Name][1] += 1;
                        }
                        else
                        {
                            types[child.ReferenceType.Name][2] += 1;
                        }
                        
                    }
                }
            }
            if (node.HasReferences)
            {
                foreach (Reference reference in node.References)
                {
                    if (reference.ReferenceType.Namespace == m_model.TargetNamespace && !reference.IsInverse)
                    {
                        types[reference.ReferenceType.Name][0] += 1;
                        InstanceDesign inode = node as InstanceDesign;
                        if (hierarchical[reference.ReferenceType.Name] && inode.ModellingRuleSpecified)
                        {
                            types[reference.ReferenceType.Name][1] += 1;
                        }
                        else
                        {
                            types[reference.ReferenceType.Name][2] += 1;
                        }
                    }
                }
            }

        }

        public virtual void CountInstances(string filePath)
        {
            Dictionary<String, int[]> types = new Dictionary<String, int[]>();
            Dictionary<String, bool> isHierarchical = new Dictionary<String, bool>();
            foreach (TypeDesign node in rtNodes)
            {
                types[node.BrowseName] = [0, 0, 0];
                isHierarchical[node.BrowseName] = false;
                TypeDesign super = node.BaseTypeNode;
                while (super != null)
                {
                    if (super.BrowseName == "HierarchicalReferences")
                    {
                        isHierarchical[node.BrowseName] = true;
                    }
                    super = super.BaseTypeNode;
                }
                CountReferenceUses(types, node, isHierarchical);
            }
            foreach (NodeDesign node in otNodes.Concat(vtNodes.Concat(dtNodes)))
            {
                types[node.BrowseName] = [0,0,0];
                CountReferenceUses(types, node, isHierarchical);
            }
            
            foreach (ObjectDesign node in oNodes)
            {
                if (node.TypeDefinition.Namespace == m_model.TargetNamespace)
                {
                    types[node.TypeDefinition.Name][0] += 1;
                    types[node.TypeDefinition.Name][2] += 1;
                }
                CountReferenceUses(types, node, isHierarchical);
                
            }
            foreach (ObjectDesign node in oDeclarations)
            {
                if (node.TypeDefinition.Namespace == m_model.TargetNamespace)
                {
                    types[node.TypeDefinition.Name][0] += 1;
                    types[node.TypeDefinition.Name][1] += 1;
                }
                CountReferenceUses(types, node, isHierarchical);
            }
            foreach (VariableDesign node in vNodes)
            {
                if (node.TypeDefinition.Namespace == m_model.TargetNamespace)
                {
                    types[node.TypeDefinition.Name][0] += 1;
                    types[node.TypeDefinition.Name][2] += 1;
                }
                if (node.DataType.Namespace == m_model.TargetNamespace)
                {
                    types[node.DataTypeNode.BrowseName][0] += 1;
                    types[node.DataTypeNode.BrowseName][2] += 1;
                }
                CountReferenceUses(types, node, isHierarchical);
            }
            foreach (VariableDesign node in vDeclarations)
            {
                if (node.TypeDefinition.Namespace == m_model.TargetNamespace)
                {
                    types[node.TypeDefinition.Name][0] += 1;
                    types[node.TypeDefinition.Name][1] += 1;
                }
                if (node.DataType.Namespace == m_model.TargetNamespace)
                {
                    types[node.DataTypeNode.BrowseName][0] += 1;
                    types[node.DataTypeNode.BrowseName][1] += 1;
                }
                CountReferenceUses(types, node, isHierarchical);
            }
            foreach (VariableTypeDesign node in vtNodes)
            {
                if (node.DataType.Namespace == m_model.TargetNamespace)
                {
                    types[node.DataTypeNode.BrowseName][0] += 1;
                    types[node.DataTypeNode.BrowseName][1] += 1;
                }
                CountReferenceUses(types, node, isHierarchical);
            }
            using (StreamWriter writer = new StreamWriter(File.Open(Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".Instances.csv"), FileMode.Create)))
            {
                // Prototypes + Final = Total Instance Occurrences
                // Prototypes: InstanceDeclaration for ObjectType/VariableType; VariableType/InstanceDeclaration for DataType, hierarch. ReferenceType u. TargetNode has ModellingRule
                // Final: Instances under Objects or w/o ModellingRule for ObjectType/VariableType/DataType, nonHierarchical ReferenceType or TargetNode has no MR
                writer.WriteLine("Type BrowseName,Total Instance Occurrences,Prototypes, Final");
                foreach (String elem in types.Keys)
                {
                    writer.WriteLine("{0},{1},{2},{3}", elem, types[elem][0], types[elem][1], types[elem][2]);
                }
            }
        }

        private void IdentifyIncludedReferenceUses(StreamWriter w, NodeDesign node)
        {
            if (node.HasChildren)
            {
                foreach (InstanceDesign child in node.Children.Items)
                {
                    if (child.ReferenceType.Namespace != m_model.TargetNamespace && child.ReferenceType.Namespace != "http://opcfoundation.org/UA/")
                    {
                        w.WriteLine("Reference,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, child.ReferenceType.Namespace);

                    }
                }
            }
            if (node.HasReferences)
            {
                foreach (Reference reference in node.References)
                {
                    if (reference.ReferenceType.Namespace != m_model.TargetNamespace && reference.ReferenceType.Namespace != "http://opcfoundation.org/UA/" && !reference.IsInverse)
                    {
                        w.WriteLine("Reference,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, reference.ReferenceType.Namespace);
                    }
                }
            }

        }

        public virtual void IdentifyIncludedNodes(string filePath)
        {
            var includeOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".Includes.csv");
            //TODO: Sonderfall: References
            Dictionary<XmlQualifiedName, string> typeids = new Dictionary<XmlQualifiedName, string>();
            using (StreamWriter writer = new StreamWriter(File.Open(includeOutputFile, FileMode.Create)))
            {
                writer.WriteLine("Kind of inclusion, BrowseName, NodeId, foreign Namespace");
                foreach (ReferenceTypeDesign node in rtNodes)
                {
                    ReferenceTypeDesign bType = node.BaseTypeNode as ReferenceTypeDesign;
                    while (bType != null)
                    {
                        if (bType.SymbolicId.Namespace != m_model.TargetNamespace && bType.SymbolicId.Namespace != "http://opcfoundation.org/UA/")
                        {
                            writer.WriteLine("Supertype,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, bType.SymbolicId.Namespace);
                            typeids[node.SymbolicId] = bType.SymbolicId.Namespace;
                            break;
                        }
                        bType = bType.BaseTypeNode as ReferenceTypeDesign;
                    }
                    IdentifyIncludedReferenceUses(writer, node);

                }

                foreach (ObjectTypeDesign node in otNodes)
                {
                    ObjectTypeDesign bType = node.BaseTypeNode as ObjectTypeDesign;
                    while (bType != null)
                    {
                        if (bType.SymbolicId.Namespace != m_model.TargetNamespace && bType.SymbolicId.Namespace != "http://opcfoundation.org/UA/")
                        {
                            writer.WriteLine("Supertype,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, bType.SymbolicId.Namespace);
                            typeids[node.SymbolicId] = bType.SymbolicId.Namespace;
                            break;
                        }
                        bType = bType.BaseTypeNode as ObjectTypeDesign;
                    }
                    IdentifyIncludedReferenceUses(writer, node);

                }

                foreach (VariableTypeDesign node in vtNodes)
                {
                    if (node.DataType.Namespace != m_model.TargetNamespace && node.DataType.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("DataType,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.DataType.Namespace);
                    }
                    VariableTypeDesign bType = node.BaseTypeNode as VariableTypeDesign;
                    while (bType != null)
                    {
                        if (bType.SymbolicId.Namespace != m_model.TargetNamespace && bType.SymbolicId.Namespace != "http://opcfoundation.org/UA/")
                        {
                            writer.WriteLine("Supertype,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, bType.SymbolicId.Namespace);
                            typeids[node.SymbolicId] = bType.SymbolicId.Namespace;
                            break;
                        }
                        bType = bType.BaseTypeNode as VariableTypeDesign;
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }

                // Datentypen innerhalb d. Struktur muss man auch prüfen
                foreach (DataTypeDesign node in dtNodes)
                {
                    DataTypeDesign bType = node.BaseTypeNode as DataTypeDesign;
                    while (bType != null)
                    {
                        if (bType.SymbolicId.Namespace != m_model.TargetNamespace && bType.SymbolicId.Namespace != "http://opcfoundation.org/UA/")
                        {
                            writer.WriteLine("Supertype,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, bType.SymbolicId.Namespace);
                            typeids[node.SymbolicId] = bType.SymbolicId.Namespace;
                            break;
                        }
                        bType = bType.BaseTypeNode as DataTypeDesign;

                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }

                foreach (ObjectDesign node in oNodes)
                {
                    if (node.TypeDefinition.Namespace != m_model.TargetNamespace && node.TypeDefinition.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.TypeDefinition.Namespace);
                    }
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    if (typeids.Keys.Contains(node.TypeDefinitionNode.SymbolicId))
                    {
                        writer.WriteLine("Derived TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, typeids[node.TypeDefinitionNode.SymbolicId]);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }
                foreach (VariableDesign node in vNodes)
                {
                    if (node.TypeDefinition.Namespace != m_model.TargetNamespace && node.TypeDefinition.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.TypeDefinition.Namespace);
                    }
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    if (node.DataType.Namespace != m_model.TargetNamespace && node.DataType.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("DataType,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.DataType.Namespace);
                    }
                    if (typeids.Keys.Contains(node.TypeDefinitionNode.SymbolicId))
                    {
                        writer.WriteLine("Derived TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, typeids[node.TypeDefinitionNode.SymbolicId]);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }
                foreach (ObjectDesign node in oDeclarations)
                {
                    if (node.TypeDefinition.Namespace != m_model.TargetNamespace && node.TypeDefinition.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.TypeDefinition.Namespace);
                    }
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    if (typeids.Keys.Contains(node.TypeDefinitionNode.SymbolicId))
                    {
                        writer.WriteLine("Derived TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, typeids[node.TypeDefinitionNode.SymbolicId]);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }
                foreach (VariableDesign node in vDeclarations)
                {
                    if (node.TypeDefinition.Namespace != m_model.TargetNamespace && node.TypeDefinition.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.TypeDefinition.Namespace);
                    }
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    if (node.DataType.Namespace != m_model.TargetNamespace && node.DataType.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("DataType,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.DataType.Namespace);
                    }
                    if (typeids.Keys.Contains(node.TypeDefinitionNode.SymbolicId))
                    {
                        writer.WriteLine("Derived TypeDefinition,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, typeids[node.TypeDefinitionNode.SymbolicId]);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }

                foreach (MethodDesign node in mNodes)
                {
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }

                foreach (MethodDesign node in mDeclarations)
                {
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }

                foreach (ViewDesign node in viNodes)
                {
                    if (node.SymbolicName.Namespace != m_model.TargetNamespace && node.SymbolicName.Namespace != "http://opcfoundation.org/UA/")
                    {
                        writer.WriteLine("BrowseName,{0},{1},{2}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, node.SymbolicName.Namespace);
                    }
                    IdentifyIncludedReferenceUses(writer, node);
                }
            }
        }

        public virtual void CalcInheritanceMetrics(string filePath)
        {
            // Depth of inheritance tree and Number of Children (Inheritance)
            var depthOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".DIT.csv");
            var nocOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".NOC.csv");
            Dictionary<TypeDesign, int> Parents = new Dictionary<TypeDesign, int>();
            using (StreamWriter writer = new StreamWriter(File.Open(depthOutputFile, FileMode.Create)))
            {
                writer.WriteLine("NodeClass,Name,NodeId,tDIT,rDIT");
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

                    writer.WriteLine("ReferenceType,{0},{1},{2},{3}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, tdit, rdit);
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

                    writer.WriteLine("ObjectType,{0},{1},{2},{3}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, tdit, rdit);
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

                    writer.WriteLine("VariableType,{0},{1},{2},{3}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, tdit, rdit);
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

                    writer.WriteLine("DataType,{0},{1},{2},{3}", node.BrowseName, node.NumericIdSpecified ? node.NumericId : node.StringId, tdit, rdit);
                }
            }
            using (StreamWriter writer = new StreamWriter(File.Open(nocOutputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName,Namespace,NodeId,NOC");
                foreach (TypeDesign node in Parents.Keys)
                {
                    writer.WriteLine("{0},{1},{2},{3}", node.BrowseName, node.SymbolicId.Namespace, node.NumericIdSpecified ? node.NumericId : node.StringId, Parents[node]);
                }
            }
        }

        public virtual void CalculateMetrics(string filePath)
        {
            //int all_nodes = CountNodes(filePath);


            // Number of Nodes
            var outputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".NodeCounts.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(outputFile, FileMode.Create)))
            {
                writer.WriteLine("NodeClass, Node Count");
                writer.WriteLine("ReferenceType,{0}", rtNodes.Count);
                writer.WriteLine("ObjectType,{0}", otNodes.Count);
                writer.WriteLine("VariableType,{0}", vtNodes.Count);
                writer.WriteLine("DataType,{0}", dtNodes.Count);
                writer.WriteLine("Object,{0}", oNodes.Count);
                writer.WriteLine("Variable,{0}", vNodes.Count);
                writer.WriteLine("View,{0}", viNodes.Count);
                writer.WriteLine("Method,{0}", mNodes.Count);
                writer.WriteLine("Object InstanceDeclarations,{0}", oDeclarations.Count);
                writer.WriteLine("Variable InstanceDeclarations,{0}", vDeclarations.Count);
                writer.WriteLine("Method InstanceDeclarations,{0}", mDeclarations.Count);
                writer.WriteLine("Sum,{0}", rtNodes.Count + otNodes.Count + vtNodes.Count + dtNodes.Count + oNodes.Count + vNodes.Count + viNodes.Count + mNodes.Count + oDeclarations.Count + vDeclarations.Count + mDeclarations.Count);
                //writer.WriteLine("all Nodes, {0}", all_nodes);
            }

            
            // Number of Children (for ObjectTypes, VariableTypes, ONodes, VNodes, Views that can have a subtree)
            Dictionary<String, List<TypeDesign>> openSet = new Dictionary<string, List<TypeDesign>>();
            Dictionary<String, int> closedSet = new Dictionary<string, int>();
            Dictionary<String, int[]> scores = new Dictionary<string, int[]>();

            //foreach (NodeDesign node in otNodes.Concat(vtNodes.Concat(oNodes.Concat(vNodes.Concat(viNodes)))))
            foreach (NodeDesign node in m_model.Items)
            {
                if (closedSet.ContainsKey(node.BrowseName + "_" + (node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId)))
                {
                    continue;
                }
                else if (node.Children == null)
                {
                    if (!closedSet.ContainsKey(node.BrowseName + "_" + (node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId)))
                    {
                        closedSet.Add(node.BrowseName + "_" + (node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId), 0);
                    }
                }
                else
                {
                    int nChildren = node.Children.Items.Length;
                    List<int> breadth = new List<int>();
                    breadth.Add(0);
                    int depth  = 0;
                    int sizeSubtree = countChildren(node, ref breadth, ref depth, 0);
                    scores.Add(node.BrowseName + "_" + (node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId), [nChildren, sizeSubtree, breadth.Max(), depth, 0]);

                    List<TypeDesign> scoreChildren = new List<TypeDesign>();

                    ListOfChildren children = node.Children;
                    foreach (InstanceDesign child in children.Items)
                    {
                        if (child.GetType() != typeof(MethodDesign)) //disregard Methods
                        {
                            if (child.TypeDefinition.Namespace == m_model.TargetNamespace)
                            {
                                scoreChildren.Add(child.TypeDefinitionNode);
                            }
                        }
                    }
                    openSet.Add(node.BrowseName + "_" + (node.NumericIdSpecified ? node.NumericId.ToString() : node.StringId), scoreChildren);

                }

            }

            foreach (string stype in openSet.Keys)
            {
                int s = score(stype);
                scores[stype][4] = s;
            }

            var childrenOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".Children.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(childrenOutputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName,Number of Children,Size of Subtree,Breadth of Subtree,Depth of Subtree,NS Aggregation Score");
                foreach (var elem in scores)
                {
                    writer.WriteLine("{0},{1},{2},{3},{4},{5}", elem.Key, elem.Value[0], elem.Value[1], elem.Value[2], elem.Value[3], elem.Value[4]);
                }
            }

            int countChildren(NodeDesign node, ref List<int> breadth, ref int depth, int level)
            {
                int count = 0;
                if (!node.HasChildren)
                {
                    return 0;
                }
                else
                {
                    breadth[level] += node.Children.Items.Length;
                    level++;
                    if (breadth.Count <= level)
                    {
                        breadth.Add(0);
                    }
                    foreach (var child in node.Children.Items)
                    {
                        int ndepth = 0;
                        count += 1;
                        count += countChildren(child, ref breadth, ref ndepth, level);
                        depth = (depth > ndepth) ? depth : ndepth;
                    }
                    depth++;
                    return count;
                }
            }

            int score(string typebn)
            {
                int prel = 0;

                if (closedSet.Keys.Contains(typebn))
                {
                    prel = closedSet[typebn];
                }
                else if (!openSet.Keys.Contains(typebn))
                {
                    prel = 1; // e.g. type is Variable type -> not in objectType openSet/closedSet
                    closedSet.Add(typebn, prel);
                }
                else
                {
                    prel = openSet[typebn].Count;
                    closedSet.Add(typebn, prel); // prevent loops
                    foreach (TypeDesign scoreChild in openSet[typebn])
                    {
                        if (closedSet.Keys.Contains(scoreChild.BrowseName+ "_" + (scoreChild.NumericIdSpecified ? scoreChild.NumericId.ToString() : scoreChild.StringId)))
                        {
                            prel += closedSet[scoreChild.BrowseName + "_" + (scoreChild.NumericIdSpecified ? scoreChild.NumericId.ToString() : scoreChild.StringId)];
                        }
                        else
                        {
                            // prevent loop if a type contains an instance of itself - use number of direct children in that case
                            // (because current prel is dependant on ordering of openSet[typebn])
                            prel += (scoreChild.BrowseName != typebn) ? score(scoreChild.BrowseName + "_" + (scoreChild.NumericIdSpecified ? scoreChild.NumericId.ToString() : scoreChild.StringId)) : openSet[typebn].Count;
                        }
                    }
                    closedSet[typebn] = prel;
                }

                return prel;
            }

            // Struct Aggregation: Do Structs defined in "this" Spec contain Elements with a struct/enum type from the same spec?
            var dtOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".DataTypeAggregation.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(dtOutputFile, FileMode.Create)))
            {
                writer.WriteLine("BrowseName,Number of Aggregated DataTypes,Size of Subtree");
                foreach (DataTypeDesign dt in dtNodes)
                {
                    int depth = 0;
                    int agg = 0;
                    if (dt.BaseType.Name == "Structure")
                    {
                        foreach (Parameter elem in dt.Fields)
                        {
                            if (elem.DataType.Namespace == m_model.TargetNamespace && elem.DataTypeNode.BaseType.Name == "Structure")
                            {
                                depth++;
                                agg++;
                                foreach (Parameter dt2 in elem.DataTypeNode.Fields)
                                {
                                    if (dt2.DataType.Namespace == m_model.TargetNamespace && dt2.DataTypeNode.BaseType.Name == "Structure")
                                    {
                                        depth += 1;
                                        depth += DataTypeTree(dt2.DataTypeNode);
                                    }
                                }
                            }
                            else if (elem.DataType.Namespace == m_model.TargetNamespace && elem.DataTypeNode.BaseType.Name == "Enumeration")
                            {
                                depth++;
                                agg++;
                            }
                        }
                        writer.WriteLine("{0},{1},{2}", dt.BrowseName, agg, depth);
                    }
                }
            }

            // Method Attributes
            var margOutputFile = Path.Join(filePath, m_model.TargetNamespaceInfo.Prefix + ".MethodArguments.csv");
            using (StreamWriter writer = new StreamWriter(File.Open(margOutputFile, FileMode.Create)))
            {
                writer.WriteLine("Parent,Method Name,NodeId,Inputs,Outputs,ModellingRule");
                foreach (MethodDesign method in mNodes.Concat(mDeclarations))
                {
                    if (method.SymbolicName.Namespace == m_model.TargetNamespace)
                    {
                        if (method.HasArguments)
                        {
                            int nInputs = (method.InputArguments != null) ? method.InputArguments.Length : 0;
                            int nOutputs = (method.OutputArguments != null) ? method.OutputArguments.Length : 0;
                            string parent = (method.Parent != null) ? method.Parent.BrowseName : "<>";
                            writer.WriteLine("{0},{1},{2},{3},{4},{5}", parent, method.BrowseName, method.NumericIdSpecified ? method.NumericId : method.StringId, nInputs, nOutputs,method.ModellingRule);
                        }
                        else
                        {
                            writer.WriteLine("{0},{1},{2},{3},{4},{5}", method.Parent.BrowseName, method.BrowseName, method.NumericIdSpecified ? method.NumericId : method.StringId, 0, 0, method.ModellingRule);
                        }
                    }
                }

            }
        }

        public int DataTypeTree(DataTypeDesign dt)
        {
            int depth = 0;
            if (dt.HasFields)
            {
                foreach (Parameter elem in dt.Fields)
                {
                    if (elem.DataType.Namespace == m_model.TargetNamespace && elem.DataTypeNode.BaseType.Name == "Structure")
                    {
                        depth++;
                        if (elem.DataType.Name == dt.BrowseName)
                        {
                            return depth; //DataType contains itself -> what to return?
                        }
                        foreach (Parameter elem2 in elem.DataTypeNode.Fields)
                        {
                            depth += DataTypeTree(elem2.DataTypeNode);
                        }
                    }
                }
            }
            return depth;
        }

        public int CountNodes(string filePath)
        {
            SystemContext context = new SystemContext(m_telemetry);
            context.NamespaceUris = m_model.NamespaceUris;

            NodeStateCollection collection = new NodeStateCollection();

            for (int i = 0; i < m_model.Items.Length; i++)
            {
                var node = m_model.Items[i];

                bool isInAddressSpace = !node.NotInAddressSpace;
                InstanceDesign design = node as InstanceDesign;
                if (design != null)
                {
                    if (design.TypeDefinition != null && design.TypeDefinition.Name == "DataTypeEncodingType")
                    {
                        isInAddressSpace = design.Parent == null || design.Parent.NotInAddressSpace;
                    }
                }

                // needed. Finds Methods that are defined by a type that is the TypeDefinition of an InstanceDeclaration.
                MethodDesign mdesign = node as MethodDesign;

                if (mdesign != null)
                {
                    if (mdesign.SymbolicName.Name.EndsWith("MethodType"))
                    { continue; }
                }

                NodeState state = node.State;

                if (state != null)
                {
                    if (isInAddressSpace)
                    {
                        collection.Add(state);
                    }

                    List<BaseInstanceState> children = new List<BaseInstanceState>();
                    // for nodeSet2.xml input files, state.GetChildren returns an empty array, even if node.HasChildren = True and node.Children contains children
                    // in my runs, this affected EnumValues Variables that were omitted in counting (and in NodeIDs.csv)
                    state.GetChildren(context, children);
                    RemoveChildrenWithNoNodeId(context, state);
                }           
            }

            List<NodeState> list = new List<NodeState>();
            foreach (var node2 in collection)
            {
                CountChildren(context, list, node2);
            }
            var entries = list.OrderBy(x => x.NodeId);
            return entries.Count();

        }

        private int CountChildren(SystemContext context, List<NodeState> list, NodeState node)
        {
            int count = 0;
            if (NodeId.IsNull(node.NodeId))
            {
                return 0;
            }

            list.Add(node);

            List<BaseInstanceState> children = new List<BaseInstanceState>();
            node.GetChildren(context, children);

            foreach (var child in children)
            {
                count += 1;
                count += CountChildren(context, list, child);
            }
            return count;
        }



        private void RemoveChildrenWithNoNodeId(SystemContext context, NodeState parent)
        {
            List<BaseInstanceState> children = new List<BaseInstanceState>();
            parent.GetChildren(context, children);

            foreach (var child in children)
            {
                if (child.NodeId.IdType == IdType.Numeric && (uint)child.NodeId.Identifier == 0)
                {
                    parent.RemoveChild(child);
                    continue;
                }

                RemoveChildrenWithNoNodeId(context, child);
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
