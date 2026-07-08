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


import { Table } from "@chakra-ui/react";

type Column<T> = {
    header: string;
    accessor: (row: T) => React.ReactNode;
};

type DetailsTableProps<T> = {
    rows: T[];
    columns: Column<T>[];
};

export function DetailsTable<T>({
    rows,
    columns,
}: DetailsTableProps<T>) {
    return (
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    {columns.map((column) => (
                        <Table.ColumnHeader
                            key={column.header}
                            fontWeight={"bold"}                            
                        >
                            {column.header}
                        </Table.ColumnHeader>
                    ))}
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {rows.map((row, index) => (
                    <Table.Row key={index}>
                        {columns.map((column) => (
                            <Table.Cell
                                key={column.header}
                            >
                                {column.accessor(row)}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                ))}
            </Table.Body>
        </Table.Root>
    );
}

export default DetailsTable