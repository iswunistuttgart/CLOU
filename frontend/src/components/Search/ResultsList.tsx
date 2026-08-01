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


import { Box, Card, Flex, Text, Badge, Heading } from '@chakra-ui/react'
import { styles as S } from './styles'
import { getNodeIcon } from './iconUtils'
import type { OPCUAElement } from './types'

interface ResultsListProps {
  results: OPCUAElement[]
  selectedElement: OPCUAElement | null
  onSelectElement: (element: OPCUAElement) => void
}

export function ResultsList({ results, selectedElement, onSelectElement }: ResultsListProps) {
  const selectedNodeId = selectedElement?.node.id
  const isSelectedOutsideResults =
    selectedElement !== null &&
    !results.some((element) => element.node.id === selectedNodeId)

  if (results.length === 0 && !isSelectedOutsideResults) {
    return (
      <Flex align="center" justify="center" bg="white" p={8} h="full">
        <Box textAlign="center">
          <Text color="gray.400" fontSize="sm">
            No results found. Try searching for an OPC UA element.
          </Text>
        </Box>
      </Flex>
    )
  }


  return (
  <Flex gap={3} flexDirection="column">
    {isSelectedOutsideResults && selectedElement && (() => {
      const node = selectedElement.node
      const Icon = getNodeIcon(node.node_class.node_class)

      return (
        <Card.Root
          key={`selected-node-${node.id}`}
          {...S.resultCardPinnedRoot}
          onClick={() => onSelectElement(selectedElement)}
        >
          <Card.Body {...S.resultCardBody}>
            <Flex {...S.resultCardRow}>
              <Box {...S.resultCardIcon(true)} color="teal.600">
                <Icon size={20} />
              </Box>

              <Box {...S.resultCardContentCol}>
                <Flex justify="space-between" align="center" gap={2} mb={2}>
                  <Badge {...S.resultCardPinnedLabel}>Current node</Badge>
                  <Badge {...S.resultCardTypeBadge}>
                    {node.node_class.node_class}
                  </Badge>
                </Flex>

                <Flex {...S.resultCardTitleRow}>
                  <Heading {...S.resultCardTitle(true)} color="teal.700">
                    {node.display_name}
                  </Heading>
                </Flex>

                <Text {...S.resultCardDesc} color="teal.800">
                  This node is currently selected but is not part of the active search results.
                </Text>

                <Badge {...S.resultCardSpecBadge}>
                  {node.spec.name_long}
                </Badge>
              </Box>
            </Flex>
          </Card.Body>
        </Card.Root>
      )
    })()}

    {results.length === 0 && isSelectedOutsideResults && (
      <Flex align="center" justify="center" bg="white" p={4}>
        <Box textAlign="center">
          <Text color="gray.400" fontSize="sm">
            No matching results in the current search. The selected node is shown above.
          </Text>
        </Box>
      </Flex>
    )}

    {results.map((element) => {
      const node = element.node
      const isSelected = selectedElement?.node.id === node.id
      const Icon = getNodeIcon(node.node_class.node_class)

      return (
        <Card.Root
          key={node.id}
          {...S.resultCardRoot(isSelected)}
          onClick={() => onSelectElement(element)}
        >
          <Card.Body {...S.resultCardBody}>
            <Flex {...S.resultCardRow}>
              <Box {...S.resultCardIcon(isSelected)}>
                <Icon size={20} />
              </Box>

              <Box {...S.resultCardContentCol}>
                <Flex {...S.resultCardTitleRow}>
                  <Heading {...S.resultCardTitle(isSelected)}>
                    {node.display_name}
                  </Heading>
                  <Badge {...S.resultCardTypeBadge}>
                    {node.node_class.node_class}
                  </Badge>
                </Flex>

                <Text {...S.resultCardDesc}>
                    {node.description && node.description.length > 140 ? node.description.slice(0, 140).trimEnd() + '...' : node.description}
                </Text>

                <Badge {...S.resultCardSpecBadge}>
                  {node.spec.name_long}
                </Badge>
              </Box>
            </Flex>
          </Card.Body>
        </Card.Root>
      )
    })}
  </Flex>
)
}
