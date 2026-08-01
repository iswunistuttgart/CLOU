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

import { Box, Heading, Text, chakra } from '@chakra-ui/react'
import { styles as S } from './styles'

const Td = chakra('td')

type DefinitionBlock =
  | { type: 'heading'; text: string }
  | { type: 'caption'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] }

interface FormattedDefinitionProps {
  text?: string | null
}

function splitCsvLine(line: string): string[] | null {
  const trimmed = line.trim()

  if (!trimmed.includes(',')) return null

  if (/^,+$/.test(trimmed)) return null

  const cols = trimmed.split(',').map(col => col.trim())
  const nonEmptyCols = cols.filter(Boolean)

  if (nonEmptyCols.length < 2) return null

  return cols
}

function isKnownTableHeader(cols: string[]): boolean {
  const first = cols[0]?.trim().toLowerCase()

  return (
    first === 'attribute' ||
    first === 'references' ||
    first === 'source path' ||
    first === 'sourcebrowsepath' ||
    first === 'source browse path'
  )
}

function parseDefinition(text?: string | null): DefinitionBlock[] {
  if (!text?.trim()) return []

  const lines = text.split(/\r?\n/)

  const blocks: DefinitionBlock[] = []

  let paragraphLines: string[] = []
  let tableRows: string[][] = []
  let listItems: string[] = []
  let inConformanceUnits = false
  let expectTableHeader = false

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return

    const paragraph = paragraphLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (paragraph) {
      blocks.push({
        type: 'paragraph',
        text: paragraph,
      })
    }

    paragraphLines = []
  }

  const flushTable = () => {
    if (tableRows.length === 0) return

    blocks.push({
      type: 'table',
      rows: tableRows,
    })

    tableRows = []
  }

  const flushList = () => {
    if (listItems.length === 0) return

    blocks.push({
      type: 'list',
      items: listItems,
    })

    listItems = []
  }

  const flushAll = () => {
    flushParagraph()
    flushTable()
    flushList()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushAll()
      inConformanceUnits = false
      continue
    }

    if (/^,+$/.test(line)) {
      continue
    }

    if (/^\d+(\.\d+)*\s+.+/.test(line)) {
      flushAll()
      inConformanceUnits = false
      expectTableHeader = false

      blocks.push({
        type: 'heading',
        text: line,
      })

      continue
    }

    // Figure-Zeilen ignorieren (Bilder sind im Markdown nicht vorhanden)
    if (/^(\[Figure:|Figure\s+\d+\s*-)/i.test(line)) {
      flushAll()
      inConformanceUnits = false
      expectTableHeader = false
      continue
    }

    if (/^Table\s+\d+\s*-/i.test(line)) {
      flushAll()
      inConformanceUnits = false
      expectTableHeader = true

      blocks.push({
        type: 'caption',
        text: line,
      })

      continue
    }

    if (/^Conformance Units$/i.test(line)) {
      flushAll()
      inConformanceUnits = true
      expectTableHeader = false

      blocks.push({
        type: 'subheading',
        text: line,
      })

      continue
    }

    if (inConformanceUnits) {
      flushParagraph()
      flushTable()

      listItems.push(line)
      continue
    }

    // WICHTIG: "Subtype of ..."-Check VOR dem CSV-Check,
    // damit diese Zeilen (mit Kommas, ggf. in Anführungszeichen) nicht zerteilt werden.
    if (/^"?\s*Subtype of\b/i.test(line)) {
      // Umschließende Anführungszeichen entfernen
      const cleaned = line.replace(/^"(.*)"$/, '$1').trim()

      if (tableRows.length > 0) {
        // Gehört als spannende Zeile zur laufenden Tabelle
        tableRows.push([cleaned])
      } else {
        // Keine Tabelle vorhanden -> als Absatz rendern
        flushList()
        expectTableHeader = false
        paragraphLines.push(cleaned)
      }
      continue
    }

    const csvCols = splitCsvLine(line)

    if (csvCols) {
      const startsNewKnownTable =
        isKnownTableHeader(csvCols) || expectTableHeader

      if (tableRows.length === 0 && !startsNewKnownTable) {
        paragraphLines.push(line)
        continue
      }

      flushParagraph()
      flushList()

      const isNewHeader = isKnownTableHeader(csvCols) || expectTableHeader

      if (tableRows.length > 0 && isNewHeader) {
        flushTable()
      }

      if (
        tableRows.length > 0 &&
        !isNewHeader &&
        csvCols.length !== tableRows[0].length
      ) {
        flushTable()
      }

      tableRows.push(csvCols)

      expectTableHeader = false
      continue
    }

    flushTable()
    flushList()
    expectTableHeader = false

    paragraphLines.push(line)
  }

  flushAll()

  return blocks
}

function InlineText({ text }: { text: string }) {
  return <>{text}</>
}

export function FormattedDefinition({ text }: FormattedDefinitionProps) {
  if (!text?.trim()) return null

  const blocks = parseDefinition(text)

  if (blocks.length === 0) {
    return (
      <Text {...S.descText} whiteSpace="pre-wrap">
        {text}
      </Text>
    )
  }

  return (
    <Box>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Heading
              key={index}
              as="h3"
              fontSize="lg"
              fontWeight="semibold"
              color="gray.900"
              mt={index === 0 ? 0 : 5}
              mb={3}
            >
              <InlineText text={block.text} />
            </Heading>
          )
        }

        if (block.type === 'caption') {
          return (
            <Text
              key={index}
              fontSize="sm"
              fontWeight="semibold"
              color="gray.800"
              mt={5}
              mb={2}
            >
              <InlineText text={block.text} />
            </Text>
          )
        }

        if (block.type === 'subheading') {
          return (
            <Heading
              key={index}
              as="h4"
              fontSize="sm"
              fontWeight="semibold"
              color="gray.800"
              mt={4}
              mb={2}
            >
              <InlineText text={block.text} />
            </Heading>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <Text key={index} {...S.descText} mb={3} lineHeight="1.7">
              <InlineText text={block.text} />
            </Text>
          )
        }

        if (block.type === 'list') {
          return (
            <Box key={index} as="ul" pl={5} mb={4}>
              {block.items.map((item, itemIndex) => (
                <Box
                  key={itemIndex}
                  as="li"
                  color="gray.700"
                  fontSize="sm"
                  mb={1}
                  lineHeight="1.6"
                >
                  {item}
                </Box>
              ))}
            </Box>
          )
        }

        if (block.type === 'table') {
          const [header, ...rows] = block.rows
          const columnCount = header.length

          return (
            <Box
              key={index}
              overflowX="auto"
              my={4}
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
            >
              <Box
                as="table"
                width="100%"
                borderCollapse="collapse"
                fontSize="sm"
              >
                <Box as="thead">
                  <Box as="tr">
                    {header.map((cell, cellIndex) => (
                      <Box
                        key={cellIndex}
                        as="th"
                        textAlign="left"
                        px={3}
                        py={2}
                        borderBottomWidth="1px"
                        borderRightWidth={
                          cellIndex < header.length - 1 ? '1px' : '0'
                        }
                        borderColor="gray.200"
                        bg="gray.50"
                        fontWeight="semibold"
                        color="gray.800"
                        verticalAlign="top"
                        whiteSpace="nowrap"
                      >
                        {cell}
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box as="tbody">
                  {rows.map((row, rowIndex) => {
                    const isSpanningRow = row.length === 1 && columnCount > 1

                    return (
                      <Box key={rowIndex} as="tr">
                        {isSpanningRow ? (
                          <Td
                            colSpan={columnCount}
                            px={3}
                            py={2}
                            borderBottomWidth={
                              rowIndex < rows.length - 1 ? '1px' : '0'
                            }
                            borderColor="gray.200"
                            color="gray.700"
                            fontStyle="italic"
                            bg="white"
                            verticalAlign="top"
                          >
                            {row[0]}
                          </Td>
                        ) : (
                          header.map((_, cellIndex) => (
                            <Box
                              key={cellIndex}
                              as="td"
                              px={3}
                              py={2}
                              borderBottomWidth={
                                rowIndex < rows.length - 1 ? '1px' : '0'
                              }
                              borderRightWidth={
                                cellIndex < header.length - 1 ? '1px' : '0'
                              }
                              borderColor="gray.200"
                              color="gray.700"
                              verticalAlign="top"
                              bg="white"
                            >
                              {row[cellIndex] ?? ''}
                            </Box>
                          ))
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            </Box>
          )
        }

        return null
      })}
    </Box>
  )
}