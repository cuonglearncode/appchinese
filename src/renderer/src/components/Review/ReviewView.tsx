import React from 'react'
import { useReviewSession } from '../../hooks/useReviewSession'
import { useTTS } from '../../hooks/useTTS'
import { ReviewSetup } from './ReviewSetup'
import { ReviewHeader } from './ReviewHeader'
import { FlashcardMode } from './FlashcardMode'
import { TypingMode } from './TypingMode'
import { ClozeMode } from './ClozeMode'
import { HandwritingMode } from './HandwritingMode'
import { ReviewSummary } from './ReviewSummary'

export interface ReviewViewProps {
  onNavigateToDictionary: () => void
}

export const ReviewView: React.FC<ReviewViewProps> = ({ onNavigateToDictionary }) => {
  const {
    sessionState,
    currentIndex,
    currentWord,
    totalCards,
    mode,
    algorithm,
    stats,
    isLoading,
    error,
    startSession,
    submitAnswer,
    exitSession
  } = useReviewSession()

  const { speak } = useTTS()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 1. Màn hình Thiết lập phiên ôn tập (Setup) */}
      {sessionState === 'setup' && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <ReviewSetup
            onStart={startSession}
            isLoading={isLoading}
            error={error}
          />
        </div>
      )}

      {/* 2. Màn hình Đang ôn tập (Active Session) */}
      {sessionState === 'active' && currentWord && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Progress Header */}
          <ReviewHeader
            currentIndex={currentIndex}
            totalCards={totalCards}
            mode={mode}
            algorithm={algorithm}
            onExit={exitSession}
          />

          {/* Vùng bài tập tương tác chính */}
          <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center scrollbar-thin">
            {mode === 'flashcard' && (
              <FlashcardMode
                key={currentWord.id}
                item={currentWord}
                onRate={(rating) => submitAnswer(rating >= 2, rating)}
                onPlayTTS={speak}
              />
            )}

            {mode === 'typing' && (
              <TypingMode
                key={currentWord.id}
                item={currentWord}
                onSubmit={(isCorrect, userInput) =>
                  submitAnswer(isCorrect, undefined, userInput)
                }
                onPlayTTS={speak}
              />
            )}

            {mode === 'cloze' && (
              <ClozeMode
                key={currentWord.id}
                item={currentWord}
                onSubmit={(isCorrect, userInput) =>
                  submitAnswer(isCorrect, undefined, userInput)
                }
                onPlayTTS={speak}
              />
            )}

            {mode === 'handwriting' && (
              <HandwritingMode
                key={currentWord.id}
                item={currentWord}
                onSubmit={(isCorrect, rating, userInput) =>
                  submitAnswer(isCorrect, rating, userInput)
                }
                onPlayTTS={speak}
              />
            )}
          </div>
        </div>
      )}

      {/* 3. Màn hình Tổng kết kết quả (Summary) */}
      {sessionState === 'summary' && (
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center scrollbar-thin">
          <ReviewSummary
            stats={stats}
            onRestart={exitSession}
            onBackToDictionary={onNavigateToDictionary}
          />
        </div>
      )}
    </div>
  )
}
