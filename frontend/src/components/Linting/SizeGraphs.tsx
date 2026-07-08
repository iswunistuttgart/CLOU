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


import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import { useCsvData } from "../Metrics/NodeCountChart";
import { OverThreshChartData, OverThreshRow, LintingResultsProps } from "./types";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { styles as S } from './styles'

function parseLevel(level: string): OverThreshRow["level"] {
    
    switch (level.toLowerCase()) {
        case "major":
            return "major";
        case "minor":
            return "minor";
        case "info":
            return "info";
        default:
            throw new Error(`Unknown level: ${level}`);
    }
}

export function useThreshChartData(
  csv: string,
) {
    
    
  return useCsvData<OverThreshChartData>({
    csv,
    select: (data: OverThreshRow[]): OverThreshChartData => {
        const grouped: OverThreshChartData = {
            major: [],
            minor: [],
            info: [],
        };
        
        data.forEach((row) => { 
            const level = parseLevel(row.level);
            const newRow : OverThreshRow = {     
            reason : row.reason,
            nodeid : row.nodeid,
            browsename : row.browsename,
            value : Number(row.value),
            threshold : Number(row.threshold),
            level : level,
            };
            grouped[level]?.push(newRow);
        });        
        
        return grouped;
    },
  });
}

const REASON_COMPARATOR = (a: OverThreshRow, b: OverThreshRow) => {
    const reasonDiff = a.reason.localeCompare(b.reason);

    if (reasonDiff !== 0) {
        return reasonDiff;
    }

    return b.value - a.value; // größter Wert zuerst
};

function prepareChartData(
    rows?: OverThreshRow[]
): OverThreshRow[] {
    if (!rows) {
        return [];
    }

    return [...rows].sort(REASON_COMPARATOR);
}

function OverThresholdChart({
    title,
    rows,
    color,
}: {
    title: string;
    rows: OverThreshRow[];
    color: string;
}) {
    const data = prepareChartData(rows);

    if (data.length === 0) {
        return null;
    }
    

    const width = Math.max(150,Math.max(...[...data].map(item => item.browsename.length))*7);

    return (
        <Box>
            <Text
                fontSize="md"
                fontWeight="bold"
                mb={4}
                pl={width}
            >
                {title}
            </Text>


            <ResponsiveContainer
                width="100%"
                height={Math.max(250, data.length * 35)}
            >
                <BarChart
                    data={data}
                    layout="vertical"
                >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis type="number" />

                    <YAxis
                        type="category"
                        dataKey="browsename"
                        width={width}                        
                    />
                    

                    <Tooltip
                        formatter={(value) => [value, "Value"]}
                        labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload;

                            return [
                                `NodeId: ${row.nodeid}`,                                
                            ];
                        }}
                    /> 

                    <Bar dataKey="value" fill={color}/>

                    <ReferenceLine
                        x={rows[0].threshold}
                        stroke="red"
                        strokeDasharray="6 4"
                        strokeWidth={2}
                        //label={`Threshold ${rows[0].threshold}`}
                    />

                    
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

type ReasonGroup = {
    reason: string;
    threshold: number;
    rows: OverThreshRow[];
};

function groupByReason(
    rows: OverThreshRow[]
): ReasonGroup[] {
    const grouped = new Map<string, ReasonGroup>();

    rows.forEach(row => {
        const key = row.reason;

        if (!grouped.has(key)) {
            grouped.set(key, {
                reason: key,
                threshold: row.threshold,
                rows: [],
            });
        }

        grouped.get(key)!.rows.push(row);
    });

    return [...grouped.values()].map(group => ({
        ...group,
        rows: [...group.rows].sort(
            (a, b) => b.value - a.value
        ),
    }));
}

function OverThresholdCharts({
    csv,
}: {
    csv: string;
}) {
    
    const {data} = useThreshChartData(csv);
    
    if (!data) return <div>No Data</div>;
    
    return (
        <VStack
            align="stretch"
            gap={8}
        >

            {(data.major && data.major?.length !== 0) && (
                <>
                    <Heading size="md" >Major Findings</Heading>
                    <Text {...S.inconsistenciesDescription}>These values are high over recommended best practices. Double check if the model is intended to be this way.</Text>

                    {groupByReason(data.major).map(group => (
                        <OverThresholdChart
                            key={group.reason}
                            title={group.reason}
                            rows={group.rows}
                            color="var(--chakra-colors-pink-400)"
                        />
                    ))}
                </>
            )}

            {(data.minor && data.minor?.length !== 0) && (
                <>
                    <Heading size="md" >Minor Findings</Heading>
                    <Text {...S.inconsistenciesDescription}>These values are over recommended best practices.</Text>

                    {groupByReason(data.minor).map(group => (
                        <OverThresholdChart
                            key={group.reason}
                            title={group.reason}
                            rows={group.rows}
                            color="var(--chakra-colors-purple-400)"
                        />
                    ))}
                </>
            )}

            {(data.info && data.info?.length !== 0) && (
                <>
                    <Heading size="md" >Info Findings</Heading>
                    <Text {...S.inconsistenciesDescription}>These values are elevated compared to best practices.</Text>

                    {groupByReason(data.info).map(group => (
                        <OverThresholdChart
                            key={group.reason}
                            title={group.reason}
                            rows={group.rows}
                            color="var(--chakra-colors-blue-400)"
                        />
                    ))}
                </>
            )}
        </VStack>
    );
}


export function SizeResultsDetails({ element, }: LintingResultsProps) {
    const overThreshCsv = element.csv_files.find(
        (f) => f.filename.endsWith('OverThresh.csv')
    )?.content ?? "";

    return (
        <Box>
            <OverThresholdCharts csv={overThreshCsv} />
        </Box>
    )
}