/**
 * The words that differ between the two quizzes. Everything else — the clock,
 * the draw, the scoring, the scorecard — is the same quiz.
 */
export interface QuizCopy {
  /** The choices, spelled out under the title: "Go, kick or punt." */
  options: string
  /** Singular and plural: "4th down", "4th downs". */
  noun: [string, string]
  /** After "A coin flip call, 0.4 points": "between going and the best kick". */
  edge: string
  /** On the aggressiveness tile: "went on 3 of 4 the model wanted". */
  verb: string
  /** In the closing paragraph: "gone for it" / "gone for two". */
  verbPerfect: string
  /** The clause after "less often than the median NFL staff has since 2014". */
  lessOftenNote: string
  /** How many of these decisions an NFL team faces in a season, roughly. */
  seasonSize: number
  /** Below this many calls the scorecard says the sample is still small. */
  smallSample: number
}

export const FOURTH_DOWN_QUIZ: QuizCopy = {
  options: 'Go, kick or punt.',
  noun: ['4th down', '4th downs'],
  edge: 'between going and the best kick',
  verb: 'went',
  verbPerfect: 'gone for it',
  lessOftenNote: 'the usual result, and the reason the league has spent a decade moving',
  seasonSize: 130,
  smallSample: 30,
}

export const TWO_POINT_QUIZ: QuizCopy = {
  options: 'Kick the extra point, or go for two.',
  noun: ['try', 'tries'],
  edge: 'between going for two and the kick',
  verb: 'went for two',
  verbPerfect: 'gone for two',
  lessOftenNote: 'the usual result, since the kick is what a staff takes unless something says otherwise',
  seasonSize: 45,
  smallSample: 12,
}
