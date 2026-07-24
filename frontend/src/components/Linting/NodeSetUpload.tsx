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


import { Box, Button, Flex, Input, FileUpload, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useMutation} from '@tanstack/react-query';
import { LintingNodeSetProviderResponse } from './types';
import { styles as S } from './styles'
import LintingResultsSection from './LintingResultsSection';
import { runtimeConfig } from '@/runtimeConfig';


export function NodeSetFileUpload({ onUpload, numFiles }: { onUpload: (files: File[]) => Promise<void>, numFiles: number }) {
    const [files, setFiles] = useState<File[]>([]);
    const [loading,setLoading] = useState(false);
    const [resetKey, setResetKey] = useState(0);

    const handleUpload = async () => {
        if (files.length === 0) return;

        try {
            setLoading(true);

            await onUpload(files);

            
            setFiles([]);
            setResetKey(prev => prev + 1);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box {...S.uploadArea}>
            <Flex {...S.uploadRow}>
                <FileUpload.Root key={resetKey} accept={[".xml"]} onFileAccept={(e) => {
                    setFiles(e.files ?? []);
                }}
                    maxFiles={numFiles}
                    {...S.inputWrapper}>
                    <FileUpload.HiddenInput />
                    <Input asChild {...S.input}>
                        <FileUpload.Trigger>
                            <FileUpload.FileText />
                        </FileUpload.Trigger>
                    </Input>
                    <FileUpload.List clearable/>
                </FileUpload.Root>

                <Button
                    loading={loading}
                    onClick={handleUpload}
                    
                    disabled={files.length === 0 || loading}
                    {...S.uploadButton}
                >
                    Upload
                </Button>

            </Flex>
        </Box>
    );
}

async function uploadNodeSetXML(files: File[]) : Promise<LintingNodeSetProviderResponse> {
    const formData = new FormData();
    formData.append('file', files[0]);

    const baseUrl = runtimeConfig.apiUrl || '';
    const res = await fetch(`${baseUrl}/api/v1/linting/provide`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        throw new Error('Upload fehlgeschlagen');
    }

    return res.json();
}


export function useUploadNodeSet() {

  return useMutation<LintingNodeSetProviderResponse, Error, File[]>({
    mutationFn: uploadNodeSetXML,


  }); 
}

export function LintingUploadContainer2() {


    return (
        <div>

        </div>);
}

export function LintingUploadContainer() {
    const [missingDeps, setMissingDeps] = useState<string[]>([]);
    const [namespaces, setNamespaces] = useState<string[]>([]);


    const upload = useUploadNodeSet();

    const handleUpload = async (files: File[]) => {
        const data = await upload.mutateAsync(files);

        setMissingDeps(data.missing_dependencies);
        setNamespaces(data.namespaces);
    };

    return (
        <div>
            {namespaces.length === 0 && (
                <NodeSetFileUpload onUpload={handleUpload} numFiles={1} />
            )}

            {namespaces.length > 0 && (
                <div>
                    <Flex {...S.uploadRow} >
                        <Restart onPress={(state) => { setNamespaces(state); setMissingDeps(state) }} />
                        <Button {...S.uploadButton} disabled={missingDeps.length > 0} onClick={() => OnDownload()}>Download<br/>Results</Button>
                    </Flex>
                    <Box {...S.lintingCalc}>
                        <Flex {...S.lintingCalcHeader}>
                            <Text fontSize="xl" fontWeight="medium" color="gray.900">
                                Linting Results for {namespaces[0]}
                            </Text>
                        </Flex>
                    </Box>
                </div>
            )

            }


            {missingDeps.length > 0 && (
                <MissingDependenciesUpload
                    deps={missingDeps}
                    onResolved={(remaining) => setMissingDeps(remaining)}
                />
            )}

            {missingDeps.length === 0 && namespaces.length > 0 && (                
                <LintingResultsSection namespaces={namespaces} />
            )}
        </div>
    );
}

function Restart({
    onPress,
}: {
    onPress: (state: string[]) => void;
}) {
    return <>
        <Button
        onClick={() => onPress([]) }
        {...S.uploadButton}
      >
        Restart<br/>
        Linting
      </Button>
    </>
    
}

function MissingDependenciesUpload({
  deps,
  onResolved,
}: {
  deps: string[];
  onResolved: (remaining: string[]) => void;
}) {
    
  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const baseUrl = runtimeConfig.apiUrl || '';
      const res = await fetch(`${baseUrl}/api/v1/linting/provide_additional_nodesets`, {
        method: 'POST',
        body: formData,
      });
      

      return res.json(); // erwartet neue missing_dependencies
    },
    onSuccess: (data) => {        
        onResolved(data.missing_dependencies);      
    },
  });

  return (
    <Box {...S.missingDepsRow}>
        <Box {...S.missingDepsList}>
      <Text fontSize="md" fontWeight="medium" color="gray.900">Please upload the missing dependencies:</Text>
      <ul>
        {deps.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      </Box>


      <NodeSetFileUpload
        onUpload={async (files) => mutation.mutate(files) }
        numFiles={deps.length}
      />
    </Box>
  );
}

async function OnDownload() {
    const baseUrl = runtimeConfig.apiUrl || '';
    const response = await fetch(`${baseUrl}/api/v1/linting/download`);

    if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'linting.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
}



export default LintingUploadContainer