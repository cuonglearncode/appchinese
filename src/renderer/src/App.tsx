import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar, NavTab } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { DictionaryView } from './components/Dictionary/DictionaryView'
import { ReviewView } from './components/Review/ReviewView'
import { NotebookView } from './components/Notebook/NotebookView'
import { StatsView } from './components/Stats/StatsView'
import { SynonymMapPage } from './pages/SynonymMapPage/SynonymMapPage'
import { useTTS } from './hooks/useTTS'

// Cấu hình React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function MainApp(): React.JSX.Element {
  const [currentTab, setCurrentTab] = useState<NavTab>('dictionary')
  const { chineseVoiceName, hasChineseVoice } = useTTS()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {/* Sidebar điều hướng trái */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Vùng nội dung chính */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header ttsVoiceName={chineseVoiceName} hasChineseVoice={hasChineseVoice} />

        {/* Nội dung theo Tab */}
        <main className="flex-1 overflow-hidden">
          {currentTab === 'dictionary' && <DictionaryView />}
          {currentTab === 'synonyms' && <SynonymMapPage />}
          {currentTab === 'srs' && (
            <ReviewView onNavigateToDictionary={() => setCurrentTab('dictionary')} />
          )}
          {currentTab === 'notebook' && (
            <NotebookView onStartReview={() => setCurrentTab('srs')} />
          )}
          {currentTab === 'stats' && (
            <StatsView onStartReview={() => setCurrentTab('srs')} />
          )}
        </main>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  )
}
