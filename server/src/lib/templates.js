/**
 * A small curated set of starter decks. Each one is plain input for the ordinary create route,
 * so it goes through the same validation and id stamping as any deck. They contain no audience
 * data and no join codes.
 */
export const templates = [
  {
    key: 'retrospective',
    name: 'Team retrospective',
    description: 'What went well, what to change, and how the team feels.',
    slides: [
      { questionType: 'word-cloud', question: 'One word for how this sprint felt', options: [] },
      { questionType: 'open-ended', question: 'What went well?', options: [] },
      { questionType: 'open-ended', question: 'What should we change?', options: [] },
      { questionType: 'rating', question: 'How confident are we about the next sprint?', options: [] },
    ],
  },
  {
    key: 'workshop-feedback',
    name: 'Workshop feedback',
    description: 'Quick pulse on pace, usefulness and what to improve.',
    slides: [
      { questionType: 'multiple-choice', question: 'How was the pace?', options: ['Too slow', 'About right', 'Too fast'] },
      { questionType: 'rating', question: 'How useful was today for your work?', options: [] },
      { questionType: 'ranking', question: 'Rank what you want more of', options: ['Hands-on exercises', 'Examples', 'Discussion', 'Slides and theory'] },
      { questionType: 'open-ended', question: 'One thing we should improve', options: [] },
    ],
  },
  {
    key: 'training-quiz',
    name: 'Training quiz',
    description: 'A short quiz with a leaderboard. Replace the sample questions with your own.',
    // correctOptionId is set after ids exist, so the template marks the answer by position.
    slides: [
      { questionType: 'quiz', question: 'Sample: which of these is a primary colour?', options: ['Green', 'Red', 'Orange'], correctIndex: 1 },
      { questionType: 'quiz', question: 'Sample: how many minutes are in an hour?', options: ['30', '60', '100'], correctIndex: 1 },
      { questionType: 'quiz', question: 'Sample: which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury'], correctIndex: 2 },
    ],
  },
];

/** Public shape: what the client needs to show a choice. */
export const templateList = () => templates.map(({ key, name, description, slides }) => ({ key, name, description, slideCount: slides.length }));
