import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: {
      intlCurrencyWithOptions: "{{val, currency}}",
    },
  },
  de: {
    translation: {
      intlCurrencyWithOptions: "{{val, currency}}",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option
    fallbackLng: "en",

    // For local development only
    debug: false,

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
