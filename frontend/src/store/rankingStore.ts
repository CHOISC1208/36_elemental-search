import { create } from 'zustand'
import { Weights, PRESETS, PresetKey } from '@/types/ranking'

interface RankingState {
  weights: Weights
  preset: PresetKey | 'custom'
  setWeight: (key: keyof Weights, value: number) => void
  resetWeights: () => void
  applyPreset: (preset: PresetKey) => void
}

export const useRankingStore = create<RankingState>((set) => ({
  weights: { ...PRESETS.balanced },
  preset: 'balanced',
  setWeight: (key, value) =>
    set((s) => ({ weights: { ...s.weights, [key]: value }, preset: 'custom' })),
  resetWeights: () =>
    set({ weights: { ...PRESETS.balanced }, preset: 'balanced' }),
  applyPreset: (preset) =>
    set({ weights: { ...PRESETS[preset] }, preset }),
}))
