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


import { LuTag, LuBox, LuBoxes, LuBraces, LuMessageCircle } from 'react-icons/lu'
import type { IconType } from 'react-icons'

/**
 * Get the appropriate icon for an OPC UA node class
 * @param nodeClass - The OPC UA node class (Variable, Object, ObjectType, Property)
 * @returns The icon component to display
 */
export function getNodeIcon(nodeClass: string): IconType {
  switch (nodeClass) {
    case 'Variable':
      return LuTag
    case 'Object':
      return LuBox
    case 'ObjectType':
      return LuBoxes
    case 'DataType':
      return LuBraces
    case 'Method':
      return LuMessageCircle
    default:
      return LuBox
  }
}
