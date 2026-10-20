/**
 * Voice via the browser's speechSynthesis (CONTRACT STUB, the audio
 * engineer fills it in). Keep these public signatures.
 */

import type { Lang } from '@/demo/types'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Call synchronously inside the user's tap so iOS allows later speech. */
export function primeSpeech(): void {}

/**
 * Speak a line. Returns false if it could not be spoken (no voice for
 * the language, no speech support), so the caller can still caption it.
 */
export function speak(
  text: string,
  _lang: Lang,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): boolean {
  if (!speechSupported()) return false
  const u = new SpeechSynthesisUtterance(text)
  u.onstart = () => handlers.onStart?.()
  u.onend = () => handlers.onEnd?.()
  window.speechSynthesis.speak(u)
  return true
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return speechSupported() && window.speechSynthesis.speaking
}
