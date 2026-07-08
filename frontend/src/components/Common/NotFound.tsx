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


import { Button, Center, Flex, Text } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

const NotFound = () => {
  return (
    <Flex
      height="100vh"
      align="center"
      justify="center"
      flexDir="column"
      data-testid="not-found"
      p={4}
    >
      <Flex alignItems="center" zIndex={1}>
        <Flex flexDir="column" ml={4} align="center" justify="center" p={4}>
          <Text
            fontSize={{ base: "6xl", md: "8xl" }}
            fontWeight="bold"
            lineHeight="1"
            mb={4}
          >
            404
          </Text>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Oops!
          </Text>
        </Flex>
      </Flex>

      <Text fontSize="lg" color="gray.600" mb={4} textAlign="center" zIndex={1}>
        The page you are looking for was not found.
      </Text>
      <Center zIndex={1}>
        <Link to="/">
          <Button variant="solid" colorScheme="teal" mt={4} alignSelf="center">
            Go Back
          </Button>
        </Link>
      </Center>
    </Flex>
  )
}

export default NotFound
