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


import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Skeleton,
  Text,
} from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LuSearch, LuX } from "react-icons/lu"
import { DetailPanel } from "./DetailPanel"
import { FilterPopover } from "./FilterPopover"
import { InheritancePanel } from "./InheritancePanel"
import { OverridesPanel } from "./OverridesPanel"
import { ResultsList } from "./ResultsList"
import { styles as S } from "./styles"
import type {
  FilterOption,
  OPCUAElement,
  OPCUANode,
  OPCUANodeset,
  OPCUASearchWindowProps,
  OPCUASpec,
  SpecFilterOption,
} from "./types"
import { runtimeConfig } from "@/runtimeConfig"

interface OPCUANodesetWithSpecs extends OPCUANodeset {
  specs?: OPCUASpec[]
  required_nodesets?: OPCUANodeset[]
}

const GROUPED_SPEC_LABELS = new Set(["Core", "UAFX"])
const FALLBACK_SELECTED_SPECS = [
  "Machinery",
  "MachineTool",
  "DI",
  "Core",
]

function parseDefaultSelectedSpecs(): string[] {
  const envSpecs = runtimeConfig.defaultSelectedSpecs
  if (!envSpecs || envSpecs.length == 0) {
    return FALLBACK_SELECTED_SPECS
  }

  return envSpecs
}

const DEFAULT_SELECTED_SPECS = parseDefaultSelectedSpecs()
const DEFAULT_NODE_CLASSES = ["ObjectType", "VariableType", "Object", "Variable", "Method", "DataType"]
type DetailsTab = "details" | "inheritance" | "overrides"

function getApiBaseUrl(): string {
  const configuredApiUrl = runtimeConfig.apiUrl
  return import.meta.env.DEV ? "" : configuredApiUrl || ""
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeSpecLabel(value: unknown): string | null {
  const label = normalizeLabel(value)
  if (!label) {
    return null
  }

  const groupedMatch = label.match(/^(Core|UAFX)\s*\/\s*Part\s*\d+$/i)
  if (groupedMatch) {
    return groupedMatch[1]
  }

  return label
}

function buildSpecKey(label: string): string {
  return `spec:${label.toLowerCase()}`
}

function mapNodeClassesToOptions(nodeClasses: string[]): FilterOption[] {
  return nodeClasses.map((nodeClass) => ({ key: nodeClass, label: nodeClass }))
}

function aggregateSpecOptions(
  specs: OPCUASpec[],
  nodesets: OPCUANodesetWithSpecs[],
): SpecFilterOption[] {
  const labelSet = new Set<string>()
  const nodesetIdsByLabel = new Map<string, Set<number>>()

  for (const spec of specs) {
    const label = normalizeSpecLabel(spec.name_short)
    if (label) {
      labelSet.add(label)
    }
  }

  for (const nodeset of nodesets) {
    const relatedSpecLabels = (nodeset.specs ?? [])
      .map((spec) => normalizeSpecLabel(spec.name_short))
      .filter((label): label is string => Boolean(label))

    const fallbackNodesetLabel = normalizeSpecLabel(nodeset.name_short)
    const candidateLabels =
      relatedSpecLabels.length > 0
        ? relatedSpecLabels
        : fallbackNodesetLabel
          ? [fallbackNodesetLabel]
          : []

    for (const label of candidateLabels) {
      if (!labelSet.has(label) && !GROUPED_SPEC_LABELS.has(label)) {
        continue
      }
      const nodesetIds = nodesetIdsByLabel.get(label) ?? new Set<number>()
      nodesetIds.add(nodeset.id)
      nodesetIdsByLabel.set(label, nodesetIds)
    }
  }

  const options: SpecFilterOption[] = Array.from(labelSet)
    .map((label) => ({
      key: buildSpecKey(label),
      label,
      nodesetIds: Array.from(nodesetIdsByLabel.get(label) ?? []),
    }))
    .filter((option) => option.nodesetIds.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label))

  return options
}

export async function searchApiCall(
  query: string,
  nodesetIds: number[],
  nodeClasses: string[],
): Promise<OPCUAElement[]> {
  try {
    const params = new URLSearchParams()
    if (query.trim()) params.append("q", query.trim())
    if (nodesetIds?.length) {
      for (const id of nodesetIds) {
        params.append("nodeset_id", String(id))
      }
    }

    if (nodeClasses?.length) {
      for (const nodeClass of nodeClasses) {
        params.append("node_class", nodeClass)
      }
    }

    const baseUrl = getApiBaseUrl()
    const url = `${baseUrl}/api/v1/nodes/semantic_search/?${params.toString()}`
    const res = await fetch(url, { method: "GET" })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Search request failed`)
    }

    const data: OPCUAElement[] = await res.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      throw new Error(
        "Network/CORS error while calling search endpoint. In local dev, ensure Vite proxy is active and backend is reachable.",
      )
    }
    console.error("Search API error: ", error)
    throw error
  }
}

export async function getNodeById(nodeId: number): Promise<OPCUANode | null> {
    try {
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}/api/v1/nodes/${nodeId}`;
        const res = await fetch(url, {method: 'GET'});

        if (!res.ok) {
            return null
        }

        const data = await res.json();
        return data as OPCUANode;
    } catch (error) {
        console.error('Failed to fetch node:', error);
        return null;
    }
}

export function SearchWindow({
  onSearch,
  defaultSelectedSpecs = DEFAULT_SELECTED_SPECS,
  defaultNodeClasses = DEFAULT_NODE_CLASSES,
  height = "100%",
}: OPCUASearchWindowProps) {
  const [selectedElement, setSelectedElement] = useState<OPCUAElement | null>(
    null,
  )
  const [searchResults, setSearchResults] = useState<OPCUAElement[]>([])
  const [selectedSpecKeys, setSelectedSpecKeys] = useState<string[]>([])
  const [selectedNodeClasses, setSelectedNodeClasses] =
    useState<string[]>(defaultNodeClasses)
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>("details")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const searchRequestIdRef = useRef(0)

  const [companionSpecsOptions, setCompanionSpecsOptions] = useState<
    SpecFilterOption[]
  >([])
  const NODE_CLASSES = ["ObjectType", "VariableType", "Object", "Variable", "Method", "DataType"]
  const nodeClassOptions = mapNodeClassesToOptions(NODE_CLASSES)
  const trimmedSearchQuery = searchQuery.trim()

  useEffect(() => {
    const ac = new AbortController()
    const loadSpecs = async () => {
      try {
        const baseUrl = getApiBaseUrl()
        const [specsRes, nodesetsRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/specs/`, { signal: ac.signal }),
          fetch(`${baseUrl}/api/v1/nodesets/`, { signal: ac.signal }),
        ])

        if (!specsRes.ok) {
          throw new Error(`HTTP ${specsRes.status}: Failed to load specs`)
        }
        if (!nodesetsRes.ok) {
          throw new Error(`HTTP ${nodesetsRes.status}: Failed to load nodesets`)
        }

        const rawSpecs = await specsRes.json()
        const rawNodesets = await nodesetsRes.json()
        const specs = Array.isArray(rawSpecs) ? (rawSpecs as OPCUASpec[]) : []
        const nodesets = Array.isArray(rawNodesets)
          ? (rawNodesets as OPCUANodesetWithSpecs[])
          : []

        const specOptions = aggregateSpecOptions(specs, nodesets)
        setCompanionSpecsOptions(specOptions)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        console.error("Loading of Specs failed: ", err)
        setCompanionSpecsOptions([])
        setSelectedSpecKeys([])
      }
    }
    loadSpecs()
    return () => ac.abort()
  }, [])

  const initialSelectedSpecKeys = useMemo(
    () =>
      companionSpecsOptions
        .filter((specOption) => defaultSelectedSpecs.includes(specOption.label))
        .map((specOption) => specOption.key),
    [companionSpecsOptions, defaultSelectedSpecs],
  )

  useEffect(() => {
    setSelectedSpecKeys(initialSelectedSpecKeys)
  }, [initialSelectedSpecKeys])

  const selectedNodesetIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedSpecKeys.flatMap((key) => {
            const option = companionSpecsOptions.find(
              (specOption) => specOption.key === key,
            )
            return option ? option.nodesetIds : []
          }),
        ),
      ),
    [companionSpecsOptions, selectedSpecKeys],
  )

  const handleSearch = useCallback(async () => {
    if (!trimmedSearchQuery) return

    const requestId = ++searchRequestIdRef.current
    setIsSearching(true)
    try {
      const results = await onSearch(
        trimmedSearchQuery,
        selectedNodesetIds,
        selectedNodeClasses,
      )
      if (searchRequestIdRef.current === requestId) {
        setSearchResults(results)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setIsSearching(false)
      }
    }
  }, [onSearch, selectedNodeClasses, selectedNodesetIds, trimmedSearchQuery])

  useEffect(() => {
    if (!trimmedSearchQuery) return
    const timeout = setTimeout(() => {
      handleSearch()
    }, 800)
    return () => clearTimeout(timeout)
  }, [handleSearch, trimmedSearchQuery])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  const removeSpec = (key: string) => {
    setSelectedSpecKeys(
      selectedSpecKeys.filter((selectedKey) => selectedKey !== key),
    )
  }

  const getSpecLabelByKey = (key: string) =>
    companionSpecsOptions.find((spec) => spec.key === key)?.label ?? key

  const selectedNodeClassKeys = selectedNodeClasses

  const setSelectedNodeClassKeys = (keys: string[]) => {
    setSelectedNodeClasses(keys)
  }

  const handleSelectNodeById = useCallback(async (nodeId: number) => {
    const node = await getNodeById(nodeId)
    if (!node) {
      return
    }

    setSelectedElement((previous) => ({
      node,
      similarity: previous?.similarity ?? 1,
    }))
  }, [])

  return (
    <Box h={height} {...S.container}>
      <Heading {...S.title}>
        <Text {...S.titleAccent}>CLOU</Text> OPC UA Element Search
      </Heading>

      <Box {...S.searchArea}>
        <Flex {...S.searchRow}>
          <Box {...S.inputWrapper}>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Describe the OPC UA Element you search"
              {...S.input}
            />
            <Box {...S.inputIcon}>
              <LuSearch size={22} />
            </Box>

            <Flex {...S.filterBar}>
              <FilterPopover
                label="Nodeset"
                options={companionSpecsOptions.map((option) => ({
                  key: option.key,
                  label: option.label,
                }))}
                selectedKeys={selectedSpecKeys}
                onSelectionChange={setSelectedSpecKeys}
                enableSearch={true}
                withSelectAll={true}
              />
              <FilterPopover
                label="NodeClass"
                options={nodeClassOptions}
                selectedKeys={selectedNodeClassKeys}
                onSelectionChange={setSelectedNodeClassKeys}
                withSelectAll={true}
              />
            </Flex>
          </Box>

          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            {...S.searchButton}
          >
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </Flex>

        {selectedSpecKeys.length > 0 && (
          <Flex {...S.selectedSpecsWrap}>
            {selectedSpecKeys.map((specKey) => {
              const name = getSpecLabelByKey(specKey)
              return (
                <Badge key={specKey} {...S.selectedBadge}>
                  <Text>{name}</Text>
                  <Box
                    as="button"
                    onClick={() => removeSpec(specKey)}
                    display="flex"
                    alignItems="center"
                    color="gray.700"
                    _hover={{ color: "gray.900" }}
                    cursor="pointer"
                  >
                    <LuX size={14} />
                  </Box>
                </Badge>
              )
            })}
          </Flex>
        )}
      </Box>

      {isSearching ? (
        <Flex {...S.resultsSplit}>
          <Box {...S.resultsCol}>
            <Flex {...S.resultsHeader}>
              <Text fontSize="lg" fontWeight="medium" color="gray.900">
                Results
              </Text>
            </Flex>
            <Flex flexDirection="column" gap={3}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} h="120px" borderRadius="lg" />
              ))}
            </Flex>
          </Box>

          <Box {...S.detailsCol}>
            <Flex {...S.detailsHeader}>
              <Text fontSize="lg" fontWeight="medium" color="gray.900">
                Node Details
              </Text>
            </Flex>
            <Skeleton h="calc(100% - 60px)" borderRadius="lg" />
          </Box>
        </Flex>
      ) : (
        <Flex {...S.resultsSplit}>
          <Box {...S.resultsCol}>
            <Flex {...S.resultsHeader}>
              <Text fontSize="lg" fontWeight="medium" color="gray.900">
                Results
              </Text>
            </Flex>
            <Box {...S.resultsScroll}>
              <ResultsList
                results={searchResults}
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
              />
            </Box>
          </Box>

          <Box {...S.detailsCol}>
            <Flex {...S.detailsHeader}>
              <Text fontSize="lg" fontWeight="medium" color="gray.900">
                Node Details
              </Text>
            </Flex>
            <Flex {...S.tabList}>
              <Button
                variant="ghost"
                onClick={() => setActiveDetailsTab("details")}
                {...S.tab}
                color={activeDetailsTab === "details" ? "brand" : "gray.500"}
                borderBottomColor={
                  activeDetailsTab === "details" ? "brand" : "transparent"
                }
              >
                Details
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveDetailsTab("inheritance")}
                {...S.tab}
                color={activeDetailsTab === "inheritance" ? "brand" : "gray.500"}
                borderBottomColor={
                  activeDetailsTab === "inheritance" ? "brand" : "transparent"
                }
              >
                Inheritance
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveDetailsTab("overrides")}
                {...S.tab}
                color={activeDetailsTab === "overrides" ? "brand" : "gray.500"}
                borderBottomColor={
                  activeDetailsTab === "overrides" ? "brand" : "transparent"
                }
              >
                Overrides
              </Button>
            </Flex>
            <Box {...S.detailsScroll}>
              {activeDetailsTab === "details" && (
                <DetailPanel selectedElement={selectedElement} />
              )}
              {activeDetailsTab === "inheritance" && (
                <InheritancePanel
                  selectedElement={selectedElement}
                  onSelectNodeById={handleSelectNodeById}
                />
              )}
              {activeDetailsTab === "overrides" && (
                <OverridesPanel
                  selectedElement={selectedElement}
                  onSelectNodeById={handleSelectNodeById}
                />
              )}
            </Box>
          </Box>
        </Flex>
      )}
    </Box>
  )
}

export default SearchWindow
