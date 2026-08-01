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


import { Box, Card, Flex, Text, Button, Badge, Heading, Link } from '@chakra-ui/react'
import { styles as S } from './styles'
import { LuFileCode, LuExternalLink, LuBookOpen, LuCode, LuMapPin, LuScrollText } from 'react-icons/lu'
import { getNodeIcon } from './iconUtils'
import type { OPCUAElement, OPCUANode } from './types'
import { CopyButton } from './CopyButton'
import { useState } from 'react'
import { FormattedDefinition } from './FormattedDefinition'

interface DetailPanelProps {
  selectedElement: OPCUAElement | null
}

export function DetailPanel({ selectedElement }: DetailPanelProps) {
  if (!selectedElement) {
    return (
      <Flex align="center" justify="center" bg="white" h="full">
        <Box textAlign="center">
          <Box color="gray.300" mx="auto" mb={4} display="flex" justifyContent="center">
            <LuFileCode size={64} />
          </Box>
          <Heading as="h3" fontSize="lg" fontWeight="medium" color="gray.900" mb={2}>
            Select an element to view details
          </Heading>
          <Text color="gray.500" maxW="md" fontSize="sm">
            Choose an OPC UA element from the search results to see its full specification, usage examples, and related information
          </Text>
        </Box>
      </Flex>
    )
  }

  const node: OPCUANode = selectedElement.node;
  // Select icon based on node type
  const Icon = getNodeIcon(node.node_class.node_class)

  const specVerStr = node?.spec?.version != null ? String(node.spec.version) : '';
  const nodesetVerStr = node?.nodeset?.version != null ? String(node.nodeset.version) : '';

  let latestVersion: string | null = null;
  if (specVerStr && nodesetVerStr) {
    latestVersion =
      parseFloat(specVerStr) >= parseFloat(nodesetVerStr) ? specVerStr : nodesetVerStr;
  } else {
    latestVersion = specVerStr || nodesetVerStr || null;
  }


  const parent = (node as any)?.parent ?? null
  const typeDef = (node as any)?.typedefinition ?? null
  const children = Array.isArray(node.children) ? node.children : []
  const [showAllChildren, setShowAllChildren] = useState(false)
  const typedefOf = Array.isArray(node.typedefinition_of) ? node.typedefinition_of : []
  const [showAllTypedefOf, setShowAllTypedefOf] = useState(false)

  const getNodeIdPart = (expanded?: string) => {
    if (!expanded) return '—'
    const parts = expanded.split(';')
    return parts.length > 1 ? parts[1] : expanded
  }

  return (
    <Box {...S.detailContainer}>
      <Box {...S.detailHeaderWrap}>
        <Flex {...S.detailHeaderRow}>
          <Box {...S.detailIconBox}>
            <Icon size={32} color="var(--chakra-colors-blue-500)" />
          </Box>
          <Box {...S.detailTitleCol}>
            <Flex {...S.detailTitleRow}>
              <Heading {...S.detailTitle}>
                {node.display_name}
              </Heading>
              <Badge {...S.detailBadge}>
                {node.node_class.node_class}
              </Badge>
            </Flex>
            <Flex>
              <Text {...S.descText}>
                {node.spec.number} {node.nodeset.name_short}
              </Text>
              {node.documentation && (
                   <Link
                    {...S.detailLink}
                    ml={3}
                    href={node.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Text>View Resource</Text>
                    <LuExternalLink size={16} />
                  </Link>
              )}
            </Flex>
          </Box>
        </Flex>
      </Box>

      <Flex flexDirection="column" gap={4}>
        <Card.Root {...S.cardRoot}>
          <Card.Body {...S.cardBody}>
            <Flex {...S.sectionHeaderSm}>
              <Box {...S.sectionIcon}>
                <LuBookOpen size={18} />
              </Box>
              <Heading {...S.sectionTitle}>
                Description
              </Heading>
            </Flex>
            <Text {...S.descText}>
              {node.description}
            </Text>
            <Text {...S.descText}>
              <FormattedDefinition text={node.definition} />
            </Text>
          </Card.Body>
        </Card.Root>

        <Card.Root {...S.cardRoot}>
          <Card.Body {...S.cardBody}>
            <Flex {...S.sectionHeaderLg}>
              <Box {...S.sectionIcon}>
                <LuCode size={18} />
              </Box>
              <Heading {...S.sectionTitle}>
                Further Information
              </Heading>
            </Flex>
            <Box {...S.gridTwoCols}>
              <Box>
                <Text {...S.label}>Display Name</Text>
                <Flex {...S.value} align="center" gap={2}>
                  <Text flex="1">
                    {node.display_name}
                  </Text>
                  <CopyButton value={node.display_name} />
                </Flex>
              </Box>
              <Box>
                <Text {...S.label}>NodeId</Text>
                <Flex {...S.value} align="center" gap={2}>
                  <Text flex="1">
                    {node.expanded_node_id.split(';')[1]}
                  </Text>
                  <CopyButton value={node.expanded_node_id.split(';')[1]} />
                </Flex>
              </Box>
            </Box>
            <Box {...S.gridTwoCols}>
              <Box>
                <Text {...S.label}>Node Class</Text>
                <Text {...S.value}>
                  {node.node_class.node_class}
                </Text>
              </Box>
              {node.data_type && (
                <Box>
                  <Text {...S.label}>Data Type</Text>
                  <Text {...S.value}>
                    {node.data_type.display_name}
                  </Text>
                </Box>
              )}

            </Box>
          </Card.Body>
        </Card.Root>

        <Card.Root {...S.cardRoot}>
          <Card.Body {...S.cardBody}>
            <Flex {...S.sectionHeaderLg}>
              <Box {...S.sectionIcon}>
                <LuMapPin size={18} />
              </Box>
              <Heading {...S.sectionTitle}>
                Structure and References
              </Heading>
            </Flex>

            <Box {...S.gridTwoCols}>
              {parent && (
                <>
                  <Box>
                    <Text {...S.label}>Parent</Text>
                    <Flex {...S.value} align="center" gap={2}>
                      <Text flex="1">
                        {parent.display_name ?? parent.expanded_node_id ?? String(parent.id)}
                      </Text>
                      <CopyButton value={parent.display_name ?? parent.expanded_node_id ?? String(parent.id)} />
                    </Flex>
                  </Box>
                  <Box>
                    <Text {...S.label}>Parent NodeId</Text>
                    <Flex {...S.value} align="center" gap={2}>
                      <Text flex="1">
                        {`${parent.spec?.name_short ?? ''} · ${getNodeIdPart(parent.expanded_node_id)}`}
                      </Text>
                      {parent.expanded_node_id && (
                        <CopyButton value={getNodeIdPart(parent.expanded_node_id)} />
                      )}
                    </Flex>
                  </Box>
                </>
              )}

              {typeDef && (
                <>
                  <Box>
                    <Text {...S.label}>TypeDefinition</Text>
                    <Flex {...S.value} align="center" gap={2}>
                      <Text flex="1">
                        {typeDef.display_name ?? typeDef.expanded_node_id ?? String(node.typedefinition_id)}
                      </Text>
                      <CopyButton value={typeDef.display_name ?? typeDef.expanded_node_id ?? String(node.typedefinition_id)} />
                    </Flex>
                  </Box>
                  <Box>
                    <Text {...S.label}>TypeDefinition NodeId</Text>
                    <Flex {...S.value} align="center" gap={2}>
                      <Text flex="1">
                        {`${typeDef.spec?.name_short ?? ''} · ${getNodeIdPart(typeDef.expanded_node_id)}`}
                      </Text>
                      {typeDef.expanded_node_id && (
                        <CopyButton value={getNodeIdPart(typeDef.expanded_node_id)} />
                      )}
                    </Flex>
                  </Box>
                </>
              )}
            </Box>


<Box mt={4}>
  <Text {...S.label}>Children</Text>

  {children.length > 0 ? (
    <>
      <Box
        mt={1}
        bg="gray.50"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="md"
        p={2}
      >
        <Flex direction="column">
          {(showAllChildren ? children : children.slice(0, 8)).map((child, idx) => (
            <Flex
              key={child.id ?? child.expanded_node_id}
              align="center"
              gap={3}
              py={2}
              borderTopWidth={idx === 0 ? 0 : '1px'}
              borderColor="gray.200"
            >
              <Text flex="1" minW={0} {...S.value}>
                {child.display_name ?? child.expanded_node_id ?? String(child.id)}
              </Text>

              {child.node_class?.node_class && (
                <Badge colorScheme="gray" flexShrink={0}>
                  {child.node_class.node_class}
                </Badge>
              )}

              <Box
                flexShrink={0}
                color="gray.600"
                fontSize="sm"
                fontFamily="mono"
                whiteSpace="nowrap"
              >
                {(child.spec?.name_short ? `${child.spec.name_short} · ` : '') + getNodeIdPart(child.expanded_node_id)}
              </Box>

              <CopyButton value={child.display_name} />
            </Flex>
          ))}
        </Flex>


      </Box>
      {children.length > 8 && (
          <Flex justify="flex-end">
            <Button
              mt={2}
              size="sm"
              variant="ghost"
              onClick={() => setShowAllChildren((v) => !v)}
            >
              {showAllChildren ? 'Show less' : `Show all (${children.length})`}
            </Button>
          </Flex>
        )}
    </>
  ) : (
    <Text color="gray.500" fontSize="sm" mt={1}>
      No Children found.
    </Text>
  )}
</Box>

<Box mt={4}>
  <Text {...S.label}>TypeDefinition of (Instances)</Text>

  {typedefOf.length > 0 ? (
    <>
      <Box
        mt={1}
        bg="gray.50"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="md"
        p={2}
      >
        <Flex direction="column">
          {(showAllTypedefOf ? typedefOf : typedefOf.slice(0, 8)).map((inst, idx) => (
            <Flex
              key={inst.id ?? inst.expanded_node_id}
              align="center"
              gap={3}
              py={2}
              borderTopWidth={idx === 0 ? 0 : '1px'}
              borderColor="gray.200"
            >
              <Text flex="1" minW={0} {...S.value}>
                {inst.display_name ?? inst.expanded_node_id ?? String(inst.id)}
              </Text>
              <Box
                flexShrink={0}
                color="gray.600"
                fontSize="sm"
                fontFamily="mono"
                whiteSpace="nowrap"
              >
                {(inst.spec?.name_short ? `${inst.spec.name_short} · ` : '') + getNodeIdPart(inst.expanded_node_id)}
              </Box>
              <CopyButton value={inst.display_name} />
            </Flex>
          ))}
        </Flex>


      </Box>
       {typedefOf.length > 8 && (
          <Flex justify="flex-end">
            <Button
              mt={2}
              size="sm"
              variant="ghost"
              onClick={() => setShowAllTypedefOf((v) => !v)}
            >
              {showAllTypedefOf ? 'Show less' : `Show all (${typedefOf.length})`}
            </Button>
          </Flex>
        )}
    </>
  ) : (
    <Text color="gray.500" fontSize="sm" mt={1}>
      No instances found.
    </Text>
  )}
</Box>
          </Card.Body>
        </Card.Root>

        <Card.Root {...S.cardRoot}>
          <Card.Body {...S.cardBody}>
            <Flex {...S.sectionHeaderLg}>
              <Box {...S.sectionIcon}>
                <LuScrollText size={18} />
              </Box>
              <Heading {...S.sectionTitle}>
                Specification
              </Heading>
            </Flex>
            <Box {...S.gridTwoCols}>
              <Box>
                <Text {...S.label}>Document Number</Text>
                <Text {...S.value}>
                  {node.spec.number}
                </Text>
              </Box>
              <Box>
                <Text {...S.label}>Name</Text>
                <Text {...S.value}>
                  {node.spec.name_long}
                </Text>
              </Box>
              <Box>
                <Text {...S.label}>Version</Text>
                {latestVersion && (
                  <Text {...S.value}>
                    {latestVersion}
                  </Text>
                )}
              </Box>
              <Box>
                <Text {...S.label}>Release Date</Text>
                <Text {...S.value}>
                  {node.spec.release_date}
                </Text>
              </Box>
            </Box>
          </Card.Body>
        </Card.Root>
      </Flex>
    </Box>
  )
}
