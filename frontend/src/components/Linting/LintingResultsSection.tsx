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


import { useQuery } from "@tanstack/react-query";
import { Category, CATEGORY_MAP, LintingAnalyzeItems, LintingAnalyzeResponse, LintingElement, LintingOverviewProps, Summary, SummaryCardProps } from "./types";
import { Box, Flex, Skeleton, Text } from "@chakra-ui/react";
import { styles as S } from './styles'
import { useState } from "react";
import { SizeResultsDetails } from "./SizeGraphs";
import InconsistencyDetails from "./InconsistencyDetails";
import { BestPracticeDetails } from "./BestPracticeDetails";
import { runtimeConfig } from "@/runtimeConfig";

function useLintingData(namespaces: string[]) {
  return useQuery<LintingAnalyzeResponse>({
    queryKey: ['chart-data', namespaces[0]],
    queryFn: async () => {
      const baseUrl = runtimeConfig.apiUrl || '';
      const namespace_uri = namespaces[0];
      const res = await fetch(`${baseUrl}/api/v1/linting/analyze?namespace_uri=${encodeURIComponent(namespace_uri)}`);

      return res.json();
    },
    enabled: namespaces.length > 0, 
  });
}

function getCategory(filename: string): Category | undefined {
    return CATEGORY_MAP.find(rule =>
        filename.endsWith(rule.suffix)
    )?.category;
}

function getFilesForCategory(
    data: LintingAnalyzeResponse,
    category: Category
): LintingAnalyzeItems[] {
    return data.csv_files.filter(file =>
        getCategory(file.filename) === category
    );
}

function createSummary(
    data: LintingAnalyzeResponse
): Summary {
    const summary: Summary = {
        size: 0,
        inconsistencies: 0,
        bestPractices: 0,
        total: 0,
    };

    
    for (const csv of data.csv_files) {
        const rows = csv.content
            .split("\n")
            .filter(Boolean);

        // Header nicht mitzählen
        const count = Math.max(rows.length - 1, 0);

        summary.total += count;

        const category = getCategory(csv.filename);

        if (category) {
            summary[category] += count;
        }
    }

    return summary;
}

function SummaryCard({
    title,
    value,
    selected=false,
    onClick,
}: SummaryCardProps ) {
    return (
        <Box {...S.summaryCard}
            onClick={onClick}
            bg={selected ? "blue.50" : "white"}
            borderColor={selected ? "brand" : "gray.200"}
            boxShadow={selected? "none" : "sm"}
        >
            <Text
                fontSize="3xl"
                fontWeight="bold"
            >
                {value}
            </Text>

            <Text color="gray.600">
                {title}
            </Text>
        </Box>
    );
}

function LintingOverview({ data, selectedElement, onSelectElement }: LintingOverviewProps){
 const summary = createSummary(data);

    return (
        <Flex
            gap={4}
            wrap="wrap"
        >
            <Flex gap={4} wrap="wrap" borderBottom={"2px solid"} borderBottomColor={'gray.200'} pb={"16px"}>
            <SummaryCard
                title="Size Metrics"
                value={summary.size}
                selected={selectedElement?.category === "size"}
                onClick={() =>
                    onSelectElement({
                        category: "size",
                        csv_files: getFilesForCategory(data, "size"),
                    })
                }
            />

            <SummaryCard
                title="Inconsistencies"
                value={summary.inconsistencies}
                selected={selectedElement?.category === "inconsistencies"}
                onClick={() =>
                    onSelectElement({
                        category: "inconsistencies",
                        csv_files: getFilesForCategory(data, "inconsistencies"),
                    })
                }
            />

            <SummaryCard
                title="Best Practices"
                value={summary.bestPractices}
                selected={selectedElement?.category === "bestPractices"}
                onClick={() =>
                    onSelectElement({
                        category: "bestPractices",
                        csv_files: getFilesForCategory(data, "bestPractices"),
                    })
                }
            />
            </Flex>

            <SummaryCard
                title="Total Findings"
                value={summary.total}                
            />
        </Flex>
    );
}

function LintingDetails({element,}:{element: LintingElement | null}){
    if (!element) {
        return (
            <Text color="gray.500">
                Choose a Category
            </Text>
        );
    }
    else if (element.category === "size"){
        return (
            <Box>
                <SizeResultsDetails element={element}/>
            </Box>
        );
    }
    else if (element.category === "inconsistencies"){
        return (
            <Box>
                <InconsistencyDetails element={element}/>
            </Box>
        )
    }
    else if (element.category === "bestPractices"){
        return (
            <Box>
                <BestPracticeDetails element={element}/>
            </Box>
        )
    }
    return (
        <>

            {element.csv_files.map(file => (
                <Box key={file.filename} mb={4}>
                    <Text fontWeight="medium">
                        {file.filename}
                    </Text>

                    <Text fontSize="sm" color="gray.600">
                        {file.content.split("\n").length - 1} Findings
                    </Text>
                </Box>
            ))}

            
            
        </>
    );
}

function callCategory(category: string): string {
    
    switch (category.toLowerCase()) {
        case "size":
            return "- Size";
        case "inconsistencies":
            return "- Inconsistencies";
        case "bestpractices":
            return "- Best Practices";
        default:
            throw new Error(`Unknown category: ${category}`);
    }
}

export function LintingResultsSection({ namespaces }: { namespaces: string[] }) {
    const { data, isLoading } = useLintingData(namespaces);
    const [selectedElement, setSelectedElement] = useState<LintingElement | null>(null)


    return (
        
        <Box h={'100%'} {...S.container}>
            {isLoading ? (
                <Flex {...S.resultsSplit}>
                    <Box {...S.resultsCol}>
                        <Flex {...S.resultsHeader}>
                            <Text fontSize="lg" fontWeight="medium" color="gray.900">
                                Linting Overview
                            </Text>
                        </Flex>
                        <Flex flexDirection="column" gap={3}>
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} h="120px" borderRadius="lg" />
                            ))}
                        </Flex>
                    </Box>

                    <Box {...S.detailsCol}>
                        <Flex {...S.detailsHeader}>
                            <Text fontSize="lg" fontWeight="medium" color="gray.900">
                                Details
                            </Text>
                        </Flex>
                        <Skeleton h="calc(100% - 60px)" borderRadius="lg" />
                    </Box>
                </Flex>
            ) : (
                <Flex {...S.resultsSplit}>
                    <Box {...S.resultsCol}>
                        <Flex {...S.resultsHeader}>
                            <Text fontSize="lg" fontWeight="medium" color="gray.900">
                                Linting Overview
                            </Text>
                        </Flex>
                        <Box {...S.overviewArea}>
                            <LintingOverview               
                                data={data? data:{} as LintingAnalyzeResponse}
                                selectedElement={selectedElement}
                                onSelectElement={setSelectedElement}/>
                        </Box>
                    </Box>

                    <Box {...S.detailsCol}>
                        <Flex {...S.detailsHeader}>
                            <Text fontSize="lg" fontWeight="medium" color="gray.900">
                                Details {selectedElement ? callCategory(selectedElement.category) : ""}
                            </Text>
                        </Flex>
                        <Box {...S.detailsArea}>
                            <LintingDetails element={selectedElement}/>
                        </Box>
                    </Box>
                </Flex>
            )}
        </Box>
    )
}

export default LintingResultsSection