import { SynonymRegister, SynonymSource, SynonymStatus } from '@shared/schemas'

export interface ExtractedGlossPiece {
  gloss: string
  glossRaw: string
  extractedNote: string | null
  register: SynonymRegister
  position: number
}

export interface RawMeaningGloss {
  vocabId: number
  gloss: string
  glossRaw: string
  extractedNote: string | null
  position: number
}

export interface SynonymMemberCandidate {
  vocabId: number
  word: string
  pinyin: string
  hskLevel: number
  meaningVi: string
  exampleZh?: string | null
  examplePinyin?: string | null
  exampleVi?: string | null
  rankOrder: number
  register: SynonymRegister
  nuanceNote: string | null
  stt: number
  position: number
}

export interface SynonymGroupCandidate {
  id?: number
  rootGloss: string
  rootScore: number
  source: SynonymSource
  status: SynonymStatus
  members: SynonymMemberCandidate[]
}

export interface ISynonymSource {
  name: string
  buildCandidates(): Promise<SynonymGroupCandidate[]>
}
