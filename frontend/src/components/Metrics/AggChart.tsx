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


import { Box, Text } from "@chakra-ui/react";
import { useCsvData } from "./NodeCountChart";
import { AggChartData, AggCsvRow } from "./types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export function useAggChartData(csv: string) {
    return useCsvData<AggChartData[]>({
        csv,

        select: (data: AggCsvRow[]): AggChartData[] => {
            return data
                .map((row) => ({
                    name: row.browsename.replace(/_[^_]+$/, ''),
                    numberOfChildren: Number(row.number_of_children),
                    sizeOfSubtree: Number(row.size_of_subtree),
                    nodeId: row.browsename.split('_')[row.browsename.split('_').length - 1],
                    breadthOfSubtree: Number(row.breadth_of_subtree),
                    depthOfSubtree: Number(row.depth_of_subtree),
                    nsAggregationScore: Number(row.ns_aggregation_score)
                }))
                .filter(
                    (row) =>
                        !Number.isNaN(row.numberOfChildren) &&
                        !Number.isNaN(row.sizeOfSubtree)
                )
                .sort(
                    (a, b) =>
                        b.numberOfChildren + b.sizeOfSubtree -
                        (a.numberOfChildren + a.sizeOfSubtree)
                );
        },
    });
}

function CustomTooltip({
  active,
  payload,
  label,
}: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <Box
      bg="white"
      p={3}
      borderRadius="md"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
    >
      <Text fontWeight="bold" mb={2}>
        {label}{' ('}i={data.nodeId}{')'}
      </Text>

      <Text color="var(--chakra-colors-blue-400)">
        Directly Aggregated Nodes:{' '}
        {data.numberOfChildren}
      </Text>

      <Text color="var(--chakra-colors-teal-400)">
        Size of Subtree:{' '}
        {data.sizeOfSubtree}
      </Text>

      <Text>
        Breadth of Subtree:{' '}
        {data.breadthOfSubtree}
      </Text>

      <Text>
        Depth of Subtree:{' '}
        {data.depthOfSubtree}
      </Text>

    </Box>
  );
}

type Props = {
  csv: string;
};

export function AggBarChart({ csv }: Props) {
  const { data, isLoading, error } =
    useAggChartData(csv);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error preparing Aggreation Chart Data...</div>;
  if (!data) return <div>No Data</div>;

  const width = Math.max(250,Math.max(...[...data].map(item => item.name.length))*7);

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(data.length * 35, 400)}
    >
      <BarChart
        data={data}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />

        <YAxis
          type="category"
          dataKey="name"
          width={width}
        />

        <Tooltip content={<CustomTooltip />}/>

        <Legend />

        <Bar
          dataKey="numberOfChildren"
          stackId="a"
          fill="var(--chakra-colors-blue-400)"
          name="Directly Aggregated Nodes"
        />

        <Bar
          dataKey="sizeOfSubtree"
          //stackId="a"
          fill="var(--chakra-colors-teal-400)"
          name="Size of Subtree"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
