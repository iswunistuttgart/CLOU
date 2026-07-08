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
import NodeCountBarChart from "./NodeCountChart";
import { Box, Flex, Text, Accordion} from '@chakra-ui/react';
import { styles as S } from './styles'
import { MetricsAnalyzeResponse } from "./types";
import DITBarChart from "./DITChart";
import { NOCBarChart } from "./NOCChart";
import { AggBarChart } from "./AggChart";
import { IncludesInfo } from "./IncludesInfo";
import { CategoriesInfo } from "./Categories";




function useChartData(namespaces: string[]) {
  return useQuery<MetricsAnalyzeResponse>({
    queryKey: ['chart-data', namespaces[0]],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const namespace_uri = namespaces[0];
      const res = await fetch(`${baseUrl}/api/v1/metrics/analyze?namespace_uri=${encodeURIComponent(namespace_uri)}`);

      return res.json();
    },
    enabled: namespaces.length > 0, 
  });
}

export function ChartSection({ namespaces }: { namespaces: string[] }) {
    const { data, isLoading } = useChartData(namespaces);


    if (isLoading) return <div>Loading charts...</div>;
    if (!data) return <div>no metrics data received</div>;

    const nodeCountsCsv = data.csv_files.find(
        (f) => f.filename.endsWith('NodeCounts.csv')
    )?.content ?? "";

    const ditCsv = data.csv_files.find(
        (f) => f.filename.endsWith('DIT.csv')
    )?.content ?? "";

    const nocCsv = data.csv_files.find(
        (f) => f.filename.endsWith('NOC.csv')
    )?.content ?? "";
    
    const aggCsv = data.csv_files.find(
        (f) => f.filename.endsWith('Children.csv')
    )?.content ?? "";

    const includesCsv = data.csv_files.find(
        (f) => f.filename.endsWith('Includes.csv')
    )?.content ?? "";

    const categoriesCsv = data.csv_files.find(
        (f) => f.filename.endsWith('Categories.csv')
    )?.content ?? "";

    return ( 
    
    <Flex {...S.graphCol}>

        <Accordion.Root collapsible >

            <Accordion.Item key={0} value={"non"} {...S.graphAccordionItem}>
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Number of Nodes
                        </Text>

                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <Box {...S.graphArea}><NodeCountBarChart nc_csv={nodeCountsCsv}  /> </Box>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item key={1} value={"dit"} {...S.graphAccordionItem} >
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Depth of Inheritance
                        </Text>

                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <Box   {...S.graphArea} h={ditCsv.split(/\r?\n/).filter(Boolean).length*40+220}>
                            <DITBarChart dit_csv={ditCsv} />
                        </Box>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item key={2} value={"noc"} {...S.graphAccordionItem} >
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Number of Children/Subtypes
                        </Text>
                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <Box {...S.graphArea} h={nocCsv.split(/\r?\n/).filter(Boolean).length*30}>
                            <NOCBarChart csv={nocCsv} targetNamespace={namespaces[0]} />
                        </Box>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item key={3} value={"agg"} {...S.graphAccordionItem} >
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Aggregation (Components/Properties)
                        </Text>

                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <Box   {...S.graphArea} h={'100%'}>
                            <AggBarChart csv={aggCsv} />
                        </Box>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item key={4} value={"incl"} {...S.graphAccordionItem} >
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Includes
                        </Text>
                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <IncludesInfo csv={includesCsv}/>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

            <Accordion.Item key={5} value={"cu"} {...S.graphAccordionItem} >
                <Accordion.ItemTrigger>
                    <Flex {...S.graphHeader}>
                        <Text fontSize="lg" fontWeight="medium" color="gray.900">
                            Conformance Units
                        </Text>
                    </Flex>
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Accordion.ItemBody>
                        <CategoriesInfo csv={categoriesCsv}/>
                    </Accordion.ItemBody>
                </Accordion.ItemContent>
            </Accordion.Item>

        </Accordion.Root>






    </Flex>
    )
}

export default ChartSection