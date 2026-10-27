import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Notebook } from '@shared/schemas'

export function useNotebooks() {
  const queryClient = useQueryClient()

  const notebooksQuery = useQuery<Notebook[]>({
    queryKey: ['notebooks', 'list'],
    queryFn: async () => {
      const res = await window.api.notebook.list()
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi nạp danh sách sổ tay')
      }
      return res.data
    },
    staleTime: 60_000
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ notebookId, vocabId }: { notebookId: number; vocabId: number }) => {
      const res = await window.api.notebook.toggleItem({
        notebook_id: notebookId,
        vocab_id: vocabId
      })
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi cập nhật sổ tay')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
      queryClient.invalidateQueries({ queryKey: ['vocab'] })
    }
  })

  const createMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const res = await window.api.notebook.create({
        name,
        color: color || '#3b82f6'
      })
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi tạo sổ tay mới')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      color,
      sortOrder
    }: {
      id: number
      name?: string
      color?: string
      sortOrder?: number
    }) => {
      const res = await window.api.notebook.update({
        id,
        name,
        color,
        sort_order: sortOrder
      })
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi cập nhật sổ tay')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await window.api.notebook.delete(id)
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi xóa sổ tay')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
      queryClient.invalidateQueries({ queryKey: ['vocab'] })
    }
  })

  return {
    notebooks: notebooksQuery.data ?? [],
    isLoading: notebooksQuery.isLoading,
    isError: notebooksQuery.isError,
    toggleItem: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
    createNotebook: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateNotebook: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteNotebook: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetch: notebooksQuery.refetch
  }
}
