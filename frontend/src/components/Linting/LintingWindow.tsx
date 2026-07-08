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


import { Box, Text, Heading} from '@chakra-ui/react';
import { styles as S } from './styles'
import { OPCUALintingWindowProps } from './types';
import { LintingUploadContainer } from './NodeSetUpload';



export function LintingWindow({
    height = '100%',
}: OPCUALintingWindowProps) {

    return (
        <Box h={height} {...S.container}>
            <Heading {...S.title}>
                <Text {...S.titleAccent}>CLOU</Text>{' '}
                OPC UA Linting
            </Heading>

            <LintingUploadContainer />



        </Box>
    )
}

export default LintingWindow