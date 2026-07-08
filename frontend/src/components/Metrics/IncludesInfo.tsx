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


import { Card, Flex, Heading, SimpleGrid, Text, Stat } from "@chakra-ui/react";
import { useCsvData } from "./NodeCountChart";
import { IncludedNode, IncludesCsvRow, IncludesData } from "./types";

function useInclChartData(csv: string) {
    return useCsvData<IncludesData>({
        csv,
        select: (rows: IncludesCsvRow[]): IncludesData => {
  const nodes = new Map<string, IncludedNode>();
  const foreignNamespaces = new Set<string>();

  rows.slice(0, -1).forEach((row) => {
    foreignNamespaces.add(row.foreign_namespace);

    let node = nodes.get(row.nodeid);

    if (!node) {
      node = {
        nodeId: row.nodeid,
        browseName: row.browsename,
        inclusions: [],
      };

      nodes.set(row.nodeid, node);
    }

    node.inclusions.push({
      kind: row.kind_of_inclusion,
      foreignNamespace: row.foreign_namespace,
    });
  });

  return {
    totalNodes: nodes.size,
    totalForeignNamespaces: foreignNamespaces.size,
    totalIncludes: rows.length,
    nodes: Array.from(nodes.values()),
  };
}
    })
}

type Props = {
  csv: string;
};

export function IncludesInfo({ csv }: Props) {
  const { data, isLoading, error } =
    useInclChartData(csv);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error preparing Aggreation Chart Data...</div>;
  if (!data) return <div>No Data</div>;
return(
    <Flex>
    <SimpleGrid columns={3} gap={4} mb={6}>
  <Stat.Root>
    <Stat.Label>Affected Nodes</Stat.Label>
    <Stat.ValueText>{data.totalNodes}</Stat.ValueText>
  </Stat.Root>

  <Stat.Root>
    <Stat.Label>Foreign Namespaces</Stat.Label>
    <Stat.ValueText>{data.totalForeignNamespaces}</Stat.ValueText>
  </Stat.Root>

  <Stat.Root>
    <Stat.Label>Includes</Stat.Label>
    <Stat.ValueText>{data.totalIncludes}</Stat.ValueText>
  </Stat.Root>
</SimpleGrid>
<Flex direction="column" gap={4}>
  {data.nodes.map(node => (
    <Card.Root key={node.nodeId}>
      <Card.Header>
        <Heading size="sm">
          {node.browseName}
        </Heading>

        <Text color="gray.600">
          {node.nodeId}
        </Text>
      </Card.Header>

      <Card.Body>
        {node.inclusions.map((inc, index) => (
          <Flex
            key={index}
            justify="space-between"
            py={1}
          >
            <Text>{inc.kind}</Text>
            <Text>{inc.foreignNamespace}</Text>
          </Flex>
        ))}
      </Card.Body>
    </Card.Root>
  ))}
</Flex>
</Flex>
)

}