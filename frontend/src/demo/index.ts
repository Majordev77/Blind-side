/**
 * The demo match and its commentary.
 *
 * The 2018 recreation uses real names for a historical fact. The
 * Microsoft hackathon build must use invented clubs only, so swap
 * these two imports for an invented match there.
 */

import type { Commentary, MatchClip } from './types'
import clipData from './bicycle-kick-2018.json'
import commentaryData from './commentary.json'

export const demoClip = clipData as MatchClip
export const demoCommentary = commentaryData as Commentary

export * from './types'
export * from './ball-path'
