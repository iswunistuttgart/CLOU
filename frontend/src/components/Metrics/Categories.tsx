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


import { Card, Heading, SimpleGrid, Table } from "@chakra-ui/react";
import { useCsvData } from "./NodeCountChart";
import { CategoryCsvRow, CategoryData } from "./types";
import { useState } from "react";

function useCatChartData(csv: string) {
    return useCsvData<CategoryData[]>({
        csv,
        select: (rows: CategoryCsvRow[]): CategoryData[] => {
            return rows
                .map((row) => {
                    const browseNames = row.browsenames
                        .replace(/^\[|\]$/g, "")
                        .trim()
                        .split(/\s+/);

                    const nodeIds = row.nodeids
                        .replace(/^\[|\]$/g, "")
                        .trim()
                        .split(/\s+/);

                    const entries = browseNames.map((browseName, index) => ({
                        browseName,
                        nodeId: nodeIds[index] ?? "",
                    }));

                    return {
                        category: row.category,
                        entries,
                    };
                })
                .sort((a, b) => a.category.localeCompare(b.category));
        },
    });
}

type Props = {
    csv: string;
};

export function CategoriesInfo({ csv }: Props) {
    const { data, isLoading, error } =
        useCatChartData(csv);

    const [selectedCategories, setSelectedCategories] =
        useState<Set<string>>(new Set());

    const toggleCategory = (category: string) => {
        setSelectedCategories((prev) => {
            const next = new Set(prev);

            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }

            return next;
        });
    };

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error preparing Aggreation Chart Data...</div>;
    if (!data) return <div>No Data</div>;
    return (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
            {data?.map((category) => (
                <Card.Root
                    key={category.category}
                    cursor="pointer"
                    onClick={() => toggleCategory(category.category)}
                    bg={
                        selectedCategories.has(category.category)
                            ? "blue.50"
                            : "white"
                    }
                    borderColor={
                        selectedCategories.has(category.category)
                            ? "blue.400"
                            : "gray.200"
                    }
                >
                    <Card.Header>
                        <Heading fontSize="sm" >
                            {category.category}
                        </Heading>
                    </Card.Header>

                    <Card.Body>
                        <Table.Root size="sm" tableLayout="fixed">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader>Associated Type</Table.ColumnHeader>
                                    <Table.ColumnHeader>NodeId</Table.ColumnHeader>
                                </Table.Row>
                            </Table.Header>

                            <Table.Body>
                                {category.entries.map((entry) => (
                                    <Table.Row key={entry.nodeId}>
                                        <Table.Cell>{entry.browseName}</Table.Cell>
                                        <Table.Cell>{entry.nodeId}</Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Card.Body>
                </Card.Root>
            ))}
        </SimpleGrid>
    )
}
