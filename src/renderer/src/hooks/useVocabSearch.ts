import { useState, useTransition, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VocabSearchFilter, VocabSearchResult } from '@shared/schemas'

export interface UseVocabSearchOptions {
  initialHskLevel?: number
  initialLimit?: number
}

export function useVocabSearch(options: UseVocabSearchOptions = {}) {
  const [query, setQueryInternal] = useState<string>('')
  const [hskLevel, setHskLevelInternal] = useState<number | undefined>(options.initialHskLevel)
  const [learningState, setLearningStateInternal] = useState<
    'all' | 'new' | 'learning' | 'review' | 'relearning'
  >('all')
  const [limit, setLimit] = useState<number>(options.initialLimit ?? 3000)
  const [offset, setOffset] = useState<number>(0)
  const [responseTimeMs, setResponseTimeMs] = useState<number>(0)
  const [, startTransition] = useTransition()

  const setQuery = useCallback((newQuery: string) => {
    startTransition(() => {
      setQueryInternal(newQuery)
      setOffset(0)
    })
  }, [])

  const setHskLevel = useCallback((level: number | undefined) => {
    startTransition(() => {
      setHskLevelInternal(level)
      setOffset(0)
    })
  }, [])

  const setLearningState = useCallback(
    (state: 'all' | 'new' | 'learning' | 'review' | 'relearning') => {
      startTransition(() => {
        setLearningStateInternal(state)
        setOffset(0)
      })
    },
    []
  )

  const filter: VocabSearchFilter = {
    query: query.trim() || undefined,
    hsk_level: hskLevel,
    state: learningState === 'all' ? undefined : learningState,
    limit,
    offset
  }

  const queryResult = useQuery<VocabSearchResult>({
    queryKey: ['vocab', 'search', filter],
    queryFn: async () => {
      const startTime = performance.now()
      const res = await window.api.vocab.search(filter)
      const duration = Math.round(performance.now() - startTime)
      setResponseTimeMs(duration)

      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi tìm kiếm từ vựng')
      }
      return res.data
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000
  })

  return {
    items: queryResult.data?.items ?? [],
    total: queryResult.data?.total ?? 0,
    hasMore:
      (queryResult.data?.offset ?? 0) + (queryResult.data?.items.length ?? 0) <
      (queryResult.data?.total ?? 0),
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    error: queryResult.error,
    responseTimeMs,
    filter: {
      query,
      hskLevel,
      learningState,
      limit,
      offset
    },
    setQuery,
    setHskLevel,
    setLearningState,
    setLimit,
    setOffset,
    refetch: queryResult.refetch
  }
}
