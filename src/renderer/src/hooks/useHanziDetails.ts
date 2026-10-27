import { useQuery } from '@tanstack/react-query'
import { HanziDetailsResponse, HanziStrokeData } from '@shared/schemas'

export function useHanziDetails(char: string | null | undefined) {
  const targetChar = char ? Array.from(char)[0] : null

  const detailsQuery = useQuery<HanziDetailsResponse>({
    queryKey: ['hanzi', 'details', targetChar],
    queryFn: async () => {
      if (!targetChar) {
        throw new Error('Chưa cung cấp ký tự chữ Hán')
      }
      const res = await window.api.hanzi.getDetails(targetChar)
      if (!res.success) {
        throw new Error(res.error || `Không thể nạp thông tin chữ Hán "${targetChar}"`)
      }
      return res.data
    },
    enabled: Boolean(targetChar),
    staleTime: 5 * 60_000
  })

  const strokeDataQuery = useQuery<HanziStrokeData | null>({
    queryKey: ['hanzi', 'strokeData', targetChar],
    queryFn: async () => {
      if (!targetChar) return null
      const res = await window.api.hanzi.getStrokeData(targetChar)
      if (!res.success) {
        throw new Error(res.error || `Không thể nạp nét viết cho chữ "${targetChar}"`)
      }
      return res.data
    },
    enabled: Boolean(targetChar),
    staleTime: 10 * 60_000
  })

  return {
    character: detailsQuery.data?.character ?? null,
    compounds: detailsQuery.data?.compounds ?? [],
    strokeData: strokeDataQuery.data ?? null,
    isLoading: detailsQuery.isLoading || strokeDataQuery.isLoading,
    isError: detailsQuery.isError || strokeDataQuery.isError,
    error: detailsQuery.error || strokeDataQuery.error,
    refetch: () => {
      detailsQuery.refetch()
      strokeDataQuery.refetch()
    }
  }
}
