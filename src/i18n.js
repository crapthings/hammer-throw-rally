import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh-CN.json'
import { useSettings } from './settings-store.js'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'zh-CN': { translation: zh } },
  lng: useSettings.getState().language,
  fallbackLng: 'zh-CN',
  initAsync: false,
  interpolation: { escapeValue: false },
})

function updateDocument(language) {
  document.documentElement.lang = language
  document.title = i18n.t('title')
}

updateDocument(i18n.language)
i18n.on('languageChanged', updateDocument)
useSettings.subscribe((state, previous) => {
  if (state.language !== previous.language) void i18n.changeLanguage(state.language)
})
