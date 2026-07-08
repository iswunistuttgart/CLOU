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
    lintingCalc: { flex: '0 0 400px', display: 'flex', flexDirection: 'column', py: '20px' } satisfies FlexProps,
    lintingCalcHeader: { ...sectionHeader(5), pb: 3, } satisfies FlexProps,
    missingDepsRow: { gap: 3, align: 'center', position: 'relative' } satisfies FlexProps,
    missingDepsList: { flex: 1, overflowY: 'auto', pb: '16px' } satisfies BoxProps,

      // Split
      resultsSplit: { gap: 6, flex: 1, flexDirection: {base: "column", lg: "row",}, minH: 0 } satisfies FlexProps,
      resultsCol: { flex: '0 0 200px', display: 'flex', flexDirection: 'column' } satisfies FlexProps,
      resultsHeader: { ...sectionHeader(4), pb: 3, borderBottom: '2px solid', borderBottomColor: 'gray.200' } satisfies FlexProps,
      
      detailsCol: { flex: 1, display: 'flex', flexDirection: 'column' } satisfies FlexProps,
      detailsHeader: { ...sectionHeader(4), pb: 3, borderBottom: '2px solid', borderBottomColor: 'gray.200' } satisfies FlexProps,
      detailsArea: { flex: 1, overflowY: 'auto' } satisfies BoxProps,

      overviewArea: {flex: 1, display: 'flex', flexDirection: 'column' } satisfies FlexProps,

      summaryCard: {borderWidth:"1px", borderRadius:"lg", p:"6", minW:"180px", cursor:"pointer", transition:"all 0.2s", 
        borderColor: 'gray.200', bg: 'white', boxShadow: 'sm',
      _hover:{ borderColor: "brand", transform: "translateY(-2px)",}} satisfies BoxProps,
      inconsistenciesDescription: {color:"gray.600", fontWeight:"medium", fontSize:"m"},
}
