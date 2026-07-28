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


import { useCsvData } from "./NodeCountChart";
import { DITBarChartProps, DITChartData, DITCsvRow, DITGroupedData } from "./types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Box,  Flex, Icon, Text } from "@chakra-ui/react";
import { FiBarChart2 } from "react-icons/fi";

export function useDITChartData(csv: string) {
  return useCsvData<DITGroupedData>({
    csv,
    select: (data: DITCsvRow[]): DITGroupedData => {
        const grouped: Record<string, Record<string, DITChartData>> = {
        ReferenceType: {},
        ObjectType: {},
        VariableType: {},
        DataType: {},
      };

      data.forEach((row) => {
        const nodeclass = row.nodeclass;

        // nur erlaubte Klassen
        if (!(nodeclass in grouped)) return;

        grouped[nodeclass][row.name] = {
          name: row.name,
          nodeid: row.nodeid,
          absolute: row.tdit ? Number(row.tdit) : Number(0),
          relative: row.rdit ? Number(row.rdit) : Number(0),
        };
      });
    
    
      
      return {
        referenceTypes: Object.values(grouped.ReferenceType),
        objectTypes: Object.values(grouped.ObjectType),
        variableTypes: Object.values(grouped.VariableType),
        dataTypes: Object.values(grouped.DataType)
      };
    }
  })
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
        {label}{' ('}i={data.nodeid}{')'}
      </Text>

      <Text color="var(--chakra-colors-blue-400)">
        Absolute:{' '}
        {data.absolute}
      </Text>

      <Text color="var(--chakra-colors-teal-400)">
        Relative:{' '}
        {data.relative}
      </Text>

    </Box>
  );
}

export function DITBarChart({dit_csv} : DITBarChartProps) {
    const csv = dit_csv;
    
    const {data,error} = useDITChartData(csv);
    if(error) return (<div>Error preparing DIT Chart Data...</div>);
    if (!data) return <div>No Data</div>;
    const rt = data?.referenceTypes.length ?? 0;
    const ot = data?.objectTypes.length ?? 0;
    const vt = data?.variableTypes.length ?? 0;
    const dt = data?.dataTypes.length ?? 0;
    const factor = 40;

    const maxNameLength = Math.max(
    ...[
        ...data.referenceTypes,
        ...data.objectTypes,
        ...data.variableTypes,
        ...data.dataTypes,
    ].map(item => item.name.length)    
    );
    const width = Math.max(250,maxNameLength*7);

  return (
    <>
    <Flex gap={4} pb={4}>
      <Flex align="center" gap={2}>
          <Box
            w="12px"
            h="12px"
            bg={"var(--chakra-colors-blue-400)"}
          />

          <Text whiteSpace="nowrap" color="var(--chakra-colors-blue-400)">
            Absolute Depth of Inheritance
          </Text>
        </Flex>
              <Flex align="center" gap={2}>
          <Box
            w="12px"
            h="12px"
            bg={"var(--chakra-colors-teal-400)"}
          />

          <Text whiteSpace="nowrap" color="var(--chakra-colors-teal-400)">
            Relative Depth of Inheritance
          </Text>
        </Flex>
    </Flex>
    <Text fontSize="lg" fontWeight="bold" mb={2}>
      ReferenceTypes
    </Text>
    {data?.referenceTypes.length === 0 && (
      <Flex width='1000px' pb='2px'>
        <Text >No ReferenceTypes defined {" "}</Text>
        <Icon as={FiBarChart2} boxSize={5} />
      </Flex>
    )}

      <ResponsiveContainer width="100%" height={(rt??23)*factor + 12} >
  
        <BarChart data={data?.referenceTypes.sort((a, b) => b.absolute - a.absolute) ?? []} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={width} />
          <Tooltip content={<CustomTooltip />}/>
          
          <Bar dataKey="absolute" stackId="a" fill="var(--chakra-colors-blue-400)" />
          <Bar dataKey="relative" fill="var(--chakra-colors-teal-400)" />


        </BarChart>
      </ResponsiveContainer>

    <Text fontSize="lg" fontWeight="bold" mb={2}>
      ObjectTypes
    </Text>
    {data?.objectTypes.length === 0 && (
      <Flex width='1000px' pb='2px'>
        <Text >No ObjectTypes defined {" "}</Text>
        <Icon as={FiBarChart2} boxSize={5} />
      </Flex>
    )}
      <ResponsiveContainer width="100%" height={(ot??23)*factor + 12} >
        <BarChart data={data?.objectTypes.sort((a, b) => b.absolute - a.absolute) ?? []} layout="vertical" >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number"  />
          <YAxis type="category" dataKey="name" width={width} />
          <Tooltip content={<CustomTooltip />}/>

          <Bar dataKey="absolute" stackId="a" fill="var(--chakra-colors-blue-400)" />
          <Bar dataKey="relative" fill="var(--chakra-colors-teal-400)" />

        </BarChart>
      </ResponsiveContainer>

    <Text fontSize="lg" fontWeight="bold" mb={2}>
      VariableTypes
    </Text>
    {data?.variableTypes.length === 0 && (
      <Flex width='1000px' pb='2px'>
        <Text >No VariableTypes defined {" "}</Text>
        <Icon as={FiBarChart2} boxSize={5} />
      </Flex>
    )}

      <ResponsiveContainer width="100%" height={(vt??23)*factor + 12} >

        <BarChart data={data?.variableTypes.sort((a, b) => b.absolute - a.absolute) ?? []} layout="vertical" >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number"  />
          <YAxis type="category" dataKey="name" width={width} />
          <Tooltip content={<CustomTooltip />}/>

          <Bar dataKey="absolute" stackId="a" fill="var(--chakra-colors-blue-400)" />
          <Bar dataKey="relative" fill="var(--chakra-colors-teal-400)" />

        </BarChart>
      </ResponsiveContainer>

    <Text fontSize="lg" fontWeight="bold" mb={2}>
      DataTypes
    </Text>
    {data?.dataTypes.length === 0 && (
      <Flex width='1000px' pb='2px'>
        <Text >No DataTypes defined {" "}</Text>
        <Icon as={FiBarChart2} boxSize={5} />
      </Flex>
    )}
      <ResponsiveContainer width="100%" height={(dt??23)*factor + 12} >
        <BarChart data={data?.dataTypes.sort((a, b) => b.absolute - a.absolute) ?? []} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number"  />
          <YAxis type="category" dataKey="name" width={width} />
          <Tooltip content={<CustomTooltip />}/>

          <Bar dataKey="absolute" stackId="a" fill="var(--chakra-colors-blue-400)" />
          <Bar dataKey="relative" fill="var(--chakra-colors-teal-400)" />

        </BarChart>

      </ResponsiveContainer>
    </>
  );
}


export default DITBarChart
