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
import { NOCCsvRow, NOCChartData } from "./types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

export function useNOCChartData(
  csv: string,
  targetNamespace: string
) {
  return useCsvData<NOCChartData[]>({
    csv,

    select: (data: NOCCsvRow[]): NOCChartData[] => {
      return data
        .slice(0, -1)
        .map((row) => ({
          name: row.browsename,
          noc: Number(row.noc),
          namespace: row.namespace,
          nodeid: row.nodeid,
          isForeignNamespace:
            row.namespace !== targetNamespace,
        }))
        .filter((row) => !Number.isNaN(row.noc))
        .sort((a, b) => b.noc - a.noc);
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
  const color = data.isForeignNamespace ? "var(--chakra-colors-teal-400)" : "var(--chakra-colors-blue-400)"
  const ns = 
    data.isForeignNamespace
      ? <Text color={color}> Namespace:{' '} {data.namespace} </Text>
      : <></>
    ;

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

      <Text color={color}>
        Subtypes in Target Namespace:{' '}
        {data.noc}
      </Text>

      {ns}



    </Box>
  );
}

function CustomBarShape(props: any) {
  const {
    x,
    y,
    width,
    height,
    payload,
  } = props;

  const isForeign = payload.isForeignNamespace;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={
        isForeign
          ? 'var(--chakra-colors-teal-400)'
          : 'var(--chakra-colors-blue-400)'
      }
      opacity={isForeign ? 0.6 : 1}
    />
  );
}

type Props = {
  csv: string;
  targetNamespace: string;
};


export function NOCBarChart({ csv, targetNamespace }: Props) {
  const { data, isLoading, error } = useNOCChartData(csv, targetNamespace);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error preparing NOC Chart Data...</div>;
  if (!data) return <div>No Data</div>;


  const width = Math.max(250,Math.max(...[...data].map(item => item.name.length))*7);

  return (


    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />

        <YAxis
          type="category"
          dataKey="name"
          width={width}
        />


        <Tooltip content={<CustomTooltip />}/>
        <Legend
          content={
            <ul className="recharts-default-legend" style={{ 'padding': "0px",'margin':'0px', 'text-align': 'center'} as React.CSSProperties}>
              <li className="recharts-legend-item legend-item-1" style={{'display':'inline-block','margin-right' : '10px'} as React.CSSProperties}>
                <svg aria-label="Instance Nodes legend icon" className="recharts-surface" width="14" height="14" style={{'display':'inline-block','vertical-align' : 'middle','margin-right' : '4px'} as React.CSSProperties} viewBox="0 0 32 32">
                  <title></title>
                  <desc></desc>
                  <path stroke="none" fill="var(--chakra-colors-blue-400)" d="M0,4h32v24h-32z" className="recharts-legend-icon"></path>
                </svg>
                <span className="recharts-legend-item-text" style={{'color' : 'var(--chakra-colors-blue-400)'} as React.CSSProperties}>Target Namespace</span>
              </li>
              <li className="recharts-legend-item legend-item-1" style={{'display':'inline-block','margin-right' : '10px'} as React.CSSProperties}>
                <svg aria-label="Instance Nodes legend icon" className="recharts-surface" width="14" height="14" style={{'display':'inline-block','vertical-align' : 'middle','margin-right' : '4px'} as React.CSSProperties} viewBox="0 0 32 32">
                  <title></title>
                  <desc></desc>
                  <path stroke="none" fill="var(--chakra-colors-teal-400)" opacity="0.6" d="M0,4h32v24h-32z" className="recharts-legend-icon"></path>
                </svg>
                <span className="recharts-legend-item-text" style={{'color' : 'var(--chakra-colors-teal-400)'} as React.CSSProperties}>Other Namespace</span>
              </li>
            </ul>
          }
        />

        <Bar
          dataKey="noc"
          shape={<CustomBarShape />}
        />

      </BarChart>
    </ResponsiveContainer>


  );
}