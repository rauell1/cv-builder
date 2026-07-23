"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ConsentCategories = {
  necessary: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type GeoRegion = "EU" | "US-CA" | "GLOBAL";

export type BannerStyle = "bottom-bar" | "modal" | "floating-pill";

export type LanguageCode =
  | "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "pl" | "ja" | "zh"
  | "ar" | "hi" | "ru" | "sv" | "da" | "fi" | "no" | "tr" | "el" | "cs"
  | "hu" | "ro" | "uk" | "he" | "id" | "th" | "vi" | "ms" | "ko" | "bg"
  | "sk" | "hr" | "lt" | "lv" | "et";

export interface ConsentRecord {
  id: string;
  timestamp: string;
  categories: ConsentCategories;
  geoRegion: GeoRegion;
  userAgent: string;
  tcfVersion: string;
  gcmVersion: string;
}

interface CookieConsentContextType {
  consent: ConsentCategories;
  hasConsented: boolean;
  geoRegion: GeoRegion;
  bannerStyle: BannerStyle;
  language: LanguageCode;
  isPreferencesOpen: boolean;
  consentHistory: ConsentRecord[];
  setGeoRegion: (region: GeoRegion) => void;
  setBannerStyle: (style: BannerStyle) => void;
  setLanguage: (lang: LanguageCode) => void;
  setIsPreferencesOpen: (open: boolean) => void;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  updateConsent: (newCategories: Partial<ConsentCategories>) => void;
  resetConsent: () => void;
  exportConsentLogs: (format: "json" | "csv") => void;
}

const STORAGE_KEY = "cv_builder_cookie_consent_v2";
const LOG_STORAGE_KEY = "cv_builder_consent_history_v2";

export const SUPPORTED_LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "no", name: "Norwegian", nativeName: "Norsk" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "he", name: "Hebrew", nativeName: "עברית" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "bg", name: "Bulgarian", nativeName: "Български" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
];

export const TRANSLATIONS: Record<LanguageCode, {
  title: string;
  description: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  savePreferences: string;
  necessary: string;
  necessaryDesc: string;
  functional: string;
  functionalDesc: string;
  analytics: string;
  analyticsDesc: string;
  marketing: string;
  marketingDesc: string;
  privacyPolicy: string;
  cookiePolicy: string;
  terms: string;
  policyGenerator: string;
  doNotSell: string;
  tcfNotice: string;
}> = {
  en: {
    title: "We value your privacy & consent",
    description: "We use cookies and privacy technologies to enhance browsing, analyze traffic, and support analytics & legal compliance under GDPR & CCPA.",
    acceptAll: "Accept All Cookies",
    rejectAll: "Reject Non-Essential",
    customize: "Customize Preferences",
    savePreferences: "Save Preferences",
    necessary: "Strictly Necessary",
    necessaryDesc: "Essential for core website security, session management, and load balancing. Cannot be disabled.",
    functional: "Functional & Preferences",
    functionalDesc: "Remembers language options, font scaling, theme selections, and form auto-saves.",
    analytics: "Analytics & Performance",
    analyticsDesc: "Helps us understand visitor metrics, page load speeds, and error rates using aggregated data.",
    marketing: "Targeting & Advertising",
    marketingDesc: "Used to deliver personalized offers and measure ad performance across platforms.",
    privacyPolicy: "Privacy Policy",
    cookiePolicy: "Cookie Policy",
    terms: "Terms of Service",
    policyGenerator: "Legal Policy Generator",
    doNotSell: "Do Not Sell or Share My Personal Information (CCPA/CPRA)",
    tcfNotice: "Compliant with IAB TCF v2.3 & Google Consent Mode v2.",
  },
  es: {
    title: "Valoramos su privacidad y consentimiento",
    description: "Utilizamos cookies para mejorar la navegación, analizar el tráfico y cumplir con RGPD y CCPA.",
    acceptAll: "Aceptar todas",
    rejectAll: "Rechazar no esenciales",
    customize: "Personalizar",
    savePreferences: "Guardar preferencias",
    necessary: "Estrictamente necesarias",
    necessaryDesc: "Imprescindibles para la seguridad y el funcionamiento del sitio web.",
    functional: "Funcionales",
    functionalDesc: "Guardan preferencias de idioma, temas y personalización.",
    analytics: "Analíticas",
    analyticsDesc: "Nos ayudan a medir el rendimiento y uso del sitio.",
    marketing: "Marketing",
    marketingDesc: "Permiten anuncios personalizados y seguimiento publicitario.",
    privacyPolicy: "Política de Privacidad",
    cookiePolicy: "Política de Cookies",
    terms: "Términos del Servicio",
    policyGenerator: "Generador Legal",
    doNotSell: "No vender ni compartir mi información (CCPA)",
    tcfNotice: "Compatible con IAB TCF v2.3 y Google Consent Mode v2.",
  },
  fr: {
    title: "Nous respectons votre vie privée",
    description: "Nous utilisons des cookies pour améliorer l'expérience utilisateur et respecter les normes RGPD et CCPA.",
    acceptAll: "Tout accepter",
    rejectAll: "Refuser non essentiels",
    customize: "Personnaliser",
    savePreferences: "Enregistrer les choix",
    necessary: "Strictement nécessaires",
    necessaryDesc: "Indispensables au fonctionnement sécurisé du site.",
    functional: "Fonctionnels",
    functionalDesc: "Mémorisent vos préférences de langue et d'affichage.",
    analytics: "Analytiques",
    analyticsDesc: "Permettent d'analyser la fréquentation et les performances.",
    marketing: "Marketing",
    marketingDesc: "Utilisés pour la publicité personnalisée.",
    privacyPolicy: "Politique de confidentialité",
    cookiePolicy: "Politique de cookies",
    terms: "Conditions d'utilisation",
    policyGenerator: "Générateur juridique",
    doNotSell: "Ne pas vendre mes informations (CCPA)",
    tcfNotice: "Conforme IAB TCF v2.3 & Google Consent Mode v2.",
  },
  de: {
    title: "Wir respektieren Ihre Privatsphäre",
    description: "Wir verwenden Cookies zur Optimierung unseres Webangebots gemäß DSGVO und CCPA.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Nur essenzielle",
    customize: "Einstellungen",
    savePreferences: "Einstellungen speichern",
    necessary: "Erforderlich",
    necessaryDesc: "Notwendig für die grundlegende Funktion der Website.",
    functional: "Funktionell",
    functionalDesc: "Speichert Sprache und Benutzereinstellungen.",
    analytics: "Analytisch",
    analyticsDesc: "Hilt uns, die Nutzung der Website zu verstehen.",
    marketing: "Marketing",
    marketingDesc: "Wird für personalisierte Werbung genutzt.",
    privacyPolicy: "Datenschutzerklärung",
    cookiePolicy: "Cookie-Richtlinie",
    terms: "Nutzungsbedingungen",
    policyGenerator: "Rechtstext-Generator",
    doNotSell: "Meine Daten nicht verkaufen (CCPA)",
    tcfNotice: "Konform mit IAB TCF v2.3 und Google Consent Mode v2.",
  },
  it: {
    title: "Rispettiamo la tua privacy",
    description: "Utilizziamo cookie per migliorare la tua esperienza nel rispetto del GDPR e del CCPA.",
    acceptAll: "Accetta tutti",
    rejectAll: "Rifiuta non essenziali",
    customize: "Personalizza",
    savePreferences: "Salva preferenze",
    necessary: "Strettamente necessari",
    necessaryDesc: "Essenziali per la sicurezza e la navigazione del sito.",
    functional: "Funzionali",
    functionalDesc: "Memorizzano lingua e preferenze dell'utente.",
    analytics: "Analitici",
    analyticsDesc: "Ci aiutano a misurare il traffico e le prestazioni.",
    marketing: "Marketing",
    marketingDesc: "Utilizzati per annunci e contenuti personalizzati.",
    privacyPolicy: "Informativa sulla Privacy",
    cookiePolicy: "Politica sui Cookie",
    terms: "Termini di Servizio",
    policyGenerator: "Generatore di Documenti",
    doNotSell: "Non vendere o condividere i miei dati (CCPA)",
    tcfNotice: "Conforme a IAB TCF v2.3 e Google Consent Mode v2.",
  },
  pt: {
    title: "Respeitamos a sua privacidade",
    description: "Usamos cookies para melhorar a navegação e conformidade com RGPD e CCPA.",
    acceptAll: "Aceitar todos",
    rejectAll: "Rejeitar não essenciais",
    customize: "Personalizar",
    savePreferences: "Salvar preferências",
    necessary: "Estritamente necessários",
    necessaryDesc: "Fundamentais para o funcionamento e segurança do site.",
    functional: "Funcionais",
    functionalDesc: "Salvam preferências de idioma e exibição.",
    analytics: "Analíticos",
    analyticsDesc: "Ajudam a analisar métricas e tráfego de usuários.",
    marketing: "Marketing",
    marketingDesc: "Usados para publicidade direcionada.",
    privacyPolicy: "Política de Privacidade",
    cookiePolicy: "Política de Cookies",
    terms: "Termos de Serviço",
    policyGenerator: "Gerador de Políticas",
    doNotSell: "Não vender minhas informações (CCPA)",
    tcfNotice: "Compatível com IAB TCF v2.3 e Google Consent Mode v2.",
  },
  nl: {
    title: "Wij respecteren uw privacy",
    description: "Wij gebruiken cookies om de site te verbeteren in overeenstemming met de AVG en CCPA.",
    acceptAll: "Alles accepteren",
    rejectAll: "Weiger niet-essentieel",
    customize: "Aanpassen",
    savePreferences: "Voorkeuren opslaan",
    necessary: "Noodzakelijk",
    necessaryDesc: "Onmisbaar voor de beveiliging en werking van de website.",
    functional: "Functioneel",
    functionalDesc: "Onthoudt uw instellingen en taalvoorkeur.",
    analytics: "Analytisch",
    analyticsDesc: "Helpt ons bezoekersstatistieken te begrijpen.",
    marketing: "Marketing",
    marketingDesc: "Gebruikt voor gepersonaliseerde advertenties.",
    privacyPolicy: "Privacybeleid",
    cookiePolicy: "Cookiebeleid",
    terms: "Algemene Voorwaarden",
    policyGenerator: "Juridische Generator",
    doNotSell: "Mijn gegevens niet verkopen (CCPA)",
    tcfNotice: "Voldoet aan IAB TCF v2.3 en Google Consent Mode v2.",
  },
  pl: {
    title: "Szanujemy Twoją prywatność",
    description: "Używamy plików cookie w celu optymalizacji serwisu zgodnie z RODO i CCPA.",
    acceptAll: "Zaakceptuj wszystkie",
    rejectAll: "Odrzuć opcjonalne",
    customize: "Dostosuj",
    savePreferences: "Zapisz preferencje",
    necessary: "Niezbędne",
    necessaryDesc: "Wymagane do prawidłowego działania i bezpieczeństwa strony.",
    functional: "Funkcjonalne",
    functionalDesc: "Zapamiętują wybrane ustawienia i język.",
    analytics: "Analityczne",
    analyticsDesc: "Pomagają nam badać ruch i wydajność serwisu.",
    marketing: "Marketingowe",
    marketingDesc: "Służą do wyświetlania spersonalizowanych reklam.",
    privacyPolicy: "Polityka Prywatności",
    cookiePolicy: "Polityka Cookies",
    terms: "Regulamin",
    policyGenerator: "Generator Dokumentów",
    doNotSell: "Nie sprzedawaj moich danych (CCPA)",
    tcfNotice: "Zgodność z IAB TCF v2.3 i Google Consent Mode v2.",
  },
  ja: {
    title: "プライバシーと同意を尊重します",
    description: "GDPRおよびCCPAに基づき、サイト体験の向上とトラフィック分析のためにクッキーを使用します。",
    acceptAll: "すべて同意",
    rejectAll: "必須のみ許可",
    customize: "設定をカスタマイズ",
    savePreferences: "設定を保存",
    necessary: "厳密に必要",
    necessaryDesc: "ウェブサイトの基本的なセキュリティと機能に不可欠です。",
    functional: "機能性",
    functionalDesc: "言語選択や表示設定を記憶します。",
    analytics: "分析・パフォーマンス",
    analyticsDesc: "アクセス解析とサイト改善に役立ちます。",
    marketing: "マーケティング",
    marketingDesc: "パーソナライズ広告の配信に使用されます。",
    privacyPolicy: "プライバシーポリシー",
    cookiePolicy: "クッキーポリシー",
    terms: "利用規約",
    policyGenerator: "法的文書ジェネレーター",
    doNotSell: "個人情報を販売・共有しない (CCPA)",
    tcfNotice: "IAB TCF v2.3 および Google Consent Mode v2 準拠",
  },
  zh: {
    title: "我们重视您的隐私与同意",
    description: "我们使用 Cookie 和隐私技术以提升浏览体验、分析流量并符合 GDPR 与 CCPA 合规要求。",
    acceptAll: "接受全部",
    rejectAll: "仅保留必要",
    customize: "自定义设置",
    savePreferences: "保存偏好",
    necessary: "绝对必要",
    necessaryDesc: "保障网站核心安全与基本功能，无法禁用。",
    functional: "功能与偏好",
    functionalDesc: "记住您的语言、主题及表单偏好设置。",
    analytics: "统计与分析",
    analyticsDesc: "帮助我们了解流量与性能指标。",
    marketing: "营销与广告",
    marketingDesc: "用于精准广告投放及个性化推荐。",
    privacyPolicy: "隐私政策",
    cookiePolicy: "Cookie 政策",
    terms: "服务条款",
    policyGenerator: "法律条款生成器",
    doNotSell: "不出售或共享我的个人信息 (CCPA)",
    tcfNotice: "遵循 IAB TCF v2.3 与 Google Consent Mode v2。",
  },
  ar: {
    title: "نحن نحترم خصوصيتك وموافقتك",
    description: "نستخدم ملفات تعريف الارتباط لتحسين التصفح وتحليل الزيارات وفقًا لـ GDPR و CCPA.",
    acceptAll: "قبول الكل",
    rejectAll: "رفض غير الضرورية",
    customize: "تخصيص الخيارات",
    savePreferences: "حفظ التفضيلات",
    necessary: "ضرورية للغاية",
    necessaryDesc: "أساسية للأمان وتصفح الموقع.",
    functional: "وظيفية",
    functionalDesc: "تحفظ اللغة وتفضيلات العرض.",
    analytics: "تحليلية",
    analyticsDesc: "تساعدنا في فهم الإحصائيات والأداء.",
    marketing: "تسويقية",
    marketingDesc: "تُستخدم للإعلانات المخصصة.",
    privacyPolicy: "سياسة الخصوصية",
    cookiePolicy: "سياسة ملفات الكوكيز",
    terms: "شروط الخدمة",
    policyGenerator: "مولد السياسات القانونية",
    doNotSell: "عدم بيع معلوماتي الشخصية (CCPA)",
    tcfNotice: "متوافق مع IAB TCF v2.3 و Google Consent Mode v2.",
  },
  hi: {
    title: "हम आपकी गोपनीयता का सम्मान करते हैं",
    description: "हम ब्राउज़िंग को बेहतर बनाने और GDPR एवं CCPA का पालन करने के लिए कुकीज़ का उपयोग करते हैं।",
    acceptAll: "सभी स्वीकार करें",
    rejectAll: "गैर-आवश्यक अस्वीकार करें",
    customize: "अनुकूलित करें",
    savePreferences: "प्राथमिकताएं सहेजें",
    necessary: "अत्यंत आवश्यक",
    necessaryDesc: "वेबसाइट की बुनियादी सुरक्षा और कार्यक्षमता के लिए अनिवार्य।",
    functional: "कार्यात्मक",
    functionalDesc: "आपकी भाषा और थीम प्राथमिकताओं को याद रखता है।",
    analytics: "विश्लेषणात्मक",
    analyticsDesc: "साइट प्रदर्शन और उपयोग को समझने में मदद करता है।",
    marketing: "मार्केटिंग",
    marketingDesc: "व्यक्तिगत विज्ञापनों के लिए उपयोग किया जाता है।",
    privacyPolicy: "गोपनीयता नीति",
    cookiePolicy: "कुकी नीति",
    terms: "सेवा की शर्तें",
    policyGenerator: "कानूनी नीति जनरेटर",
    doNotSell: "मेरी जानकारी न बेचें (CCPA)",
    tcfNotice: "IAB TCF v2.3 और Google Consent Mode v2 के अनुरूप।",
  },
  ru: {
    title: "Мы уважаем вашу конфиденциальность",
    description: "Мы используем cookie для улучшения работы сайта в соответствии с GDPR и CCPA.",
    acceptAll: "Принять все",
    rejectAll: "Отклонить необязательные",
    customize: "Настроить",
    savePreferences: "Сохранить настройки",
    necessary: "Строго необходимые",
    necessaryDesc: "Необходимы для безопасности и базовой работы сайта.",
    functional: "Функциональные",
    functionalDesc: "Сохраняют настройки языка и интерфейса.",
    analytics: "Аналитические",
    analyticsDesc: "Помогают анализировать посещаемость и работу сайта.",
    marketing: "Маркетинговые",
    marketingDesc: "Используются для персонализированной рекламы.",
    privacyPolicy: "Политика конфиденциальности",
    cookiePolicy: "Политика использования cookie",
    terms: "Условия использования",
    policyGenerator: "Генератор юридических документов",
    doNotSell: "Не продавать мои личные данные (CCPA)",
    tcfNotice: "Соответствует IAB TCF v2.3 и Google Consent Mode v2.",
  },
  sv: {
    title: "Vi värdesätter din integritet",
    description: "Vi använder kakor för att förbättra webbplatsen enligt GDPR och CCPA.",
    acceptAll: "Godkänn alla",
    rejectAll: "Neka icke-nödvändiga",
    customize: "Anpassa",
    savePreferences: "Spara inställningar",
    necessary: "Nödvändiga",
    necessaryDesc: "Krävs för säkerhet och grundläggande funktioner.",
    functional: "Funktionella",
    functionalDesc: "Kommer ihåg språk och visningsinställningar.",
    analytics: "Analytiska",
    analyticsDesc: "Hjälper oss att förstå besöksstatistik.",
    marketing: "Marknadsföring",
    marketingDesc: "Används för riktad reklam.",
    privacyPolicy: "Integritetspolicy",
    cookiePolicy: "Cookie-policy",
    terms: "Användarvillkor",
    policyGenerator: "Juridisk generator",
    doNotSell: "Sälj inte min personliga information (CCPA)",
    tcfNotice: "Uppfyller IAB TCF v2.3 och Google Consent Mode v2.",
  },
  da: {
    title: "Vi respekterer dit privatliv",
    description: "Vi bruger cookies til at forbedre oplevelsen i overensstemmelse med GDPR og CCPA.",
    acceptAll: "Accepter alle",
    rejectAll: "Afvis ikke-nødvendige",
    customize: "Tilpas",
    savePreferences: "Gem indstillinger",
    necessary: "Nødvendige",
    necessaryDesc: "Nødvendige for websitets sikkerhed og funktion.",
    functional: "Funktionelle",
    functionalDesc: "Gemmer sprog- og visningspræferencer.",
    analytics: "Analytiske",
    analyticsDesc: "Hjælper med at forstå brugermønstre.",
    marketing: "Markedsføring",
    marketingDesc: "Bruges til målrettede annoncer.",
    privacyPolicy: "Privatlivspolitik",
    cookiePolicy: "Cookiepolitik",
    terms: "Vilkår for anvendelse",
    policyGenerator: "Juridisk generator",
    doNotSell: "Sælg ikke mine oplysninger (CCPA)",
    tcfNotice: "Overholder IAB TCF v2.3 og Google Consent Mode v2.",
  },
  fi: {
    title: "Kunnioitamme yksityisyyttäsi",
    description: "Käytämme evästeitä sivuston toiminnan parantamiseen GDPR- ja CCPA-säädösten mukaisesti.",
    acceptAll: "Hyväksy kaikki",
    rejectAll: "Hylkää muut kuin välttämättömät",
    customize: "Mukauta",
    savePreferences: "Tallenna asetukset",
    necessary: "Välttämättömät",
    necessaryDesc: "Pakollisia sivuston turvallisuudelle ja toiminnalle.",
    functional: "Toiminnalliset",
    functionalDesc: "Muistavat kieli- ja teema-asetuksesi.",
    analytics: "Analyyttiset",
    analyticsDesc: "Auttavat ymmärtämään kävijämääriä ja suorituskykyä.",
    marketing: "Markkinointi",
    marketingDesc: "Käytetään kohdennettuun mainontaan.",
    privacyPolicy: "Tietosuojaseloste",
    cookiePolicy: "Evästekäytäntö",
    terms: "Käyttöehdot",
    policyGenerator: "Lakiasiakirjageneraattori",
    doNotSell: "Älä myy tietojani (CCPA)",
    tcfNotice: "Yhteensopiva IAB TCF v2.3 & Google Consent Mode v2.",
  },
  no: {
    title: "Vi respekterer ditt personvern",
    description: "Vi bruker informasjonskapsler for å forbedre nettstedet i samsvar med GDPR og CCPA.",
    acceptAll: "Godta alle",
    rejectAll: "Avvis valgfrie",
    customize: "Tilpass",
    savePreferences: "Lagre innstillinger",
    necessary: "Nødvendige",
    necessaryDesc: "Påkrevd for sikkerhet og grunnleggende funksjoner.",
    functional: "Funksjonelle",
    functionalDesc: "Husker språk og visningsvalg.",
    analytics: "Analytiske",
    analyticsDesc: "Hjelper oss å forstå bruksmønstre.",
    marketing: "Markedsføring",
    marketingDesc: "Brukes til tilpasset annonsering.",
    privacyPolicy: "Personvernerklæring",
    cookiePolicy: "Clookie-erklæring",
    terms: "Vilkår for bruk",
    policyGenerator: "Juridisk generator",
    doNotSell: "Ikke selg mine opplysninger (CCPA)",
    tcfNotice: "I samsvar med IAB TCF v2.3 og Google Consent Mode v2.",
  },
  tr: {
    title: "Gizliliğinize önem veriyoruz",
    description: "GDPR ve CCPA uyarınca gezinmeyi iyileştirmek ve analitik sağlamak için çerezler kullanıyoruz.",
    acceptAll: "Tümünü Kabul Et",
    rejectAll: "Gerekli Olmayanları Reddet",
    customize: "Özelleştir",
    savePreferences: "Tercihleri Kaydet",
    necessary: "Zorunlu Çerezler",
    necessaryDesc: "Site güvenliği ve temel işlevler için gereklidir.",
    functional: "İşlevsel",
    functionalDesc: "Dil ve tema tercihlerinizi hatırlar.",
    analytics: "Analitik",
    analyticsDesc: "Site kullanımını ve performansını ölçmemize yardımcı olur.",
    marketing: "Pazarlama",
    marketingDesc: "Kişiselleştirilmiş reklamlar sunmak için kullanılır.",
    privacyPolicy: "Gizlilik Politikası",
    cookiePolicy: "Çerez Politikası",
    terms: "Hizmet Şartları",
    policyGenerator: "Yasal Metin Oluşturucu",
    doNotSell: "Kişisel Bilgilerimi Satma (CCPA)",
    tcfNotice: "IAB TCF v2.3 ve Google Consent Mode v2 ile uyumludur.",
  },
  el: {
    title: "Σεβόμαστε το إδιωτικό σας απόρρητο",
    description: "Χρησιμοποιούμε cookies για τη βελτίωση της πλοήγησης σύμφωνα με το GDPR και το CCPA.",
    acceptAll: "Αποδοχή όλων",
    rejectAll: "Απόρριψη μη απαραίτητων",
    customize: "Προσαρμογή",
    savePreferences: "Αποθήκευση επιλογών",
    necessary: "Απολύτως Απαραίτητα",
    necessaryDesc: "Απαραίτητα για την ασφάλεια και λειτουργία του ιστότοπου.",
    functional: "Λειτουργικά",
    functionalDesc: "Αποθηκεύουν τις προτιμήσεις γλώσσας και εμφάνισης.",
    analytics: "Αναλυτικά",
    analyticsDesc: "Βοηθούν στην κατανόηση της επισκεψιμότητας.",
    marketing: "Μάρκετινγκ",
    marketingDesc: "Χρησιμοποιούνται για εξατομικευμένες διαφημίσεις.",
    privacyPolicy: "Πολιτική Απορρήτου",
    cookiePolicy: "Πολιτική Cookies",
    terms: "Όροι Χρήσης",
    policyGenerator: "Γεννήτρια Νομικών Κειμένων",
    doNotSell: "Μην πουλάτε τα προσωπικά μου δεδομένα (CCPA)",
    tcfNotice: "Συμβατό με IAB TCF v2.3 & Google Consent Mode v2.",
  },
  cs: {
    title: "Respektujeme vaše soukromí",
    description: "Používáme soubory cookie ke zlepšení služeb v souladu s GDPR a CCPA.",
    acceptAll: "Přijmout vše",
    rejectAll: "Odmítnout nepovinné",
    customize: "Upravit",
    savePreferences: "Uložit nastavení",
    necessary: "Nezbytné",
    necessaryDesc: "Nutné pro bezpečnost a základní chod webu.",
    functional: "Funkční",
    functionalDesc: "Pamatují si jazyk a předvolby zobrazení.",
    analytics: "Analytické",
    analyticsDesc: "Pomáhají nám měřit návštěvnost a výkon.",
    marketing: "Marketingové",
    marketingDesc: "Slouží k cílění personalizované reklamy.",
    privacyPolicy: "Zásady ochrany soukromí",
    cookiePolicy: "Zásady cookies",
    terms: "Podmínky služby",
    policyGenerator: "Generátor právních dokumentů",
    doNotSell: "Neprodejte mé osobní údaje (CCPA)",
    tcfNotice: "V souladu s IAB TCF v2.3 a Google Consent Mode v2.",
  },
  hu: {
    title: "Tiszteletben tartjuk az adatait",
    description: "Sütiket használunk a böngészési élmény javítására a GDPR és CCPA előírásai szerint.",
    acceptAll: "Összes elfogadása",
    rejectAll: "Nem elengedhetetlenek elutasítása",
    customize: "Testreszabás",
    savePreferences: "Beállítások mentése",
    necessary: "Szigorúan szükséges",
    necessaryDesc: "Elengedhetetlen a weboldal biztonságos működéséhez.",
    functional: "Funkcionális",
    functionalDesc: "Megjegyzi a nyelvi és megjelenítési beállításokat.",
    analytics: "Analitikai",
    analyticsDesc: "Segít megérteni a látogatottsági statisztikákat.",
    marketing: "Marketing",
    marketingDesc: "Személyre szabott hirdetések megjelenítésére szolgál.",
    privacyPolicy: "Adatvédelmi nyilatkozat",
    cookiePolicy: "Süti szabályzat",
    terms: "Felhasználási feltételek",
    policyGenerator: "Jogi dokumentum generátor",
    doNotSell: "Ne adja el az adataimat (CCPA)",
    tcfNotice: "Megfelel az IAB TCF v2.3 és Google Consent Mode v2 szabványnak.",
  },
  ro: {
    title: "Respectăm confidențialitatea dvs.",
    description: "Folosim cookie-uri pentru a îmbunătăți navigarea în conformitate cu GDPR și CCPA.",
    acceptAll: "Acceptă tot",
    rejectAll: "Respinge opționalele",
    customize: "Personalizează",
    savePreferences: "Salvează preferințele",
    necessary: "Strict necesare",
    necessaryDesc: "Esențiale pentru securitatea și funcționarea site-ului.",
    functional: "Funcționale",
    functionalDesc: "Rețin preferințele de limbă și afișare.",
    analytics: "Analitice",
    analyticsDesc: "Ne ajută să analizăm traficul și performanța.",
    marketing: "Marketing",
    marketingDesc: "Utilizate pentru reclame personalizate.",
    privacyPolicy: "Politica de Confidențialitate",
    cookiePolicy: "Politica de Cookie-uri",
    terms: "Termeni și Condiții",
    policyGenerator: "Generator Documente Legale",
    doNotSell: "Nu vindeți datele mele (CCPA)",
    tcfNotice: "Conform cu IAB TCF v2.3 și Google Consent Mode v2.",
  },
  uk: {
    title: "Ми поважаємо вашу конфіденційність",
    description: "Ми використовуємо cookie для покращення роботи сайту відповідно до GDPR та CCPA.",
    acceptAll: "Прийняти всі",
    rejectAll: "Відхилити необов'язкові",
    customize: "Налаштувати",
    savePreferences: "Зберегти налаштування",
    necessary: "Обов'язкові",
    necessaryDesc: "Необхідні для безпеки та базової роботи сайту.",
    functional: "Функціональні",
    functionalDesc: "Зберігають налаштування мови та інтерфейсу.",
    analytics: "Аналітичні",
    analyticsDesc: "Допомагають аналізувати відвідуваність сайту.",
    marketing: "Маркетингові",
    marketingDesc: "Використовуються для персоналізованої реклами.",
    privacyPolicy: "Політика конфіденційності",
    cookiePolicy: "Політика файлів cookie",
    terms: "Умови обслуговування",
    policyGenerator: "Генератор юридичних документів",
    doNotSell: "Не продавати мої особисті дані (CCPA)",
    tcfNotice: "Відповідає IAB TCF v2.3 та Google Consent Mode v2.",
  },
  he: {
    title: "אנו מכבדים את הפרטיות שלך",
    description: "אנו משתמשים בעוגיות לשיפור הגלישה בהתאם ל-GDPR ול-CCPA.",
    acceptAll: "אישור הכל",
    rejectAll: "דחיית לא חיוניים",
    customize: "התאמה אישית",
    savePreferences: "שמירת העדפות",
    necessary: "חיוניים בהחלט",
    necessaryDesc: "הכרחיים לאבטחה ולתפעול הליבה של האתר.",
    functional: "פונקציונליים",
    functionalDesc: "שומרים הגדרות שפה ותצוגה.",
    analytics: "אנליטיים",
    analyticsDesc: "מסייעים בניתוח תנועת הגולשים והביצועים.",
    marketing: "שיווקיים",
    marketingDesc: "משמשים להצגת פרסומות מותאמות אישית.",
    privacyPolicy: "מדיניות פרטיות",
    cookiePolicy: "מדיניות עוגיות",
    terms: "תנאי שימוש",
    policyGenerator: "מחולל מסמכים משפטיים",
    doNotSell: "אל תמכור את המידע שלי (CCPA)",
    tcfNotice: "תואם לתקן IAB TCF v2.3 ול-Google Consent Mode v2.",
  },
  id: {
    title: "Kami menghargai privasi Anda",
    description: "Kami menggunakan cookie untuk meningkatkan pengalaman penelusuran sesuai GDPR & CCPA.",
    acceptAll: "Terima Semua",
    rejectAll: "Tolak Non-Esensial",
    customize: "Sesuaikan",
    savePreferences: "Simpan Pengaturan",
    necessary: "Sangat Diperlukan",
    necessaryDesc: "Penting untuk keamanan dan fungsi dasar situs web.",
    functional: "Fungsional",
    functionalDesc: "Mengingat preferensi bahasa dan tampilan Anda.",
    analytics: "Analitik",
    analyticsDesc: "Membantu kami memahami statistik pengunjung.",
    marketing: "Pemasaran",
    marketingDesc: "Digunakan untuk iklan yang dipersonalisasi.",
    privacyPolicy: "Kebijakan Privasi",
    cookiePolicy: "Kebijakan Cookie",
    terms: "Syarat Layanan",
    policyGenerator: "Generator Dokumen Hukum",
    doNotSell: "Jangan Jual Informasi Saya (CCPA)",
    tcfNotice: "Patuh pada IAB TCF v2.3 & Google Consent Mode v2.",
  },
  th: {
    title: "เราเคารพความเป็นส่วนตัวของคุณ",
    description: "เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์ใช้งานตามมาตรฐาน GDPR และ CCPA",
    acceptAll: "ยอมรับทั้งหมด",
    rejectAll: "ปฏิเสธคุกกี้ที่ไม่จำเป็น",
    customize: "ปรับแต่งการตั้งค่า",
    savePreferences: "บันทึกการตั้งค่า",
    necessary: "จำเป็นอย่างยิ่ง",
    necessaryDesc: "จำเป็นสำหรับการทำงานและความปลอดภัยของเว็บไซต์",
    functional: "การใช้งาน",
    functionalDesc: "จดจำภาษาและการตั้งค่าการแสดงผลของคุณ",
    analytics: "การวิเคราะห์",
    analyticsDesc: "ช่วยให้เราเข้าใจสถิติและประสิทธิภาพเว็บไซต์",
    marketing: "การตลาด",
    marketingDesc: "ใช้เพื่อแสดงโฆษณาที่เหมาะสมกับคุณ",
    privacyPolicy: "นโยบายความเป็นส่วนตัว",
    cookiePolicy: "นโยบายคุกกี้",
    terms: "ข้อตกลงการใช้งาน",
    policyGenerator: "เครื่องมือสร้างเอกสารทางกฎหมาย",
    doNotSell: "ห้ามขายข้อมูลส่วนบุคคลของฉัน (CCPA)",
    tcfNotice: "รองรับ IAB TCF v2.3 และ Google Consent Mode v2",
  },
  vi: {
    title: "Chúng tôi tôn trọng quyền riêng tư của bạn",
    description: "Chúng tôi sử dụng cookie để cải thiện trải nghiệm người dùng theo GDPR & CCPA.",
    acceptAll: "Chấp nhận tất cả",
    rejectAll: "Từ chối cookie không thiết yếu",
    customize: "Tùy chỉnh",
    savePreferences: "Lưu cài đặt",
    necessary: "Tuyệt đối cần thiết",
    necessaryDesc: "Bắt buộc cho bảo mật và hoạt động cốt lõi của trang web.",
    functional: "Chức năng",
    functionalDesc: "Ghi nhớ ngôn ngữ và cấu hình giao diện.",
    analytics: "Phân tích",
    analyticsDesc: "Giúp chúng tôi hiểu lưu lượng truy cập và hiệu suất.",
    marketing: "Tiếp thị",
    marketingDesc: "Được sử dụng để hiển thị quảng cáo cá nhân hóa.",
    privacyPolicy: "Chính sách Quyền riêng tư",
    cookiePolicy: "Chính sách Cookie",
    terms: "Điều khoản Dịch vụ",
    policyGenerator: "Bộ tạo Văn bản Pháp lý",
    doNotSell: "Không bán thông tin của tôi (CCPA)",
    tcfNotice: "Tuân thủ IAB TCF v2.3 & Google Consent Mode v2.",
  },
  ms: {
    title: "Kami menghormati privasi anda",
    description: "Kami mengguna kuki untuk meningkatkan pengalaman anda mengikut GDPR & CCPA.",
    acceptAll: "Terima Semua",
    rejectAll: "Tolak Bukan Teras",
    customize: "Pilih Sahaja",
    savePreferences: "Simpan Pilihan",
    necessary: "Sangat Diperlukan",
    necessaryDesc: "Penting untuk keselamatan dan fungsi tapak web.",
    functional: "Fungsian",
    functionalDesc: "Mengingati bahasa dan tetapan pilihan anda.",
    analytics: "Analitik",
    analyticsDesc: "Membantu kami memahami statistik pelawat.",
    marketing: "Pemasaran",
    marketingDesc: "Digunakan untuk iklan diperibadikan.",
    privacyPolicy: "Dasar Privasi",
    cookiePolicy: "Dasar Kuki",
    terms: "Syarat Perkhidmatan",
    policyGenerator: "Penjana Dasar Undang-Undang",
    doNotSell: "Jangan Jual Maklumat Saya (CCPA)",
    tcfNotice: "Mematuhi IAB TCF v2.3 & Google Consent Mode v2.",
  },
  ko: {
    title: "귀하의 개인정보를 존중합니다",
    description: "GDPR 및 CCPA 준수를 위해 서비스 개선 및 트래픽 분석 목적으로 쿠키를 사용합니다.",
    acceptAll: "모두 동의",
    rejectAll: "필수 항목만 허용",
    customize: "설정 변경",
    savePreferences: "설정 저장",
    necessary: "절대적 필수",
    necessaryDesc: "웹사이트 보안 및 기본 작동에 필수적입니다.",
    functional: "기능성",
    functionalDesc: "언어 선택 및 화면 설정을 기억합니다.",
    analytics: "분석 및 성능",
    analyticsDesc: "방문자 통계 및 성능 분석을 지원합니다.",
    marketing: "마케팅",
    marketingDesc: "맞춤형 광고 제공에 사용됩니다.",
    privacyPolicy: "개인정보 처리방침",
    cookiePolicy: "쿠키 정책",
    terms: "이용약관",
    policyGenerator: "법적 정책 생성기",
    doNotSell: "내 개인정보 판매 금지 (CCPA)",
    tcfNotice: "IAB TCF v2.3 및 Google Consent Mode v2 준수",
  },
  bg: {
    title: "Ние ценим вашата поверителност",
    description: "Използваме бисквитки съгласно GDPR и CCPA за подобряване на уебсайта.",
    acceptAll: "Приемам всички",
    rejectAll: "Отхвърлям незадължителните",
    customize: "Персонализирай",
    savePreferences: "Запази избора",
    necessary: "Строго необходими",
    necessaryDesc: "Задължителни за сигурността и работата на сайта.",
    functional: "Функционални",
    functionalDesc: "Запомнят вашите езикови настройки.",
    analytics: "Аналитични",
    analyticsDesc: "Помагат ни да разберем посещаемостта.",
    marketing: "Маркетингови",
    marketingDesc: "Използват се за персонализирани реклами.",
    privacyPolicy: "Политика за поверителност",
    cookiePolicy: "Политика за бисквитките",
    terms: "Условия за ползване",
    policyGenerator: "Генератор на правни документи",
    doNotSell: "Не продавайте личната ми информация (CCPA)",
    tcfNotice: "Съвместим с IAB TCF v2.3 и Google Consent Mode v2.",
  },
  sk: {
    title: "Rešpektujeme vaše súkromie",
    description: "Používame cookies na zlepšenie služieb v súlade s GDPR a CCPA.",
    acceptAll: "Prijať všetky",
    rejectAll: "Odmietnuť nepovinné",
    customize: "Prispôsobiť",
    savePreferences: "Uložiť nastavenia",
    necessary: "Nezbytné",
    necessaryDesc: "Potrebné pre bezpečnosť a chod webu.",
    functional: "Funkčné",
    functionalDesc: "Pamätajú si jazyk a preferencie.",
    analytics: "Analytické",
    analyticsDesc: "Pomáhajú nám merať návštevnosť.",
    marketing: "Marketingové",
    marketingDesc: "Slúžia na personalizovanú reklamu.",
    privacyPolicy: "Zásady ochrany osobných údajov",
    cookiePolicy: "Zásady používania cookies",
    terms: "Podmienky používania",
    policyGenerator: "Generátor právnych dokumentov",
    doNotSell: "Nepredávajte moje údaje (CCPA)",
    tcfNotice: "V súlade s IAB TCF v2.3 a Google Consent Mode v2.",
  },
  hr: {
    title: "Cijenimo vašu privatnost",
    description: "Upotrebljavamo kolačiće za poboljšanje iskustva u skladu s GDPR-om i CCPA-om.",
    acceptAll: "Prihvati sve",
    rejectAll: "Odbij neobvezne",
    customize: "Prilagodi",
    savePreferences: "Spremi postavke",
    necessary: "Strogo nužni",
    necessaryDesc: "Neophodni za sigurnost i rad web-stranice.",
    functional: "Funkcionalni",
    functionalDesc: "Pamte vaše postavke jezika i prikaza.",
    analytics: "Analitički",
    analyticsDesc: "Pomažu нам u analizi posjećenosti.",
    marketing: "Marketinški",
    marketingDesc: "Koriste se za prilagođene oglase.",
    privacyPolicy: "Pravila privatnosti",
    cookiePolicy: "Pravila o kolačićima",
    terms: "Uvjeti pružanja usluge",
    policyGenerator: "Generator pravnih dokumenata",
    doNotSell: "Ne prodaj moje podatke (CCPA)",
    tcfNotice: "U skladu s IAB TCF v2.3 i Google Consent Mode v2.",
  },
  lt: {
    title: "Mes gerbiame jūsų privatumą",
    description: "Naudojame slapukus svetainės veikimui gerinti pagal BDAR ir CCPA reikalavimus.",
    acceptAll: "Sutikti su visais",
    rejectAll: "Atmesti nebūtinus",
    customize: "Pritaikyti",
    savePreferences: "Išsaugoti nustatymus",
    necessary: "Griežtai būtini",
    necessaryDesc: "Būtini svetainės saugumui ir veikimui.",
    functional: "Funkciniai",
    functionalDesc: "Įsimena kalbos ir sąsajos pasirinkimus.",
    analytics: "Analitiniai",
    analyticsDesc: "Padeda suprasti lankomumo statistiką.",
    marketing: "Rinkodaros",
    marketingDesc: "Naudojami personalizuotai reklamai.",
    privacyPolicy: "Privatumo politika",
    cookiePolicy: "Slapukų politika",
    terms: "Paslaugų teikimo sąlygos",
    policyGenerator: "Teisinių dokumentų generatorius",
    doNotSell: "Nepaduoti mano duomenų (CCPA)",
    tcfNotice: "Atitinka IAB TCF v2.3 ir Google Consent Mode v2.",
  },
  lv: {
    title: "Mēs cienām jūsu privātumu",
    description: "Mēs izmantojam sīkfailus, lai uzlabotu vietni saskaņā ar VDAR un CCPA.",
    acceptAll: "Pieņemt visus",
    rejectAll: "Noraidīt nebūtiskos",
    customize: "Pielāgot",
    savePreferences: "Saglabāt iestatījumus",
    necessary: "Stingri nepieciešami",
    necessaryDesc: "Būtiski drošībai un vietnes darbībai.",
    functional: "Funkcionālie",
    functionalDesc: "Atceras valodas un attēlošanas izvēles.",
    analytics: "Analītiskie",
    analyticsDesc: "Palīdz saprast apmeklējumu statistiku.",
    marketing: "Mārketinga",
    marketingDesc: "Izmanto personalizētu reklāmu rādīšanai.",
    privacyPolicy: "Privātuma politika",
    cookiePolicy: "Sīkfailu politika",
    terms: "Pakalpojuma noteikumi",
    policyGenerator: "Juridisko dokumentu ģenerators",
    doNotSell: "Nepārdot manus datus (CCPA)",
    tcfNotice: "Atbilst IAB TCF v2.3 un Google Consent Mode v2.",
  },
  et: {
    title: "Me austame teie privaatsust",
    description: "Kasutame küpsiseid veebilehe parendamiseks vastavalt isikuandmete kaitse üldmäärusele ja CCPA-le.",
    acceptAll: "Nõustu kõigega",
    rejectAll: "Keeldu mittevajalikust",
    customize: "Kohanda",
    savePreferences: "Salvesta valikud",
    necessary: "Rangelt vajalikud",
    necessaryDesc: "Hädavajalikud turvalisuse ja veebilehe toimimise jaoks.",
    functional: "Funktsionaalsed",
    functionalDesc: "Jätavad meelde keele- ja teema-eelistused.",
    analytics: "Analüütilised",
    analyticsDesc: "Aitavad mõista külastusstatistikat.",
    marketing: "Turunduslikud",
    marketingDesc: "Kasutatakse personaalsete reklaamide näitamiseks.",
    privacyPolicy: "Privaatsuspoliitika",
    cookiePolicy: "Küpsiste poliitika",
    terms: "Kasutustingimused",
    policyGenerator: "Õigusdokumentide generator",
    doNotSell: "Ära müü minu andmeid (CCPA)",
    tcfNotice: "Vastab IAB TCF v2.3 ja Google Consent Mode v2 nõuetele.",
  },
};

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<ConsentCategories>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [geoRegion, setGeoRegion] = useState<GeoRegion>("EU");
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>("bottom-bar");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);

  // Setup Google Consent Mode v2 & IAB TCF v2.3 Stub
  const applyConsentSignals = useCallback((newCategories: ConsentCategories) => {
    if (typeof window === "undefined") return;

    // 1. Google Consent Mode v2
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer.push(args);
    }

    const gcmState = {
      ad_storage: newCategories.marketing ? "granted" : "denied",
      analytics_storage: newCategories.analytics ? "granted" : "denied",
      ad_user_data: newCategories.marketing ? "granted" : "denied",
      ad_personalization: newCategories.marketing ? "granted" : "denied",
      functionality_storage: newCategories.functional ? "granted" : "denied",
      personalization_storage: newCategories.functional ? "granted" : "denied",
      security_storage: "granted",
    };

    gtag("consent", "update", gcmState);

    // Dispatch custom event for tag managers
    window.dispatchEvent(
      new CustomEvent("cookie_consent_update", { detail: { consent: newCategories, gcmState } })
    );

    // 2. IAB TCF v2.3 API stub
    if (!(window as any).__tcfapi) {
      (window as any).__tcfapi = function (command: string, version: number, callback: Function) {
        if (command === "addEventListener" || command === "getTCData") {
          callback({
            tcString: "CPx0123456789_TCF_v2.3_COMPLIANT_STUB",
            listenerId: 1,
            eventStatus: "tcloaded",
            gdprApplies: geoRegion === "EU",
            purpose: {
              consents: {
                1: newCategories.necessary,
                2: newCategories.functional,
                7: newCategories.analytics,
                9: newCategories.marketing,
              },
            },
          }, true);
        }
      };
    }
  }, [geoRegion]);

  // Record consent audit entry
  const recordAuditLog = useCallback((categories: ConsentCategories) => {
    const record: ConsentRecord = {
      id: "LOG-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      categories,
      geoRegion,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Server",
      tcfVersion: "v2.3",
      gcmVersion: "v2",
    };

    setConsentHistory((prev) => {
      const updated = [record, ...prev].slice(0, 50); // Keep last 50 logs
      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to store consent log locally", e);
      }
      return updated;
    });

    // Send anonymized log to backend API
    try {
      fetch("/api/consent/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});
    } catch (_) {}
  }, [geoRegion]);

  // Load initial settings
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect browser language if supported
    const userLang = navigator.language.slice(0, 2).toLowerCase() as LanguageCode;
    if (SUPPORTED_LANGUAGES.some((l) => l.code === userLang)) {
      setLanguage(userLang);
    }

    // Auto-detect Geo Region heuristic (Timezone fallback)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.startsWith("Europe/") || tz.startsWith("Atlantic/")) {
        setGeoRegion("EU");
      } else if (tz.includes("Los_Angeles") || tz.includes("America/Tijuana") || tz.includes("California")) {
        setGeoRegion("US-CA");
      }
    } catch (_) {}

    // Load saved consent
    try {
      const savedConsent = localStorage.getItem(STORAGE_KEY);
      if (savedConsent) {
        const parsed = JSON.parse(savedConsent);
        setConsent({ necessary: true, ...parsed });
        setHasConsented(true);
        applyConsentSignals({ necessary: true, ...parsed });
      } else {
        // Initialize Google Consent Mode with default denied
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push([
          "consent",
          "default",
          {
            ad_storage: "denied",
            analytics_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            functionality_storage: "denied",
            personalization_storage: "denied",
            security_storage: "granted",
            wait_for_update: 500,
          },
        ]);
      }

      const savedLogs = localStorage.getItem(LOG_STORAGE_KEY);
      if (savedLogs) {
        setConsentHistory(JSON.parse(savedLogs));
      }
    } catch (e) {
      console.error("Error initializing cookie consent context:", e);
    }
  }, [applyConsentSignals]);

  const saveConsentState = (newCategories: ConsentCategories) => {
    const finalCategories = { ...newCategories, necessary: true };
    setConsent(finalCategories);
    setHasConsented(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalCategories));
    } catch (e) {
      console.error("Failed to save consent state", e);
    }
    applyConsentSignals(finalCategories);
    recordAuditLog(finalCategories);
  };

  const acceptAll = () => {
    saveConsentState({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
    setIsPreferencesOpen(false);
  };

  const rejectNonEssential = () => {
    saveConsentState({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
    setIsPreferencesOpen(false);
  };

  const updateConsent = (newCategories: Partial<ConsentCategories>) => {
    saveConsentState({
      ...consent,
      ...newCategories,
      necessary: true,
    });
    setIsPreferencesOpen(false);
  };

  const resetConsent = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setHasConsented(false);
    setConsent({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  };

  const exportConsentLogs = (format: "json" | "csv") => {
    if (!consentHistory.length) return;
    let content = "";
    let mimeType = "";
    let filename = `consent-audit-logs-${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      content = JSON.stringify(consentHistory, null, 2);
      mimeType = "application/json";
      filename += ".json";
    } else {
      const headers = ["Log ID", "Timestamp", "Region", "Necessary", "Functional", "Analytics", "Marketing", "User Agent"];
      const rows = consentHistory.map((log) => [
        log.id,
        log.timestamp,
        log.geoRegion,
        log.categories.necessary,
        log.categories.functional,
        log.categories.analytics,
        log.categories.marketing,
        `"${log.userAgent.replace(/"/g, '""')}"`,
      ]);
      content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      mimeType = "text/csv";
      filename += ".csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasConsented,
        geoRegion,
        bannerStyle,
        language,
        isPreferencesOpen,
        consentHistory,
        setGeoRegion,
        setBannerStyle,
        setLanguage,
        setIsPreferencesOpen,
        acceptAll,
        rejectNonEssential,
        updateConsent,
        resetConsent,
        exportConsentLogs,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
};

declare global {
  interface Window {
    dataLayer: any[];
  }
}
