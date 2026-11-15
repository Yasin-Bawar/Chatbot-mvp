export interface QuizQuestion {
  q: string;
  options: string[];
  /** Zero-based index of the correct option. */
  answer: number;
  explain?: string;
}

export interface Quiz {
  title?: string;
  questions: QuizQuestion[];
}

export interface QuizMistake {
  q: string;
  mine: string;
  right: string;
}

/** Summary of one exam attempt (stored on the student's result message). */
export interface QuizResult {
  title: string;
  correct: number;
  total: number;
  seconds: number;
  bestStreak: number;
  mistakes: QuizMistake[];
}
