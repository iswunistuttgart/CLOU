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


import type { BoxProps, FlexProps } from '@chakra-ui/react'

const sectionHeader = (mb: number): FlexProps => ({
  align: 'center',
  gap: 2,
  mb,
})


export const styles = {
  // Layout/metrics-graph
  container: { display: 'flex', flexDirection: 'column', bg: 'white' } satisfies BoxProps,
  title: { as: 'h1', fontSize: '2xl', fontWeight: 'medium', color: 'gray.900', mb: 6, textAlign: 'center' } satisfies BoxProps,
  titleAccent: { as: 'span', color: 'brand' } satisfies BoxProps,

  
  
  uploadArea: { mb: 6, maxW: '80%', mx: 'auto', w: 'full', position: 'relative', zIndex: 100 } satisfies BoxProps,
  uploadRow: { justify:"space-between", mb:4, gap: 3, align: 'center', position: 'relative' } satisfies FlexProps,
  inputWrapper: { flex: 1, position: 'relative' } satisfies BoxProps,
    input: {
    pl: '16px',
    pr: '220px',
    py: '16px',
    h: 'auto',
    bg: 'white',
    borderWidth: '2px',
    borderColor: 'gray.200',
    borderRadius: 'lg',
    color: 'gray.900',
    fontSize: 'base',
    _placeholder: { color: 'gray.400', textAlign: 'center' },
    } satisfies BoxProps,
  uploadButton: {
    px: 10,
    py: '16px',
    h: 'auto',
    bg: 'brand',
    color: 'white',
    borderRadius: 'lg',
    fontSize: 'base',
    fontWeight: 'medium',
    _hover: { opacity: 0.9 },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    whiteSpace: 'nowrap',
  } satisfies BoxProps,
  metricsCalc:{flex: '0 0 400px', display: 'flex', flexDirection: 'column', py: '20px' } satisfies FlexProps,
  metricsCalcHeader: { ...sectionHeader(4), pb: 3, borderBottom: '2px solid', borderBottomColor: 'gray.200' } satisfies FlexProps,
  missingDepsRow: { gap: 3, align: 'center', position: 'relative' } satisfies FlexProps,
  missingDepsList: { flex: 1, overflowY: 'auto',pb: '16px' } satisfies BoxProps,


  graphCol: { h:'100%', display: 'flex', flexDirection: 'column' } satisfies FlexProps,
  graphHeader: {flex:'1', gap: 2, mb: 2, mt: 2, pb: 3, pt: 3} satisfies FlexProps,
  graphAccordionItem: { borderBottom: '2px solid', borderBottomColor: 'gray.200'},
  graphArea: { flex: '1',  minH:'0', h:{ base: "200px", md: "300px", lg: "400px" },  pb: 3} satisfies BoxProps,
}