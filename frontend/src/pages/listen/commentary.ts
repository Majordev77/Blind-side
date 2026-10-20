import type { CommentaryLine, Detail, Lang } from '@/demo/types'

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  pcm: 'Nigerian Pidgin',
  yo: 'Yoruba',
}

export const DETAIL_LABELS: Record<Detail, string> = {
  essentials: 'Essentials',
  full: 'Full',
  analyst: 'Analyst',
}

export const FAVOURITES = ['Cristiano Ronaldo', 'Dani Carvajal'] as const

export interface Settings {
  lang: Lang
  detail: Detail
  favourite: string // '' = none
}

export interface LineSelection {
  lines: CommentaryLine[]
  /** Set when the chosen language/detail had no lines and we fell back. */
  fallbackNote: string | null
}

function pick(all: CommentaryLine[], lang: Lang, detail: Detail, favourite: string): CommentaryLine[] {
  const base = all.filter((l) => !l.favourite && l.lang === lang && l.detail === detail)
  let fav: CommentaryLine[] = []
  if (favourite) {
    const sameLang = all.filter((l) => l.favourite === favourite && l.lang === lang)
    const sameDetail = sameLang.filter((l) => l.detail === detail)
    fav = sameDetail.length > 0 ? sameDetail : sameLang
  }
  return [...base, ...fav].sort((a, b) => a.t - b.t)
}

/**
 * The lines to air for these settings. Falls back to English essentials
 * when the chosen language and detail have no lines yet.
 */
export function selectLines(all: CommentaryLine[], s: Settings): LineSelection {
  const chosen = pick(all, s.lang, s.detail, s.favourite)
  if (chosen.some((l) => !l.favourite)) return { lines: chosen, fallbackNote: null }
  const fallback = pick(all, 'en', 'essentials', s.favourite)
  if (s.lang === 'en' && s.detail === 'essentials') return { lines: fallback, fallbackNote: null }
  return {
    lines: fallback,
    fallbackNote: `No ${LANG_LABELS[s.lang]} ${DETAIL_LABELS[s.detail]} commentary yet. Playing English Essentials instead.`,
  }
}
