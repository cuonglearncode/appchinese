import { ISynonymSource, SynonymGroupCandidate } from './interfaces'

/**
 * AI Source (Stub / Interface chờ tích hợp AI Tutor về sau)
 */
export class AiSource implements ISynonymSource {
  public name = 'ai'

  async buildCandidates(): Promise<SynonymGroupCandidate[]> {
    // Dự phòng stub chờ tích hợp Gemini / LLM trong tương lai
    return []
  }
}
