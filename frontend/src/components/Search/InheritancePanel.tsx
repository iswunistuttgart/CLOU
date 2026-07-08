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


import { Box, Card, Flex, Text, Badge, Heading, Button, Skeleton } from '@chakra-ui/react'
import { styles as S } from './styles'
import { LuGitBranch, LuArrowUp, LuArrowDown, LuChevronDown, LuChevronUp } from 'react-icons/lu'
import type { OPCUAElement, OPCUANode } from './types'
import { useState, useEffect, type ReactNode } from 'react'
import { getNodeById } from './SearchWindow'

interface InheritancePanelProps {
  selectedElement: OPCUAElement | null
  onSelectNodeById?: (nodeId: number) => void
}

function getNodeIdPart(expandedNodeId?: string): string {
  if (!expandedNodeId) return '—'
  const parts = expandedNodeId.split(';')
  return parts.length > 1 ? parts[1] : expandedNodeId
}

interface HierarchyItemProps {
  node: Partial<OPCUANode>
  label?: string
  isHighlighted?: boolean
  onClick?: () => void
}

function HierarchyItem({ node, label, isHighlighted, onClick }: HierarchyItemProps) {
  const specName = node.spec?.name_short ?? 'Unknown'
  const nodeId = getNodeIdPart(node.expanded_node_id)
  const isClickable = typeof onClick === 'function'

  return (
    <Flex
      align="center"
      gap={3}
      py={2}
      bg={isHighlighted ? 'blue.50' : 'transparent'}
      borderRadius={isHighlighted ? 'md' : 0}
      px={isHighlighted ? 2 : 0}
      cursor={isClickable ? 'pointer' : 'default'}
      _hover={isClickable ? { bg: 'gray.50' } : undefined}
      onClick={onClick}
    >
      <Box flex="1">
        <Flex align="center" gap={2}>
          <Text fontWeight={isHighlighted ? 'semibold' : 'normal'} color={isHighlighted ? 'brand' : 'gray.900'}>
            {node.display_name}
          </Text>
          {label && (
            <Badge bg="brand" color="white" fontSize="xs">{label}</Badge>
          )}
        </Flex>
      </Box>
      <Badge {...S.resultCardSpecBadge}>{specName}</Badge>
      <Text color="gray.500" fontSize="sm" fontFamily="mono">
        {nodeId}
      </Text>
    </Flex>
  )
}

interface SectionLoadingBlockProps {
  icon: ReactNode
  label: string
  color: 'brand' | 'green.500'
}

function SectionLoadingBlock({ icon, label, color }: SectionLoadingBlockProps) {
  return (
    <Box mb={4}>
      <Flex align="center" mb={2}>
        {icon}
        <Text fontSize="xs" color={color} ml={1} fontWeight="medium">{label}</Text>
      </Flex>
      <Box pl={4}>
        <Skeleton h="32px" mb={2} />
        <Skeleton h="32px" mb={2} />
      </Box>
    </Box>
  )
}

export function InheritancePanel({ selectedElement, onSelectNodeById }: InheritancePanelProps) {
  const [showAllSubtypes, setShowAllSubtypes] = useState(false)
  const [showAllInstances, setShowAllInstances] = useState(false)
  const [ancestorChain, setAncestorChain] = useState<Partial<OPCUANode>[]>([])
  const [isLoadingAncestors, setIsLoadingAncestors] = useState(false)
  const [isLoadingChildren, setIsLoadingChildren] = useState(false)
  const [loadedChildren, setLoadedChildren] = useState<Map<number, Partial<OPCUANode>[]>>(new Map())

  function handleSelectNode(node: Partial<OPCUANode>) {
    if (node.id !== undefined) {
      onSelectNodeById?.(node.id)
    }
  }

  useEffect(() => {
    setShowAllSubtypes(false)
    setShowAllInstances(false)
    setAncestorChain([])
    setIsLoadingAncestors(false)
    setIsLoadingChildren(false)
    setLoadedChildren(new Map())
  }, [selectedElement?.node.id])

  useEffect(() => {
    if (!selectedElement) return

    const node = selectedElement.node
    let isCancelled = false

    async function loadAncestorChain(currentNode: Partial<OPCUANode>, chain: Partial<OPCUANode>[] = []): Promise<Partial<OPCUANode>[]> {
      if (!currentNode || currentNode.id === undefined) return chain

      const parentId = (currentNode as any).parent_id as number | undefined
      const typeDefId = (currentNode as any).typedefinition_id as number | undefined

      let nextNodeId = parentId ?? typeDefId

      if (!nextNodeId) {
        const parent = (currentNode as any).parent
        const typeDef = (currentNode as any).typedefinition
        if (parent?.id) nextNodeId = parent.id
        else if (typeDef?.id) nextNodeId = typeDef.id
      }

      if (!nextNodeId) return chain

      const fullParent = await getNodeById(nextNodeId)
      if (!fullParent) return chain
      const newChain = [...chain, fullParent]
      return loadAncestorChain(fullParent, newChain)
    }

    setIsLoadingAncestors(true)
    loadAncestorChain(node)
      .then((chain) => {
        if (isCancelled) return
        setAncestorChain(chain)
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingAncestors(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedElement?.node.id])

  const node = selectedElement?.node
  const children = Array.isArray(node?.children) ? node.children : []
  const instances = Array.isArray(node?.typedefinition_of) ? node.typedefinition_of : []

  const subtypeNodeTypes = ['ObjectType', 'VariableType']
  const subtypes = children.filter(c => c.node_type?.node_type && subtypeNodeTypes.includes(c.node_type.node_type))
  const instanceDeclarations = children.filter(c => !c.node_type?.node_type || !subtypeNodeTypes.includes(c.node_type.node_type))
  const hasChildrenContent = subtypes.length > 0 || instanceDeclarations.length > 0 || instances.length > 0

  const visibleSubtypes = showAllSubtypes ? subtypes : subtypes.slice(0, 12)

  async function loadChildrenRecursive(nodeId: number, depth: number, maxDepth: number = 2): Promise<Partial<OPCUANode>[]> {
    if (depth > maxDepth) return []

    const fullNode = await getNodeById(nodeId)
    if (!fullNode) return []

    const children = fullNode.children || []
    const result: Partial<OPCUANode>[] = []

    for (const child of children) {
      if (child.id === undefined) continue

      const grandChildren = await loadChildrenRecursive(child.id, depth + 1, maxDepth)
      
      const childWithGrandChildren = {
        ...child,
        children: grandChildren
      } as Partial<OPCUANode>
      
      result.push(childWithGrandChildren)
    }

    return result
  }

  async function fillLoadedMap(nodeId: number, depth: number, loadedMap: Map<number, Partial<OPCUANode>[]>, maxDepth: number = 2) {
    if (depth > maxDepth) return

    const fullNode = await getNodeById(nodeId)
    if (!fullNode) return

    const children = fullNode.children || []
    const subtypeNodeTypes = ['ObjectType', 'VariableType']
    const subtypeChildren = children.filter(c => 
      c.id !== undefined && 
      c.node_type?.node_type && 
      subtypeNodeTypes.includes(c.node_type.node_type)
    )

    if (depth < maxDepth) {
      loadedMap.set(nodeId, subtypeChildren)
    }

    for (const child of subtypeChildren) {
      if (child.id !== undefined) {
        await fillLoadedMap(child.id, depth + 1, loadedMap, maxDepth)
      }
    }
  }

  useEffect(() => {
    if (!selectedElement) return

    let isCancelled = false

    const loadAllChildren = async () => {
      setIsLoadingChildren(true)
      const newLoadedMap = new Map<number, Partial<OPCUANode>[]>()
      const allChildren = await loadChildrenRecursive(selectedElement.node.id, 0)
      await fillLoadedMap(selectedElement.node.id, 0, newLoadedMap)
      newLoadedMap.set(selectedElement.node.id, allChildren)

      if (!isCancelled) {
        setLoadedChildren(newLoadedMap)
        setIsLoadingChildren(false)
      }
    }

    loadAllChildren()

    return () => {
      isCancelled = true
    }
  }, [selectedElement?.node.id])

  function ChildrenListWithData({ nodes, depth = 0 }: { nodes: Partial<OPCUANode>[]; depth?: number }) {
    if (nodes.length === 0 || depth > 2) return null

    const subtypeNodeTypes = ['ObjectType', 'VariableType']
    const filteredNodes = nodes.filter(c => 
      c.id !== undefined && 
      c.node_type?.node_type && 
      subtypeNodeTypes.includes(c.node_type.node_type)
    )

    return (
      <Box pl={depth > 0 ? 4 : 0} borderLeft={depth > 0 ? '2px solid' : 'none'} borderColor="gray.200">
        {filteredNodes.map((child) => {
          const childChildren = child.id !== undefined ? (loadedChildren.get(child.id!) ?? child.children ?? []) : (child.children ?? [])
          const hasSubtypeChildren = childChildren.length > 0 && !isBaseType(child.display_name)
          return (
            <Box key={child.id}>
              <HierarchyItem node={child} onClick={() => handleSelectNode(child)} />
              {hasSubtypeChildren && (
                <>
                  <Box pl={3} py={1}>
                    <LuArrowDown size={12} color="var(--chakra-colors-green-300)" />
                  </Box>
                  <ChildrenListWithData nodes={childChildren} depth={depth + 1} />
                </>
              )}
            </Box>
          )
        })}
      </Box>
    )
  }
  const visibleInstances = showAllInstances ? instances : instances.slice(0, 5)

  const BASE_TYPES = ['BaseObjectType', 'BaseVariableType']

  function isBaseType(name?: string): boolean {
    return name ? BASE_TYPES.includes(name) : false
  }

  if (!selectedElement || !node) {
    return (
      <Flex align="center" justify="center" bg="white" h="full">
        <Box textAlign="center">
          <Box color="gray.300" mx="auto" mb={4} display="flex" justifyContent="center">
            <LuGitBranch size={64} />
          </Box>
          <Heading as="h3" fontSize="lg" fontWeight="medium" color="gray.900" mb={2}>
            Select an element to view inheritance
          </Heading>
          <Text color="gray.500" maxW="md" fontSize="sm">
            Choose an OPC UA element from the search results to see its inheritance hierarchy
          </Text>
        </Box>
      </Flex>
    )
  }

  return (
    <Box {...S.detailContainer}>
      <Text color="gray.500" fontSize="sm" mb={4}>
        Inheritance chain for: <strong>{node.display_name}</strong>
      </Text>

      <Card.Root {...S.cardRoot}>
        <Card.Body {...S.cardBody}>
          <Flex {...S.sectionHeaderSm}>
            <Box {...S.sectionIcon}>
              <LuGitBranch size={18} />
            </Box>
            <Heading {...S.sectionTitle}>
              Inheritance Hierarchy
            </Heading>
          </Flex>

          {/* Ancestor chain */}
          {isLoadingAncestors ? (
            <SectionLoadingBlock
              icon={<LuArrowUp size={14} color="var(--chakra-colors-blue-400)" />}
              color="brand"
              label="Loading ancestors..."
            />
          ) : ancestorChain.length > 0 ? (
            <Box mb={4}>
              <Flex align="center" mb={2}>
                <LuArrowUp size={14} color="var(--chakra-colors-blue-400)" />
                <Text fontSize="xs" color="brand" ml={1} fontWeight="medium">Inheritance Chain</Text>
              </Flex>
              <Box borderLeft="2px solid" borderColor="blue.200" pl={4}>
                {ancestorChain.filter(a => a && a.id !== undefined).reverse().map((ancestor, idx, arr) => (
                  <Box key={ancestor.id}>
                    <HierarchyItem
                      node={ancestor}
                      onClick={() => {
                        if (ancestor.id !== undefined) {
                          onSelectNodeById?.(ancestor.id)
                        }
                      }}
                    />
                    {idx < arr.length - 1 && (
                      <Box pl={3} py={1}>
                        <LuArrowUp size={12} color="var(--chakra-colors-blue-300)" />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box mb={4}>
              <Text fontSize="xs" color="gray.500">No ancestors found.</Text>
            </Box>
          )}

          {/* Current element - highlighted */}
          <Box mb={4}>
            <Flex align="center" mb={2}>
              <Text fontSize="xs" color="gray.400" fontWeight="medium">CURRENT</Text>
            </Flex>
            <HierarchyItem node={node} isHighlighted />
          </Box>

          {/* Children */}
          <Box>
            <Flex align="center" mb={2}>
              <LuArrowDown size={14} color="var(--chakra-colors-green-400)" />
              <Text fontSize="xs" color="green.500" ml={1} fontWeight="medium">Has children / instances</Text>
            </Flex>

            {isLoadingChildren ? (
              <SectionLoadingBlock
                icon={<LuArrowDown size={14} color="var(--chakra-colors-green-400)" />}
                color="green.500"
                label="Loading children..."
              />
            ) : hasChildrenContent ? (
              <>
                {subtypes.length > 0 && (
                  <Box mb={3}>
                    <Text fontSize="xs" color="gray.500" mb={1}>SubTypes ({subtypes.length})</Text>
                    <Box borderLeft="2px solid" borderColor="green.200" pl={4}>
                      {visibleSubtypes.filter(c => c.id !== undefined).map((child) => {
                        const childChildren = loadedChildren.get(child.id!) ?? child.children ?? []
                        const hasSubtypeChildren = childChildren.length > 0 && !isBaseType(child.display_name)

                        return (
                          <Box key={child.id}>
                            <HierarchyItem node={child} onClick={() => handleSelectNode(child)} />
                            {hasSubtypeChildren && (
                              <>
                                <Box pl={3} py={1}>
                                  <LuArrowDown size={12} color="var(--chakra-colors-green-300)" />
                                </Box>
                                <ChildrenListWithData nodes={childChildren} depth={1} />
                              </>
                            )}
                          </Box>
                        )
                      })}
                      {subtypes.length > 12 && (
                        <Button size="sm" variant="ghost" onClick={() => setShowAllSubtypes(!showAllSubtypes)}>
                          {showAllSubtypes ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />}
                          {showAllSubtypes ? 'Show less' : `Show all (${subtypes.length})`}
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}

                {instanceDeclarations.length > 0 && (
                  <Box mb={3}>
                    <Text fontSize="xs" color="gray.500" mb={1}>InstanceDeclarations ({instanceDeclarations.length})</Text>
                    <Box bg="gray.50" borderRadius="md" p={2}>
                      {instanceDeclarations.filter(c => c.id !== undefined).map((child) => {
                        const childChildren = loadedChildren.get(child.id!) ?? child.children ?? []

                        return (
                          <Box key={child.id}>
                            <HierarchyItem node={child} onClick={() => handleSelectNode(child)} />
                            {childChildren.length > 0 && !isBaseType(child.display_name) && (
                              <ChildrenListWithData nodes={childChildren} depth={1} />
                            )}
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                )}

                {instances.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>TypeDefinition of / Instances ({instances.length})</Text>
                    <Box bg="gray.50" borderRadius="md" p={2}>
                      {visibleInstances.filter(i => i.id !== undefined).map((inst) => {
                        const instChildren = loadedChildren.get(inst.id!) ?? inst.children ?? []

                        return (
                          <Box key={inst.id}>
                            <HierarchyItem node={inst} onClick={() => handleSelectNode(inst)} />
                            {instChildren.length > 0 && !isBaseType(inst.display_name) && (
                              <ChildrenListWithData nodes={instChildren} depth={1} />
                            )}
                          </Box>
                        )
                      })}
                      {instances.length > 3 && (
                        <Button size="sm" variant="ghost" onClick={() => setShowAllInstances(!showAllInstances)}>
                          {showAllInstances ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />}
                          {showAllInstances ? 'Show less' : `Show all (${instances.length})`}
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}
              </>
            ) : (
              <Box mb={4}>
                <Text fontSize="xs" color="gray.500">No children or instances found.</Text>
              </Box>
            )}
          </Box>
        </Card.Body>
      </Card.Root>
    </Box>
  )
}