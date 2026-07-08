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


import { Box } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import { SearchWindow, searchApiCall } from "@/components/Search"

export const Route = createFileRoute("/_layout/search")({
  component: Search,
})

// When implementing your own search API, replace `mockSearchAPI` with your function here.
// from <SearchWindow onSearch={mockSearchAPI} />
// To your API: <SearchWindow onSearch={yourApiFunction} />

function Search() {
  return (
    <Box h="calc(100vh - 80px)" p={6}>
      <SearchWindow onSearch={searchApiCall} />
    </Box>
  )
}

