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


import { IconButton } from '@chakra-ui/react'
import { LuCopy, LuCheck } from 'react-icons/lu'
import { useState } from 'react'
import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react"
import * as React from "react"

type Props = {
  value?: string | null
  ariaLabel?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export function CopyButton({
  value,
  ariaLabel = 'In Zwischenablage kopieren',
  size = 'xs',
}: Props) {
  const [hasCopied, setHasCopied] = useState(false)
  const safeValue = String(value ?? '')
  const disabled = safeValue.length === 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeValue)
      setHasCopied(true)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = safeValue
      ta.style.position = 'fixed'
      ta.style.top = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      setHasCopied(ok)
    }
    setTimeout(() => setHasCopied(false), 1200)
  }

  return (
    <Tooltip content={hasCopied ? 'Kopiert' : 'Kopieren'} openDelay={200}>
      <IconButton
        aria-label={ariaLabel}
        onClick={handleCopy}
        disabled={disabled}
        variant="ghost"
        size={size}
        color="gray.700"
      >
        {hasCopied ? <LuCheck size={16} /> : <LuCopy size={16} />}
      </IconButton>
    </Tooltip>
  )
}



export interface TooltipProps extends ChakraTooltip.RootProps {
  showArrow?: boolean
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement | null>
  content: React.ReactNode
  contentProps?: ChakraTooltip.ContentProps
  disabled?: boolean
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props

    if (disabled) return children

    return (
      <ChakraTooltip.Root {...rest}>
        <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content ref={ref} {...contentProps}>
              {showArrow && (
                <ChakraTooltip.Arrow>
                  <ChakraTooltip.ArrowTip />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    )
  },
)