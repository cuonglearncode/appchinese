import { useQuery } from '@tanstack/react-query'
import { StatsSummaryResponse, VocabWithProgress, WrongWordsFilter } from '@shared/schemas'

export function useStats(filter: WrongWordsFilter = { limit: 50 }) {
  // Lấy timezone offset theo phút (VD: UTC+7 = -(-420) = 420)
  const timezoneOffsetMinutes = -new Date().getTimezoneOffset()

  const summaryQuery = useQuery<StatsSummaryResponse>({
    queryKey: ['stats', 'summary', timezoneOffsetMinutes],
    queryFn: async () => {
      const res = await window.api.stats.getSummary(timezoneOffsetMinutes)
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi nạp dữ liệu thống kê')
      }
      return res.data
    },
    staleTime: 60_000
  })

  const wrongWordsQuery = useQuery<VocabWithProgress[]>({
    queryKey: ['stats', 'wrongWords', filter],
    queryFn: async () => {
      const res = await window.api.stats.getWrongWords(filter)
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi nạp danh sách từ sai')
      }
      return res.data
    },
    staleTime: 60_000
  })

  return {
    summary: summaryQuery.data ?? null,
    wrongWords: wrongWordsQuery.data ?? [],
    isLoading: summaryQuery.isLoading || wrongWordsQuery.isLoading,
    isError: summaryQuery.isError || wrongWordsQuery.isError,
    error: summaryQuery.error || wrongWordsQuery.error,
    refetch: () => {
      summaryQuery.refetch()
      wrongWordsQuery.refetch()
    }
  }
}
