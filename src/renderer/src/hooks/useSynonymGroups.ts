import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  SynonymMapDTO,
  SynonymListGroupsRequest
} from '@shared/schemas'

export function useVocabSynonyms(vocabId?: number) {
  const query = useQuery<SynonymMapDTO[]>({
    queryKey: ['synonym', 'vocab', vocabId],
    queryFn: async () => {
      if (!vocabId) return []
      const res = await window.api.synonym.getByVocabId(vocabId)
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi tải từ đồng nghĩa')
      }
      return res.data
    },
    enabled: Boolean(vocabId && vocabId > 0),
    staleTime: 60_000
  })

  return {
    groups: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  }
}

export function useSynonymMapList(initialFilter?: Partial<SynonymListGroupsRequest>) {
  const [filter, setFilter] = useState<SynonymListGroupsRequest>({
    page: 1,
    limit: 18,
    ...initialFilter
  })

  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['synonym', 'list', filter],
    queryFn: async () => {
      const res = await window.api.synonym.listGroups(filter)
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi tải danh sách nhóm đồng nghĩa')
      }
      return res.data
    },
    staleTime: 30_000
  })

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await window.api.synonym.buildGroups()
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi tạo nhóm từ đồng nghĩa')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synonym'] })
    }
  })

  return {
    items: query.data?.items || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    limit: query.data?.limit || 18,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    filter,
    setFilter,
    refetch: query.refetch,
    buildGroups: buildMutation.mutateAsync,
    isBuilding: buildMutation.isPending
  }
}
