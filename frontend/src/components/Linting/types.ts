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


export interface OPCUALintingWindowProps {
      height?: string
};

export type LintingNodeSetProviderResponse = {
      namespaces: string[];
      missing_dependencies: string[];
};

export type LintingAnalyzeResponse = {
      namespace_uri: string;
      csv_files: LintingAnalyzeItems[];
};

export type LintingAnalyzeItems = {
      filename: string;
      content: string;
};

export type Category = "size" | "inconsistencies" | "bestPractices";

export type LintingElement = {
      category: Category;
      csv_files: LintingAnalyzeItems[];
}

export type Summary = {
    size: number;
    inconsistencies: number;
    bestPractices: number;
    total: number;
};

export const CATEGORY_MAP: {
    suffix: string;
    category: Category;
}[] = [
    { suffix: "OverThresh.csv", category: "size" },
    { suffix: "NOC.csv", category: "size" },

    { suffix: "MissingCategories.csv", category: "inconsistencies" },
    { suffix: "InstancesOutOfTypes.csv", category: "inconsistencies" },
    { suffix: "MissingDescriptions.csv", category: "inconsistencies" },
    { suffix: "EventNotifier.csv", category: "inconsistencies" },
    { suffix: "AccessLevel.csv", category: "inconsistencies" },

    { suffix: "NamingRules.csv", category: "bestPractices" },
];

export interface LintingOverviewProps{
    data: LintingAnalyzeResponse
    selectedElement: LintingElement | null
    onSelectElement: (element: LintingElement) => void
}

export type SummaryCardProps = {
    title: string;
    value: number;
    selected?: boolean;
    onClick?: () => void;
};

export type LintingResultsProps = {
    element: LintingElement;
}

export type OverThreshRow = {
    reason: string;
    nodeid: string;
    browsename: string;
    value: number;
    threshold: number;
    level: "info" | "minor" | "major";
};

export type OverThreshChartData = {
    major?: OverThreshRow[]
    minor?: OverThreshRow[]
    info?: OverThreshRow[]
};

export type NamingRuleRow = {
    message: string;
    browsename: string;
    nodeid: string;
};

export type NamingRuleGroup = {
    rule: string;
    rows: NamingRuleRow[];
};