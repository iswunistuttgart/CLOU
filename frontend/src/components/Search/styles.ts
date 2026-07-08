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

const cardBase: BoxProps = {
  bg: 'white',
  borderWidth: '1px',
  borderColor: 'gray.200',
  borderRadius: 'lg',
  boxShadow: 'sm',
}

const badgeBase: BoxProps = {
  px: 2,
  py: '2px',
  bg: 'gray.100',
  color: 'gray.700',
  borderRadius: 'sm',
  fontSize: 'xs',
  fontWeight: 'normal',
}

const sectionHeader = (mb: number): FlexProps => ({
  align: 'center',
  gap: 2,
  mb,
})

export const styles = {
  // Layout/Search
  container: { display: 'flex', flexDirection: 'column', bg: 'white' } satisfies BoxProps,
  title: { as: 'h1', fontSize: '2xl', fontWeight: 'medium', color: 'gray.900', mb: 6, textAlign: 'center' } satisfies BoxProps,
  titleAccent: { as: 'span', color: 'brand' } satisfies BoxProps,
  searchArea: { mb: 6, maxW: '80%', mx: 'auto', w: 'full', position: 'relative', zIndex: 100 } satisfies BoxProps,
  searchRow: { gap: 3, align: 'center', position: 'relative' } satisfies FlexProps,
  inputWrapper: { flex: 1, position: 'relative' } satisfies BoxProps,
  input: {
    pl: '56px',
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
    _focusVisible: { outline: 'none', borderColor: 'brand', boxShadow: '0 0 0 3px rgba(8, 43, 81, 0.1)' },
  } satisfies BoxProps,
  inputIcon: { position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'gray.400', display: 'flex' } satisfies BoxProps,
  filterBar: { position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', gap: 2, zIndex: 100, display: 'flex' } satisfies FlexProps,
  searchButton: {
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
  selectedSpecsWrap: { flexWrap: 'wrap', gap: 2, mt: 3, justifyContent: 'center' } satisfies FlexProps,
  selectedBadge: {
    ...badgeBase,
    px: 2,
    py: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } satisfies BoxProps,

  // Split
  resultsSplit: { gap: 6, flex: 1, minH: 0 } satisfies FlexProps,
  resultsCol: { flex: '0 0 400px', display: 'flex', flexDirection: 'column' } satisfies FlexProps,
  resultsHeader: { ...sectionHeader(4), pb: 3, borderBottom: '2px solid', borderBottomColor: 'gray.200' } satisfies FlexProps,
  resultsScroll: { flex: 1, overflowY: 'auto' } satisfies BoxProps,
  detailsCol: { flex: 1, display: 'flex', flexDirection: 'column' } satisfies FlexProps,
  detailsHeader: { ...sectionHeader(4), pb: 3, borderBottom: '2px solid', borderBottomColor: 'gray.200' } satisfies FlexProps,
  detailsScroll: { flex: 1, overflowY: 'auto' } satisfies BoxProps,

  // Detail-Komponente
  detailContainer: { w: 'full' } satisfies BoxProps,
  detailHeaderWrap: { mb: 6 } satisfies BoxProps,
  detailHeaderRow: { align: 'flex-start', gap: 4, mb: 3 } satisfies FlexProps,
  detailIconBox: { flexShrink: 0, p: 3, bg: 'blue.50', borderRadius: 'lg', display: 'flex' } satisfies BoxProps,
  detailTitleCol: { flex: 1, minW: 0 } satisfies BoxProps,
  detailTitleRow: { align: 'flex-start', justify: 'space-between', gap: 4, mb: 2 } satisfies FlexProps,
  detailTitle: { as: 'h2', fontSize: '2xl', fontWeight: 'medium', color: 'gray.900' } satisfies BoxProps,
  detailBadge: { ...badgeBase, px: 3, py: 1, borderRadius: 'md' } satisfies BoxProps,
  detailLink: {
    as: 'a',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'brand',
    fontSize: 'sm',
    textDecoration: 'none',
    cursor: 'pointer',
    _hover: { textDecoration: 'underline' },
  } satisfies BoxProps,

  // Karten/Abschnitte
  cardRoot: { ...cardBase } satisfies BoxProps,
  cardBody: { p: 6 } satisfies BoxProps,
  sectionHeaderSm: { ...sectionHeader(3) } satisfies FlexProps,
  sectionHeaderLg: { ...sectionHeader(4) } satisfies FlexProps,
  sectionIcon: { color: 'brand', display: 'flex' } satisfies BoxProps,
  sectionTitle: { as: 'h3', fontSize: 'lg', fontWeight: 'medium', color: 'gray.900' } satisfies BoxProps,
  descText: { color: 'gray.900', lineHeight: 'relaxed', fontSize: 'sm' } satisfies BoxProps,

  gridTwoCols: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 } satisfies BoxProps,
  label: { as: 'label', display: 'block', color: 'gray.500', mb: 1, fontSize: 'xs' } satisfies BoxProps,
  value: { color: 'gray.900', fontFamily: 'mono', bg: 'gray.50', px: 3, py: '6px', borderRadius: 'sm', fontSize: 'sm' } satisfies BoxProps,
  valueSpanTwo: { gridColumn: 'span 2' } satisfies BoxProps,

  // Result-Card
  resultCardRoot: (selected: boolean): BoxProps => ({
    ...cardBase,
    boxShadow: selected ? 'sm' : 'none',
    borderColor: selected ? 'brand' : 'gray.200',
    bg: selected ? 'blue.50' : 'white',
    transition: 'all 0.2s',
    cursor: 'pointer',
    _hover: { borderColor: 'brand', boxShadow: 'sm' },
  }),
  resultCardBody: { p: 4 } satisfies BoxProps,
  resultCardRow: { gap: 3 } satisfies FlexProps,
  resultCardIcon: (selected: boolean): BoxProps => ({
    flexShrink: 0,
    mt: '2px',
    color: selected ? 'brand' : 'gray.400',
    display: 'flex',
  }),
  resultCardContentCol: { flex: 1, minW: 0 } satisfies BoxProps,
  resultCardTitleRow: { align: 'flex-start', justify: 'space-between', gap: 2, mb: 1 } satisfies FlexProps,
  resultCardTitle: (selected: boolean): BoxProps => ({
    as: 'h4',
    fontSize: 'md',
    fontWeight: 'medium',
    color: selected ? 'brand' : 'gray.900',
  }),
  resultCardTypeBadge: { ...badgeBase } satisfies BoxProps,
  resultCardDesc: { color: 'gray.500', fontSize: 'xs', mb: 2 } satisfies BoxProps,
  resultCardSpecBadge: {
    ...badgeBase,
    bg: 'blue.50',
    color: 'brand',
  } satisfies BoxProps,
  resultCardPinnedRoot: {
    ...cardBase,
    borderColor: 'teal.300',
    bg: 'teal.50',
    boxShadow: 'sm',
    transition: 'all 0.2s',
    cursor: 'pointer',
    _hover: { borderColor: 'teal.400', boxShadow: 'md' },
  } satisfies BoxProps,
  resultCardPinnedLabel: {
    ...badgeBase,
    bg: 'teal.100',
    color: 'teal.700',
  } satisfies BoxProps,

  // Tabs
  tabList: { gap: 2, borderBottom: '2px solid', borderBottomColor: 'gray.200', mb: 4 } satisfies BoxProps,
  tab: {
    px: 4,
    py: 2,
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'gray.500',
    cursor: 'pointer',
    borderBottom: '2px solid',
    borderBottomColor: 'transparent',
    mb: '-2px',
    _selected: { color: 'brand', borderBottomColor: 'brand' },
    _hover: { color: 'gray.700' },
  } satisfies BoxProps,
}