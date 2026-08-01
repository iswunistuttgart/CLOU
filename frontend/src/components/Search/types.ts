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


export interface OPCUANodeClass {
  id: number;
  node_class: string;
}

export interface OPCUASpec {
  number: string;
  name_long: string;
  name_short: string;
  version: string;
  release_date: string;
  summary: string;
  summary_vector: number[];
  download_url: string;
  id: number;
}

export interface OPCUAUnit {
  id: number;
  unece_code: string;
  display_name: string;
  description: string;
}

export interface OPCUAModellingRule {
  id: number;
  rule: string;
}

export interface OPCUABaseNode {
  expanded_node_id: string;
  display_name: string;
  definition: string;
  definition_vector: number[];
  description: string;
  description_vector: number[];
  documentation: string;
  id: number;
  is_abstract: boolean;
  spec_id: number;
  spec: OPCUASpec;
}

export interface OPCUANodeset {
    uri: string;
    name_short: string;
    version: string;
    publication_date: string;
    download_url: string;
    id: number;
}

export interface OPCUANode extends OPCUABaseNode {
  node_class_id: number;
  typedefinition_id: number;
  parent_id: number;
  example_id: number;
  data_type_id: number;
  unit_id: number;
  modelling_rule_id: number;
  nodeset: OPCUANodeset;
  naming_example: string;
  node_class: OPCUANodeClass;
  parent: OPCUANode | null;
  typedefinition: OPCUANode | null;
  data_type: OPCUANode | null;
  unit: OPCUAUnit | null;
  modelling_rule: OPCUAModellingRule | null;
  children: OPCUANode[];
  typedefinition_of: OPCUANode[];
}

export interface OPCUAElement {
  node: OPCUANode;
  similarity: number;
}

/**
 * Props for the OPC UA Search Window component
 */
export interface OPCUASearchWindowProps {
  /**
   * Function to call when search is executed.
   * Should return a Promise with array of OPCUAElement results
   */
  onSearch: (query: string, nodesetIds: number[], nodeClasses: string[]) => Promise<OPCUAElement[]>

  /** List of available companion specifications for filtering */
  companionSpecs?: string[]

  /** Companion specs selected by default */
  defaultSelectedSpecs?: string[]

  /** Node types selected by default */
  defaultNodeClasses?: string[]

  /** Custom height for the component (default: 100%) */
  height?: string
}

export interface FilterOption {
  key: string
  label: string
}

export interface SpecFilterOption extends FilterOption {
  nodesetIds: number[]
}
