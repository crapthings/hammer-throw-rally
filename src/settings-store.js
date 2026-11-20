import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const defaultVolume = { master: 100, effects: 100, music: 100 }

export const useSettings = create(persist(
  (set) => ({
    language: 'en',
    setLanguage: (language) => set({ language: language === 'zh-CN' ? 'zh-CN' : 'en' }),
    volume: { ...defaultVolume },
    setVolume: (channel, value) => set(({ volume }) => ({
      volume: { ...volume, [channel]: value },
    })),
  }),
  {
    name: 'pieqianqiu-settings',
    partialize: ({ volume, language }) => ({ volume, language }),
    merge: (saved, current) => ({
      ...current,
      language: saved?.language === 'zh-CN' ? 'zh-CN' : current.language,
      volume: Object.fromEntries(Object.entries(defaultVolume).map(([channel, fallback]) => {
        const value = saved?.volume?.[channel]
        return [channel, Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback]
      })),
    }),
  },
))
