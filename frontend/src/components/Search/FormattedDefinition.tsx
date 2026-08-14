/* Copyright 2026 Fraunhofer-Gesellschaft zur Förderung der
 * angewandten Forschung e.V. and Universität Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

/**
 * Fügt physische Textzeilen zusammen, wenn sich ein CSV-Feld
 * über mehrere Zeilen erstreckt.
 *
 * Beispiel:
 *
 * "PumpKickTimeDifference
 * 0:EngineeringUnits",NamespaceUri: ...
 */
function splitLogicalLines(text: string): string[] {
  const physicalLines = text.split(/\r?\n/)
  const logicalLines: string[] = []

  let currentLine = ''
  let insideQuotes = false

  for (const physicalLine of physicalLines) {
    currentLine = currentLine
      ? `${currentLine}\n${physicalLine}`
      : physicalLine

    for (let index = 0; index < physicalLine.length; index += 1) {
      if (physicalLine[index] !== '"') {
        continue
      }

      /*
       * Zwei Anführungszeichen innerhalb eines CSV-Feldes
       * repräsentieren ein einzelnes Anführungszeichen.
       */
      if (insideQuotes && physicalLine[index + 1] === '"') {
        index += 1
        continue
      }

      insideQuotes = !insideQuotes
    }

    if (!insideQuotes) {
      logicalLines.push(currentLine)
      currentLine = ''
    }
  }

  /*
   * Auch eine fehlerhafte letzte Zeile mit nicht geschlossenem
   * Anführungszeichen soll nicht verloren gehen.
   */
  if (currentLine) {
    logicalLines.push(currentLine)
  }

  return logicalLines
}

/**
 * Zerlegt eine CSV-Zeile, ohne Kommas innerhalb von
 * Anführungszeichen als Trennzeichen zu behandeln.
 */
function splitCsvLine(line: string): string[] | null {
  const trimmed = line.trim()

  if (!trimmed || !trimmed.includes(',') || /^,+$/.test(trimmed)) {
    return null
  }

  const columns: string[] = []

  let currentColumn = ''
  let insideQuotes = false
  let containsDelimiter = false

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index]

    if (character === '"') {
      if (insideQuotes && trimmed[index + 1] === '"') {
        currentColumn += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }

      continue
    }

    if (character === ',' && !insideQuotes) {
      columns.push(currentColumn.trim())
      currentColumn = ''
      containsDelimiter = true
      continue
    }

    currentColumn += character
  }

  if (!containsDelimiter) {
    return null
  }

  columns.push(currentColumn.trim())

  const nonEmptyColumns = columns.filter(
    column => column.trim().length > 0,
  )

  if (nonEmptyColumns.length < 2) {
    return null
  }

  return columns
}

/**
 * Erkennt Tabellenköpfe, damit mehrere Tabellenbereiche nach einer
 * gemeinsamen Beschriftung getrennt dargestellt werden können.
 *
 * Das ist insbesondere für Tabelle 67 notwendig:
 *
 * 1. Attribute / Value
 * 2. References / Node Class / BrowseName / ...
 */
function isKnownTableHeader(columns: string[]): boolean {
  const normalizedColumns = columns.map(column =>
    column.trim().toLowerCase().replace(/\s+/g, ' '),
  )

  const firstColumn = normalizedColumns[0]

  return (
    firstColumn === 'attribute' ||
    firstColumn === 'references' ||
    firstColumn === 'browsepath' ||
    firstColumn === 'browse path' ||
    firstColumn === 'source path' ||
    firstColumn === 'sourcebrowsepath' ||
    firstColumn === 'source browse path' ||
    (normalizedColumns.includes('value attribute') &&
      normalizedColumns.includes('description'))
  )
}

/**
 * Entfernt umschließende Anführungszeichen und wandelt doppelte
 * CSV-Anführungszeichen in normale Anführungszeichen um.
 */
function cleanQuotedText(value: string): string {
  let cleaned = value.trim()

  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
  }

  return cleaned.replace(/""/g, '"').trim()
}

function parseDefinition(text?: string | null): DefinitionBlock[] {
  if (!text?.trim()) {
    return []
  }

  const lines = splitLogicalLines(text)
  const blocks: DefinitionBlock[] = []

  let paragraphLines: string[] = []
  let tableRows: string[][] = []
  let listItems: string[] = []

  let inConformanceUnits = false
  let expectTableHeader = false

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return
    }

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
    if (tableRows.length === 0) {
      return
    }

    blocks.push({
      type: 'table',
      rows: tableRows,
    })

    tableRows = []
  }

  const flushList = () => {
    if (listItems.length === 0) {
      return
    }

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
      expectTableHeader = false
      continue
    }

    /*
     * Zeilen, die ausschließlich aus Kommas bestehen, ignorieren.
     */
    if (/^,+$/.test(line)) {
      continue
    }

    /*
     * Überschriften wie:
     * 7.30 PumpKickObjectType ObjectType Definition
     */
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

    /*
     * Figure-Zeilen ignorieren, da die zugehörigen Bilder
     * nicht Teil des übergebenen Textes sind.
     */
    if (/^(\[Figure:|Figure\s+\d+\s*-)/i.test(line)) {
      flushAll()

      inConformanceUnits = false
      expectTableHeader = false

      continue
    }

    /*
     * Tabellenbeschriftungen wie:
     * Table 67 - PumpKickObjectType Definition
     */
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

    /*
     * "Subtype of ..." muss vor dem normalen CSV-Parsing behandelt
     * werden. Die enthaltenen Kommas gehören zum Text und nicht zu
     * weiteren Tabellenzellen.
     */
    if (/^"+\s*Subtype of\b/i.test(line) || /^Subtype of\b/i.test(line)) {
      const cleaned = cleanQuotedText(line)

      flushParagraph()
      flushList()

      if (tableRows.length > 0) {
        /*
         * Eine Zeile mit nur einer Zelle wird beim Rendern automatisch
         * über alle Spalten der Tabelle gespannt.
         */
        tableRows.push([cleaned])
      } else {
        expectTableHeader = false
        paragraphLines.push(cleaned)
      }

      continue
    }

    const csvColumns = splitCsvLine(line)

    if (csvColumns) {
      const knownHeader = isKnownTableHeader(csvColumns)
      const startsNewTable = knownHeader || expectTableHeader

      /*
       * CSV-artige Zeilen außerhalb einer erwarteten oder bereits
       * laufenden Tabelle werden weiterhin als Text behandelt.
       */
      if (tableRows.length === 0 && !startsNewTable) {
        paragraphLines.push(line)
        continue
      }

      flushParagraph()
      flushList()

      /*
       * Beginnt innerhalb einer laufenden Tabelle ein neuer bekannter
       * Tabellenkopf, wird ein neuer Tabellenbereich erzeugt.
       *
       * Beispiel Tabelle 67:
       * - Attribute, Value
       * - References, Node Class, BrowseName, ...
       */
      if (tableRows.length > 0 && knownHeader) {
        flushTable()
      }

      /*
       * Bei einer unerwarteten Änderung der Spaltenanzahl wird ebenfalls
       * eine neue Tabelle begonnen. Bekannte spannende Zeilen wie
       * "Subtype of ..." wurden bereits weiter oben behandelt.
       */
      if (
        tableRows.length > 0 &&
        !knownHeader &&
        csvColumns.length !== tableRows[0].length
      ) {
        flushTable()
      }

      tableRows.push(csvColumns)
      expectTableHeader = false

      continue
    }

    /*
     * Normale Textzeile beendet eine laufende Tabelle oder Liste.
     */
    flushTable()
    flushList()

    expectTableHeader = false
    paragraphLines.push(cleanQuotedText(line))
  }

  flushAll()

  return blocks
}

function InlineText({ text }: { text: string }) {
  return <>{text}</>
}

export function FormattedDefinition({
  text,
}: FormattedDefinitionProps) {
  if (!text?.trim()) {
    return null
  }

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
            <Text
              key={index}
              {...S.descText}
              mb={3}
              lineHeight="1.7"
            >
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
              bg="white"
            >
              <Box
                as="table"
                width="100%"
                minWidth={columnCount >= 5 ? '800px' : undefined}
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
                          cellIndex < header.length - 1
                            ? '1px'
                            : '0'
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
                    const isSpanningRow =
                      row.length === 1 && columnCount > 1

                    const showBottomBorder =
                      rowIndex < rows.length - 1

                    return (
                      <Box key={rowIndex} as="tr">
                        {isSpanningRow ? (
                          <Td
                            colSpan={columnCount}
                            px={3}
                            py={2}
                            borderBottomWidth={
                              showBottomBorder ? '1px' : '0'
                            }
                            borderColor="gray.200"
                            color="gray.700"
                            fontStyle="italic"
                            bg="white"
                            verticalAlign="top"
                            whiteSpace="pre-line"
                            overflowWrap="anywhere"
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
                                showBottomBorder ? '1px' : '0'
                              }
                              borderRightWidth={
                                cellIndex < header.length - 1
                                  ? '1px'
                                  : '0'
                              }
                              borderColor="gray.200"
                              color="gray.700"
                              verticalAlign="top"
                              bg="white"
                              whiteSpace="pre-line"
                              overflowWrap="anywhere"
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