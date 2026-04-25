export const locales = ["en", "es", "ru"] as const;
export const defaultLocale = "en" as const;

export type Locale = (typeof locales)[number];
