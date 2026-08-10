/*Copyright 2026 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. and Universität Stuttgart

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/


export interface OPCUAGraphWindowProps {
      height?: string
};

export type NodeCountChartData = {
      name: string;
      "Type Nodes"?: number;
      "Instance Nodes"?: number;
      "Instance Declarations"?: number;
};

export type CsvRow = {
  nodeclass: string;
  node_count: string;
};

export type NodeCountBarChartProps = {
      nc_csv: string;
};

export type DITBarChartProps = {
      dit_csv: string;
};

export type DITChartData = {
      name: string;
      nodeid: string;
      absolute:number;
      relative:number;
};

export type DITGroupedData = {
  referenceTypes: DITChartData[];
  objectTypes: DITChartData[];
  variableTypes: DITChartData[];
  dataTypes: DITChartData[];
};

export type DITCsvRow = {
      nodeclass: string;
      name: string;
      nodeid: string;
      tdit: string;
      rdit: string;
};

export type MetricsNodeSetProviderResponse = {
      namespaces: string[];
      missing_dependencies: string[];
};

export type MetricsAnalyzeResponse = {
      namespace_uri: string;
      csv_files: MetricsAnalyzeItems[];
};

export type MetricsAnalyzeItems = {
      filename: string;
      content: string;
};

export type NOCCsvRow = {
  browsename: string;
  namespace: string;
  nodeid: string;
  noc: string;
};

export type NOCChartData = {
  name: string;
  noc: number;
  nodeid: string;
  namespace: string;
  isForeignNamespace: boolean;
};

export type AggCsvRow = {
  browsename: string;
  "number_of_children": string;
  "size_of_subtree": string;
  "breadth_of_subtree": string;
  "depth_of_subtree": string;
  "ns_aggregation_score": string;
};

export type AggChartData = {
  name: string;
  numberOfChildren: number;
  sizeOfSubtree: number;
  nodeId: string;
  breadthOfSubtree: number;
  depthOfSubtree: number;
  nsAggregationScore: number;
};

export type IncludesCsvRow = {
  kind_of_inclusion: string;
  browsename: string;
  nodeid: string;
  foreign_namespace: string;
};

export type IncludedNode = {
  nodeId: string;
  browseName: string;
  inclusions: {
    kind: string;
    foreignNamespace: string;
  }[];
};

export type IncludesPerNamespace = {
    namespace: string;
    count: number;
};

export type IncludesData = {
  totalNodes: number;
  totalForeignNamespaces: number;
  totalIncludes: number;
  includesPerNamespace: IncludesPerNamespace[];
  nodes: IncludedNode[];
};

export type CategoryData = {
  category: string;
  entries: CategoryEntry[];
};

export type CategoryCsvRow = {
  category: string;
  browsenames: string;
  nodeids: string;
};

export type CategoryEntry = {
  browseName: string;
  nodeId: string;
};
