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


import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { CsvRow, NodeCountBarChartProps, NodeCountChartData } from './types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function useCsvData<T>(params: {
    csv: string;
    select: (data: any[]) => T;
}) {
    const {csv,select} = params;
  return useQuery({
    queryKey: ['csv-data', csv],
    queryFn: async () => {
      

      const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => normalizeHeader(header),
      });

      return parsed.data;
    },
    select,
    enabled: !!csv,
  });
}

export function useNodeCountChartData(csv: string) {
  return useCsvData<NodeCountChartData[]>({
    csv,
    select: (data: CsvRow[]): NodeCountChartData[] => {
      const grouped: Record<string,NodeCountChartData> = {};

      data.slice(0, -1).forEach((row) => {
        let cat: keyof NodeCountChartData = "Type Nodes";
        let nodeclass = row.nodeclass;
        if (row.nodeclass === 'ReferenceType' || row.nodeclass === 'ObjectType' || row.nodeclass === 'VariableType' || row.nodeclass === 'DataType') {
          cat = "Type Nodes";
        } else if (row.nodeclass === 'Object' || row.nodeclass === 'Variable' || row.nodeclass === 'View' || row.nodeclass === 'Method') {
          cat = "Instance Nodes";
        } else if (row.nodeclass === 'Object InstanceDeclarations') {
          cat = "Instance Declarations";
          nodeclass = "Object";
        } else if (row.nodeclass === 'Variable InstanceDeclarations') {
          cat = "Instance Declarations";
          nodeclass = "Variable";
        } else if (row.nodeclass === 'Method InstanceDeclarations') {
          cat = "Instance Declarations";
          nodeclass = "Method";
        }
        
        const node_count = Number(row.node_count);

        if (!grouped[nodeclass]) {
          grouped[nodeclass] = { name : nodeclass};
        }

        grouped[nodeclass][cat] = node_count;
      })
      
      return Object.values(grouped);
    }
  })
}





export function NodeCountBarChart({nc_csv} : NodeCountBarChartProps) {
    const csv = nc_csv;

    const { data } = useNodeCountChartData(csv ?? "");
   
    if (!data) return <div>No Data</div>;
  return (
    <ResponsiveContainer width="100%" height="100%" >
      <BarChart data={data ?? []} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number"/>
        <YAxis type="category" dataKey="name" width={120} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Type Nodes" stackId="a" fill="var(--chakra-colors-blue-400)"/>
        <Bar dataKey="Instance Nodes" stackId="a" fill="var(--chakra-colors-teal-400)"/>
        <Bar dataKey="Instance Declarations" stackId="a" fill="var(--chakra-colors-purple-400)"/>
      </BarChart>
    </ResponsiveContainer>
  );
}


export default NodeCountBarChart