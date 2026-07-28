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


import { Badge, Box, Button, Card, Flex, Heading, Skeleton, Text } from '@chakra-ui/react'
import { LuCheck, LuChevronDown, LuChevronUp, LuGitCompareArrows, LuPlus, LuTriangle, LuWaypoints } from 'react-icons/lu'
import { useEffect, useMemo, useState } from 'react'
import { styles as S } from './styles'
import type { OPCUAElement, OPCUANode } from './types'
import { getNodeById } from './SearchWindow'

interface OverridesPanelProps {
  selectedElement: OPCUAElement | null
  onSelectNodeById?: (nodeId: number) => void
}

type OverrideStatus = 'override' | 'added' | 'inherited'

interface OverrideItem {
  displayName: string
  status: OverrideStatus
  currentNode?: Partial<OPCUANode>
  ancestorNode?: Partial<OPCUANode>
}

interface ChangeSummary {
  label: string
  currentValue: string
  ancestorValue: string
}

type AnalysisMode = 'type' | 'member'

const TYPE_NODE_CLASSES = new Set(['ObjectType', 'VariableType'])

function isTypeNode(node: Partial<OPCUANode>): boolean {
  const nodeClass = node.node_class?.node_class
  return nodeClass ? TYPE_NODE_CLASSES.has(nodeClass) : false
}

function getNodeIdPart(expandedNodeId?: string): string {
  if (!expandedNodeId) return '—'
  const parts = expandedNodeId.split(';')
  return parts.length > 1 ? parts[1] : expandedNodeId
}

function getDisplayName(node: Partial<OPCUANode>): string | null {
  const raw = node.display_name
  if (typeof raw !== 'string') {
    return null
  }

  const normalized = raw.trim()
  return normalized.length > 0 ? normalized : null
}

function getComponents(node: Partial<OPCUANode>): Partial<OPCUANode>[] {
  const children = Array.isArray(node.children) ? node.children : []
  return children.filter((child) => {
    const nodeClass = child.node_class?.node_class
    return !nodeClass || !TYPE_NODE_CLASSES.has(nodeClass)
  })
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : '—'
  }

  return '—'
}

function getChangeSummary(currentNode?: Partial<OPCUANode>, ancestorNode?: Partial<OPCUANode>): ChangeSummary[] {
  if (!currentNode || !ancestorNode) {
    return []
  }

  console.log('Current Node:', currentNode)
  console.log('Ancestor Node:', ancestorNode) 

  const comparisons: Array<{ label: string; current: unknown; ancestor: unknown }> = [
    { label: 'Description', current: currentNode.description, ancestor: ancestorNode.description },
    { label: 'Definition', current: currentNode.definition, ancestor: ancestorNode.definition },
    { label: 'Documentation', current: currentNode.documentation, ancestor: ancestorNode.documentation },
    { label: 'Node type', current: currentNode.node_class?.node_class, ancestor: ancestorNode.node_class?.node_class },
    { label: 'Data type', current: currentNode.data_type?.display_name ?? currentNode.data_type?.id, ancestor: ancestorNode.data_type?.display_name ?? ancestorNode.data_type?.id },
    { label: 'Unit', current: currentNode.unit?.display_name ?? currentNode.unit?.id, ancestor: ancestorNode.unit?.display_name ?? ancestorNode.unit?.id },
    { label: 'Modelling rule', current: currentNode.modelling_rule?.rule ?? currentNode.modelling_rule?.id, ancestor: ancestorNode.modelling_rule?.rule ?? ancestorNode.modelling_rule?.id },
    { label: 'Abstract', current: currentNode.is_abstract, ancestor: ancestorNode.is_abstract },
  ]

  return comparisons
    .filter(({ current, ancestor }) => formatValue(current) !== formatValue(ancestor))
    .map(({ label, current, ancestor }) => ({
      label,
      currentValue: formatValue(current),
      ancestorValue: formatValue(ancestor),
    }))
}

function classifyOverrides(currentType: Partial<OPCUANode>, ancestors: Partial<OPCUANode>[]) {
  const currentComponents = getComponents(currentType)
  const ancestorComponents = ancestors.flatMap((ancestor) => getComponents(ancestor))

  const currentByDisplayName = new Map<string, Partial<OPCUANode>>()
  const ancestorByDisplayName = new Map<string, Partial<OPCUANode>>()

  let hasMissingDisplayName = false

  for (const node of currentComponents) {
    const displayName = getDisplayName(node)
    if (!displayName) {
      hasMissingDisplayName = true
      continue
    }

    if (!currentByDisplayName.has(displayName)) {
      currentByDisplayName.set(displayName, node)
    }
  }

  for (const node of ancestorComponents) {
    const displayName = getDisplayName(node)
    if (!displayName) {
      hasMissingDisplayName = true
      continue
    }

    if (!ancestorByDisplayName.has(displayName)) {
      ancestorByDisplayName.set(displayName, node)
    }
  }

  const allDisplayNames = Array.from(new Set([...currentByDisplayName.keys(), ...ancestorByDisplayName.keys()]))
  allDisplayNames.sort((a, b) => a.localeCompare(b))

  const items: OverrideItem[] = allDisplayNames.map((displayName) => {
    const currentNode = currentByDisplayName.get(displayName)
    const ancestorNode = ancestorByDisplayName.get(displayName)

    if (currentNode && ancestorNode) {
      return { displayName, status: 'override', currentNode, ancestorNode }
    }

    if (currentNode) {
      return { displayName, status: 'added', currentNode }
    }

    return { displayName, status: 'inherited', ancestorNode }
  })

  return { items, hasMissingDisplayName }
}

function findMatchingAncestorComponent(selectedMember: Partial<OPCUANode>, ancestors: Partial<OPCUANode>[]) {
  const selectedName = getDisplayName(selectedMember)
  if (!selectedName) {
    return { match: null as Partial<OPCUANode> | null, hasMissingDisplayName: true }
  }

  let hasMissingDisplayName = false

  for (const ancestor of ancestors) {
    const components = getComponents(ancestor)
    for (const component of components) {
      const isSameNodeById =
        selectedMember.id !== undefined &&
        component.id !== undefined &&
        component.id === selectedMember.id
      const isSameNodeByExpandedNodeId =
        typeof selectedMember.expanded_node_id === 'string' &&
        typeof component.expanded_node_id === 'string' &&
        selectedMember.expanded_node_id === component.expanded_node_id

      // The selected member can appear in its owning type's children list.
      // That must not be treated as an override against itself.
      if (isSameNodeById || isSameNodeByExpandedNodeId) {
        continue
      }

      const componentName = getDisplayName(component)
      if (!componentName) {
        hasMissingDisplayName = true
        continue
      }

      if (componentName === selectedName) {
        return { match: component, hasMissingDisplayName }
      }
    }
  }

  return { match: null as Partial<OPCUANode> | null, hasMissingDisplayName }
}

function classifySelectedMember(selectedMember: Partial<OPCUANode>, ancestors: Partial<OPCUANode>[]) {
  const displayName = getDisplayName(selectedMember)
  if (!displayName) {
    return { item: null as OverrideItem | null, hasMissingDisplayName: true }
  }

  const { match, hasMissingDisplayName } = findMatchingAncestorComponent(selectedMember, ancestors)

  if (match) {
    return {
      item: {
        displayName,
        status: 'override' as const,
        currentNode: selectedMember,
        ancestorNode: match,
      },
      hasMissingDisplayName,
    }
  }

  return {
    item: {
      displayName,
      status: 'added' as const,
      currentNode: selectedMember,
    },
    hasMissingDisplayName,
  }
}

function OverrideRow({ item, onSelectNodeById }: { item: OverrideItem; onSelectNodeById?: (nodeId: number) => void }) {
  const targetNode = item.currentNode ?? item.ancestorNode
  const specName = targetNode?.spec?.name_short ?? 'Unknown'
  const nodeId = getNodeIdPart(targetNode?.expanded_node_id)
  const changeSummary = item.status === 'override' ? getChangeSummary(item.currentNode, item.ancestorNode) : []
  const [showAncestorDetails, setShowAncestorDetails] = useState(false)
  const ancestorDescription = formatValue(item.ancestorNode?.description)
  const ancestorDefinition = formatValue(item.ancestorNode?.definition)
  const hasAncestorText = ancestorDescription !== '—' || ancestorDefinition !== '—'
  const isClickable = targetNode?.id !== undefined

  return (
    <Box
      py={2}
      borderBottom="1px solid"
      borderBottomColor="gray.100"
      cursor={isClickable ? 'pointer' : 'default'}
      _hover={isClickable ? { bg: 'gray.100' } : undefined}
      onClick={() => {
        if (targetNode?.id !== undefined) {
          onSelectNodeById?.(targetNode.id)
        }
      }}
    >
      <Flex align="center" justify="space-between" gap={3}>
        <Box minW={0}>
          <Text fontWeight="medium" color="gray.900" truncate>
            {item.displayName}
          </Text>
          <Text fontSize="xs" color="gray.500" truncate>
            {targetNode?.display_name ?? 'Unnamed node'}
          </Text>
        </Box>
        <Flex align="center" gap={2} flexShrink={0}>
          <Badge {...S.resultCardSpecBadge}>{specName}</Badge>
          <Text color="gray.500" fontSize="xs" fontFamily="mono">
            {nodeId}
          </Text>
        </Flex>
      </Flex>

      {item.status === 'override' && (
        <Box mt={2} pl={1}>
          <Text fontSize="xs" color="gray.500" mb={1}>
            Changed fields
          </Text>
          {changeSummary.length > 0 ? (
            <Flex gap={1} wrap="wrap">
              {changeSummary.map((change) => (
                <Badge key={change.label} colorPalette="orange" variant="subtle" px={2} py={1}>
                  <Text fontSize="xs">
                    {change.label}: {change.ancestorValue} → {change.currentValue}
                  </Text>
                </Badge>
              ))}
            </Flex>
          ) : (
            <Text fontSize="xs" color="gray.500">
              No secondary metadata differences detected beyond the matching display name.
            </Text>
          )}

          <Box mt={2}>
            <Button
              size="xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setShowAncestorDetails((prev) => !prev)
              }}
              color="gray.600"
              px={2}
            >
              {showAncestorDetails ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />}
              {showAncestorDetails ? 'Hide higher equivalent' : 'Show higher equivalent'}
            </Button>

            {showAncestorDetails && (
              <Box mt={2} bg="blue.50" border="1px solid" borderColor="blue.100" borderRadius="md" p={3}>
                <Text fontSize="xs" color="blue.700" fontWeight="medium" mb={2}>
                  Higher equivalent definition for {item.displayName}
                </Text>
                {hasAncestorText ? (
                  <Flex direction="column" gap={2}>
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Description</Text>
                      <Text fontSize="sm" color="gray.800">{ancestorDescription}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Definition</Text>
                      <Text fontSize="sm" color="gray.800">{ancestorDefinition}</Text>
                    </Box>
                  </Flex>
                ) : (
                  <Text fontSize="sm" color="gray.600">No Description/Definition available on the higher equivalent.</Text>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

function OverrideSection({ title, tone, items, onSelectNodeById }: { title: string; tone: 'red' | 'green' | 'blue'; items: OverrideItem[]; onSelectNodeById?: (nodeId: number) => void }) {
  if (items.length === 0) {
    return (
      <Box mb={4}>
        <Text fontSize="xs" color="gray.500">{title} (0)</Text>
      </Box>
    )
  }

  return (
    <Box mb={4}>
      <Text fontSize="xs" color={`${tone}.500`} mb={1} fontWeight="medium">
        {title} ({items.length})
      </Text>
      <Box bg="gray.50" borderRadius="md" px={3}>
          {items.map((item) => (
          <OverrideRow key={`${item.status}:${item.displayName}`} item={item} onSelectNodeById={onSelectNodeById} />
        ))}
      </Box>
    </Box>
  )
}

export function OverridesPanel({ selectedElement, onSelectNodeById }: OverridesPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentNode, setCurrentNode] = useState<Partial<OPCUANode> | null>(null)
  const [ancestorChain, setAncestorChain] = useState<Partial<OPCUANode>[]>([])

  useEffect(() => {
    setIsLoading(false)
    setErrorMessage(null)
    setCurrentNode(null)
    setAncestorChain([])
  }, [selectedElement?.node.id])

  useEffect(() => {
    const selectedNodeId = selectedElement?.node.id
    if (typeof selectedNodeId !== 'number') {
      return
    }
    const safeSelectedNodeId: number = selectedNodeId

    let isCancelled = false

    async function loadAncestors(startNode: Partial<OPCUANode>) {
      const ancestors: Partial<OPCUANode>[] = []
      const visited = new Set<number>()
      let current: Partial<OPCUANode> | null = startNode

      while (current) {
        const currentId = current.id
        if (currentId === undefined) {
          break
        }

        let nextNodeId = current.parent_id ?? current.typedefinition_id
        if (!nextNodeId) {
          nextNodeId = current.parent?.id ?? current.typedefinition?.id
        }

        if (!nextNodeId || visited.has(nextNodeId)) {
          break
        }

        visited.add(nextNodeId)
        const fullParent = await getNodeById(nextNodeId)
        if (!fullParent) {
          break
        }

        ancestors.push(fullParent)
        current = fullParent
      }

      return ancestors
    }

    async function loadData() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const fullCurrent = await getNodeById(safeSelectedNodeId)
        if (!fullCurrent) {
          throw new Error('Selected node could not be loaded.')
        }

        const ancestors = await loadAncestors(fullCurrent)

        if (!isCancelled) {
          setCurrentNode(fullCurrent)
          setAncestorChain(ancestors)
        }
      } catch (error) {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : 'Overrides could not be loaded.'
          setErrorMessage(message)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isCancelled = true
    }
  }, [selectedElement?.node.id])

  const { mode, overrideItems, addedItems, inheritedItems, hasMissingDisplayName } = useMemo(() => {
    if (!currentNode) {
      return {
        mode: 'type' as AnalysisMode,
        overrideItems: [] as OverrideItem[],
        addedItems: [] as OverrideItem[],
        inheritedItems: [] as OverrideItem[],
        hasMissingDisplayName: false,
      }
    }

    if (isTypeNode(currentNode)) {
      const { items, hasMissingDisplayName } = classifyOverrides(currentNode, ancestorChain)

      return {
        mode: 'type' as AnalysisMode,
        overrideItems: items.filter((item) => item.status === 'override'),
        addedItems: items.filter((item) => item.status === 'added'),
        inheritedItems: items.filter((item) => item.status === 'inherited'),
        hasMissingDisplayName,
      }
    }

    const { item, hasMissingDisplayName } = classifySelectedMember(currentNode, ancestorChain)

    if (!item) {
      return {
        mode: 'member' as AnalysisMode,
        overrideItems: [] as OverrideItem[],
        addedItems: [] as OverrideItem[],
        inheritedItems: [] as OverrideItem[],
        hasMissingDisplayName,
      }
    }

    return {
      mode: 'member' as AnalysisMode,
      overrideItems: item.status === 'override' ? [item] : [],
      addedItems: item.status === 'added' ? [item] : [],
      inheritedItems: [] as OverrideItem[],
      hasMissingDisplayName,
    }
  }, [currentNode, ancestorChain])

  if (!selectedElement) {
    return (
      <Flex align="center" justify="center" bg="white" h="full">
        <Box textAlign="center">
          <Box color="gray.300" mx="auto" mb={4} display="flex" justifyContent="center">
            <LuGitCompareArrows size={64} />
          </Box>
          <Heading as="h3" fontSize="lg" fontWeight="medium" color="gray.900" mb={2}>
            Select an element to view overrides
          </Heading>
          <Text color="gray.500" maxW="md" fontSize="sm">
            Choose an OPC UA element from the search results to inspect override behavior in its type hierarchy.
          </Text>
        </Box>
      </Flex>
    )
  }

  return (
    <Box {...S.detailContainer}>
      <Text color="gray.500" fontSize="sm" mb={4}>
        Override analysis for: <strong>{selectedElement.node.display_name}</strong>
      </Text>

      <Card.Root {...S.cardRoot}>
        <Card.Body {...S.cardBody}>
          <Flex {...S.sectionHeaderSm}>
            <Box {...S.sectionIcon}>
              <LuWaypoints size={18} />
            </Box>
            <Heading {...S.sectionTitle}>{mode === 'type' ? 'Type Override Summary' : 'Member Override Check'}</Heading>
          </Flex>

          {isLoading ? (
            <>
              <Skeleton h="32px" mb={2} />
              <Skeleton h="32px" mb={2} />
              <Skeleton h="32px" />
            </>
          ) : errorMessage ? (
            <Flex align="center" gap={2} bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md" p={3}>
              <LuTriangle color="var(--chakra-colors-red-500)" />
              <Text color="red.700" fontSize="sm">{errorMessage}</Text>
            </Flex>
          ) : hasMissingDisplayName ? (
            <Flex align="center" gap={2} bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="md" p={3}>
              <LuTriangle color="var(--chakra-colors-orange-500)" />
              <Text color="orange.700" fontSize="sm">
                Some nodes do not contain display_name. Override classification requires display_name and cannot be completed reliably.
              </Text>
            </Flex>
          ) : (
            <>
              <Flex gap={2} mb={4} wrap="wrap">
                <Badge colorPalette="red" variant="subtle" px={2} py={1}>
                  <Flex align="center" gap={1}>
                    <LuGitCompareArrows size={12} />
                    <Text fontSize="xs">Overrides: {overrideItems.length}</Text>
                  </Flex>
                </Badge>
                <Badge colorPalette="green" variant="subtle" px={2} py={1}>
                  <Flex align="center" gap={1}>
                    <LuPlus size={12} />
                    <Text fontSize="xs">Added: {addedItems.length}</Text>
                  </Flex>
                </Badge>
                <Badge colorPalette="blue" variant="subtle" px={2} py={1}>
                  <Flex align="center" gap={1}>
                    <LuCheck size={12} />
                    <Text fontSize="xs">Inherited: {inheritedItems.length}</Text>
                  </Flex>
                </Badge>
              </Flex>

              <OverrideSection title="Override" tone="red" items={overrideItems} onSelectNodeById={onSelectNodeById} />
              <OverrideSection title="Added" tone="green" items={addedItems} onSelectNodeById={onSelectNodeById} />
              {mode === 'type' && (
                <OverrideSection title="Inherited (unchanged)" tone="blue" items={inheritedItems} onSelectNodeById={onSelectNodeById} />
              )}
            </>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
