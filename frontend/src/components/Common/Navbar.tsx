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


import { Flex, Image, useBreakpointValue, Heading } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

import Logo from "/assets/images/CLOU_v3_logo-cropped.svg"

function Navbar() {
  const display = useBreakpointValue({ base: "none", md: "flex" })

  return (
    <Flex
      display={display}
      justify="space-between"
      position="sticky"
      color="white"
      align="center"
      bg="bg.muted"
      w="100%"
      top={0}
      p={4}
      padding="0.25rem"
    >
      <Link to="/">
        <Image src={Logo} alt="Logo" height="60px" p={2} />
      </Link>
      <Heading size="3xl" color="brand">
      CLOU UI
      </Heading>
    </Flex>
  )
}

export default Navbar
