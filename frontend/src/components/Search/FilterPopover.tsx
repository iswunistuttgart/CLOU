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


import { useState, useRef, useEffect } from 'react'
import { Box, Input, Button, Flex, Text, Badge } from '@chakra-ui/react'
import { LuSearch, LuChevronDown, LuCheck } from 'react-icons/lu'
import type { FilterOption } from './types'

interface FilterPopoverProps {
  label: string
  options: FilterOption[]
  selectedKeys: string[]
  onSelectionChange: (selected: string[]) => void
  enableSearch?: boolean
  withSelectAll?: boolean
}

export function FilterPopover({ label, options, selectedKeys, onSelectionChange, enableSearch = false, withSelectAll = false }: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const filteredOptions = enableSearch
    ? options.filter((option) => option.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  const toggleOption = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((selectedKey) => selectedKey !== key))
    } else {
      onSelectionChange([...selectedKeys, key])
    }
  }

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  return (
    <Box position="relative" ref={containerRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        px={3}
        py="6px"
        h="auto"
        bg={selectedKeys.length > 0 ? 'brand' : 'gray.100'}
        color={selectedKeys.length > 0 ? 'white' : 'gray.700'}
        borderRadius="md"
        fontSize="sm"
        fontWeight="normal"
        display="flex"
        alignItems="center"
        gap={1}
        _hover={{ opacity: 0.9 }}
      >
        <Text>{label}</Text>
        {selectedKeys.length > 0 && (
          <Badge ml={1} px="6px" py="2px" bg="rgba(255, 255, 255, 0.2)" color="inherit" borderRadius="full" fontSize="10px">
            {selectedKeys.length}
          </Badge>
        )}
        <LuChevronDown size={14} />
      </Button>

      {isOpen && (
        <Box
          ref={popoverRef}
          position="absolute"
          top="calc(100% + 8px)"
          right={0}
          zIndex={9999}
          minW="280px"
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="0 10px 40px rgba(0, 0, 0, 0.1)"
          overflow="hidden"
          onClick={(e) => e.stopPropagation()}
        >

            {withSelectAll && (
              <Box p={2} borderBottom="1px solid" borderBottomColor="gray.200">
                <Flex align="center" justify="space-between">
                  <Text fontWeight="medium" color="gray.700">{label}</Text>
                  <Flex gap={1}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onSelectionChange(options.map((option) => option.key))}
                      disabled={options.length === 0 || selectedKeys.length === options.length}
                    >
                      Select all
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onSelectionChange([])}
                      disabled={selectedKeys.length === 0}
                    >
                      Unselect all
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            )}
          {enableSearch && (
            <Box p={2} borderBottom="1px solid" borderBottomColor="gray.200">
              <Box position="relative">
                <Box position="absolute" left={2} top="50%" transform="translateY(-50%)" pointerEvents="none" display="flex" color="gray.400">
                  <LuSearch size={16} />
                </Box>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search specifications..."
                  pl={8}
                  pr={2}
                  py="6px"
                  h="auto"
                  bg="gray.50"
                  borderColor="gray.200"
                  borderRadius="sm"
                  color="gray.900"
                  fontSize="sm"
                  _placeholder={{ color: 'gray.400' }}
                  _focusVisible={{
                    outline: 'none',
                    borderColor: 'brand',
                    boxShadow: '0 0 0 1px var(--chakra-colors-brand)',
                  }}
                />
              </Box>
            </Box>
          )}

          <Box maxH="320px" overflowY="auto">
            {filteredOptions.length === 0 ? (
              <Text px={3} py={2} color="gray.400" textAlign="center" fontSize="sm">
                No options found
              </Text>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedKeys.includes(option.key)
                return (
                  <Button
                    key={option.key}
                    onClick={() => toggleOption(option.key)}
                    w="full"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    px={3}
                    py={2}
                    h="auto"
                    bg="transparent"
                    _hover={{ bg: 'gray.50' }}
                    textAlign="left"
                    justifyContent="flex-start"
                    borderRadius={0}
                    fontWeight="normal"
                    fontSize="sm"
                  >
                    <Flex
                      align="center"
                      justify="center"
                      w={4}
                      h={4}
                      borderWidth="1px"
                      borderColor={isSelected ? 'brand' : 'gray.300'}
                      borderRadius="2px"
                      bg={isSelected ? 'brand' : 'transparent'}
                      flexShrink={0}
                    >
                      {isSelected && <LuCheck size={12} color="white" />}
                    </Flex>
                    <Text color="gray.900" fontSize="sm">
                      {option.label}
                    </Text>
                  </Button>
                )
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
