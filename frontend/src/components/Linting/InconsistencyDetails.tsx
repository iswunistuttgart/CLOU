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


import { Accordion, Text} from '@chakra-ui/react';
import DetailsTable from './Table';
import { useCsvData } from '../Metrics/NodeCountChart';
import { LintingResultsProps } from './types';
import { styles as S } from './styles'

export type MissingInfoRow = {
    browsename: string;
    nodeid: string;
};

export type AccessLevelRow = {
    browsename: string;
    nodeid: string;
    accesslevel: string;
};

export type OutOfTypesRow = {
    nodeid: number;
    browsename: string;
    sizeofsubtree: number;
};


function MissingInfoTable({rows,}:{rows: MissingInfoRow[]})
{
return(
<DetailsTable
    rows={rows}
    columns={[
        {
            header: "Browse Name",
            accessor: (r) => r.browsename,
        },
        {
            header: "Node Id",
            accessor: (r) => r.nodeid,
        },
    ]}
/>
)
}

function AccessLevelTable({rows,}:{rows: AccessLevelRow[]})
{
return(
<DetailsTable
    rows={rows}
    columns={[
        {
            header: "Browse Name",
            accessor: (r) => r.browsename,
        },
        {
            header: "Node Id",
            accessor: (r) => r.nodeid,
        },
        {
            header: "AccessLevel",
            accessor: (r) => r.accesslevel,
        },
    ]}
/>
)
}

function OutOfTypesTable({rows,}:{rows: OutOfTypesRow[]})
{
    return(
        <DetailsTable
            rows={rows}
            columns={[
                {
                    header: "Browse Name",
                    accessor: (r) => r.browsename,
                },
                {
                    header: "Node Id",
                    accessor: (r) => r.nodeid,
                },
                {
                    header: "Sum of Aggregated Nodes",
                    accessor: (r) => r.sizeofsubtree,
                }
            ]}
        />
    )
}

export function InconsistencyDetails ({ element, }: LintingResultsProps) 
{
    const missingCategoriesCsv = element.csv_files.find(
        (f) => f.filename.endsWith('MissingCategories.csv')
    )?.content ?? "";

    const instOutOfTypesCsv = element.csv_files.find(
        (f) => f.filename.endsWith('InstancesOutOfTypes.csv')
    )?.content ?? "";

    const missingDescriptionsCsv = element.csv_files.find(
        (f) => f.filename.endsWith('MissingDescriptions.csv')
    )?.content ?? "";

    const eventNotifierCsv = element.csv_files.find(
        (f) => f.filename.endsWith('EventNotifier.csv')
    )?.content ?? "";

    const accessLevelCsv = element.csv_files.find(
        (f) => f.filename.endsWith('AccessLevel.csv')
    )?.content ?? "";
    


    const { data: rows = [] } = useCsvData<MissingInfoRow[]>({
        csv: missingCategoriesCsv,
        select: (data:MissingInfoRow[]) : MissingInfoRow[] =>
            data.map((row) => ({
                browsename: row.browsename,
                nodeid: row.nodeid,
            }))
            .sort((a, b) => a.browsename.localeCompare(b.browsename)),
        });

    const { data: ootRows = []} = useCsvData<OutOfTypesRow[]>({
        csv: instOutOfTypesCsv,
        select: (data:OutOfTypesRow[]) : OutOfTypesRow[] =>
            data.map((row) => ({
                nodeid: row.nodeid,
                browsename: row.browsename,
                sizeofsubtree: Number(row.sizeofsubtree)
            }))
            .sort((a, b) => b.sizeofsubtree - a.sizeofsubtree),
    });

    const { data: dRows = [] } = useCsvData<MissingInfoRow[]>({
        csv: missingDescriptionsCsv,
        select: (data: MissingInfoRow[]): MissingInfoRow[] =>
            data.map((row) => ({
                browsename: row.browsename,
                nodeid: row.nodeid,
            }))
            .sort((a, b) => a.browsename.localeCompare(b.browsename)),
    });

    const { data: eRows = [] } = useCsvData<MissingInfoRow[]>({
        csv: eventNotifierCsv,
        select: (data: MissingInfoRow[]): MissingInfoRow[] =>
            data.map((row) => ({
                browsename: row.browsename,
                nodeid: row.nodeid,
            }))
            .sort((a, b) => a.browsename.localeCompare(b.browsename)),
    });

    const { data: aRows = [] } = useCsvData<AccessLevelRow[]>({
        csv: accessLevelCsv,
        select: (data: AccessLevelRow[]): AccessLevelRow[] =>
            data.map((row) => ({
                browsename: row.browsename,
                nodeid: row.nodeid,
                accesslevel: row.accesslevel,
            }))
            .sort((a, b) => a.browsename.localeCompare(b.browsename)),
    });


    if (rows.length + ootRows.length + dRows.length + eRows.length + aRows.length === 0) {
        return null;
    }
    return(
        <Accordion.Root multiple>
            {rows.length>0 ? (
            <Accordion.Item value="missing-categories">
                <Accordion.ItemTrigger>
                    Types without Category ({rows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>

                <Accordion.ItemContent>
                    <Text {...S.inconsistenciesDescription}>Consider at least one Conformance Unit for each type node.</Text>
                    <MissingInfoTable rows={rows} />
                </Accordion.ItemContent>
            </Accordion.Item>
            ) : (
                <Accordion.Item value="missing-categories" disabled= {true}>
                <Accordion.ItemTrigger>
                    Types without Category ({rows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
            </Accordion.Item>
            )}
            {ootRows.length>0 ? (
            <Accordion.Item value="out-of-types">
                <Accordion.ItemTrigger>
                    Inaccessible Instances ({ootRows.length} - total {ootRows.reduce((sum, row) => sum + row.sizeofsubtree,0) + ootRows.length} Nodes affected)
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                    <Text {...S.inconsistenciesDescription}>These nodes seem to be unreferenced. If aggregated nodes are listed, they are the root of a unreferenced hierarchy.</Text>
                    <OutOfTypesTable rows={ootRows} />
                </Accordion.ItemContent>
            </Accordion.Item>
            ) : (
                <Accordion.Item value="out-of-types" disabled= {true}>
                <Accordion.ItemTrigger>
                    Inaccessible Instances ({ootRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
            </Accordion.Item>
            )}
            {dRows.length>0 ? (
            <Accordion.Item value="missing-descriptions">
                <Accordion.ItemTrigger>
                    Nodes without Description ({dRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>

                <Accordion.ItemContent>
                    <Text {...S.inconsistenciesDescription}>Consider a description for each node.</Text>
                    <MissingInfoTable rows={dRows} />
                </Accordion.ItemContent>
            </Accordion.Item>
            ) : (
                <Accordion.Item value="missing-descriptions" disabled= {true}>
                <Accordion.ItemTrigger>
                    Nodes without Description ({dRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
            </Accordion.Item>
            )}
            {eRows.length>0 ? (
            <Accordion.Item value="event-notifier">
                <Accordion.ItemTrigger>
                    InstanceDeclarations with EventNotifier ({eRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>

                <Accordion.ItemContent>
                    <Text {...S.inconsistenciesDescription}>Technically the Attribute is valid for the node itself. Does this node support to subscribe to events?</Text>
                    <MissingInfoTable rows={eRows} />
                </Accordion.ItemContent>
            </Accordion.Item>
            ) : (
                <Accordion.Item value="event-notifier" disabled= {true}>
                <Accordion.ItemTrigger>
                    InstanceDeclarations with EventNotifier ({eRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
            </Accordion.Item>
            )}
            {aRows.length>0 ? (
            <Accordion.Item value="access-level">
                <Accordion.ItemTrigger>
                    InstanceDeclarations with AccessLevel != read ({aRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>

                <Accordion.ItemContent>
                    <Text {...S.inconsistenciesDescription}>Technically the Attribute is valid for the node itself. Does this node support writing/history?</Text>
                    <AccessLevelTable rows={aRows} />
                </Accordion.ItemContent>
            </Accordion.Item>
            ) : (
                <Accordion.Item value="access-level" disabled= {true}>
                <Accordion.ItemTrigger>
                    InstanceDeclarations with AccessLevel != read ({aRows.length})
                    <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
            </Accordion.Item>
            )}
        </Accordion.Root>
    )
}

export default InconsistencyDetails
