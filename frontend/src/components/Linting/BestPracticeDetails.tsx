import { Accordion, Box, Heading } from "@chakra-ui/react";
import { LintingResultsProps, NamingRuleGroup, NamingRuleRow } from "./types";
import { useCsvData } from "../Metrics/NodeCountChart";
import DetailsTable from "./Table";

function NamingRuleDetails({csv,}:{csv:string}){

    const { data: rows = [] } = useCsvData<NamingRuleRow[]>({
    csv,
    select: (data: NamingRuleRow[]) : NamingRuleRow[] =>
        data.map(row => ({
            message: row.message,
            browsename: row.browsename,
            nodeid: row.nodeid,
        })),
});

    const groups = groupNamingRules(rows);

    return(
        <>
        <Heading size="md" >Naming Rules</Heading>
        <Accordion.Root multiple>
    {groups.map((group) => (
        <Accordion.Item
            key={group.rule}
            value={group.rule}
        >
            <Accordion.ItemTrigger>
                {group.rule} ({group.rows.length})
            </Accordion.ItemTrigger>

            <Accordion.ItemContent>
                <NamingRuleTable rows={group.rows} />
            </Accordion.ItemContent>
        </Accordion.Item>
    ))}
</Accordion.Root>
</>
    )
}

function NamingRuleTable({rows,}:{rows: NamingRuleRow[]})
{
return(
<DetailsTable
    rows={rows}
    columns={[
        {
            header: "Message",
            accessor: (r) => r.message,
        },
        {
            header: "BrowseName",
            accessor: (r) => r.browsename,
        },
        {
            header: "NodeId",
            accessor: (r) => r.nodeid,
        },
    ]}
/>
)
}

function groupNamingRules(rows: NamingRuleRow[]): NamingRuleGroup[] {
    const grouped = new Map<string, NamingRuleRow[]>();

    rows.forEach(row => {
        const rule = getRule(row.message);

        if (!grouped.has(rule)) {
            grouped.set(rule, []);
        }

        grouped.get(rule)!.push(row);
    });

    return [...grouped.entries()].map(([rule, rows]) => ({
        rule,
        rows,
    }));
}

function getRule(message: string): string {
    return message.replace(/ but is .*/, "");
}

export function BestPracticeDetails({element}: LintingResultsProps){
    const namingRulesCsv = element.csv_files.find(
        (f) => f.filename.endsWith('NamingRules.csv')
    )?.content ?? "";
    
    return(
        <Box>
            <NamingRuleDetails csv={namingRulesCsv} />
        </Box>
    )
}