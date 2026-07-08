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


import type {
  SkeletonProps as ChakraSkeletonProps,
  CircleProps,
} from "@chakra-ui/react"
import { Skeleton as ChakraSkeleton, Circle, Stack } from "@chakra-ui/react"
import * as React from "react"

export interface SkeletonCircleProps extends ChakraSkeletonProps {
  size?: CircleProps["size"]
}

export const SkeletonCircle = React.forwardRef<
  HTMLDivElement,
  SkeletonCircleProps
>(function SkeletonCircle(props, ref) {
  const { size, ...rest } = props
  return (
    <Circle size={size} asChild ref={ref}>
      <ChakraSkeleton {...rest} />
    </Circle>
  )
})

export interface SkeletonTextProps extends ChakraSkeletonProps {
  noOfLines?: number
}

export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  function SkeletonText(props, ref) {
    const { noOfLines = 3, gap, ...rest } = props
    return (
      <Stack gap={gap} width="full" ref={ref}>
        {Array.from({ length: noOfLines }).map((_, index) => (
          <ChakraSkeleton
            height="4"
            key={index}
            {...props}
            _last={{ maxW: "80%" }}
            {...rest}
          />
        ))}
      </Stack>
    )
  },
)

export const Skeleton = ChakraSkeleton
