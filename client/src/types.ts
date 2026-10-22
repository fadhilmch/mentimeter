export type SlideType = 'multiple-choice' | 'open-ended' | 'word-cloud' | 'rating' | 'ranking' | 'quiz';

export interface SlideDesign {
  accent?: string;
  imageUrl?: string;
  imageLayout?: 'beside' | 'behind';
}

export interface Tally {
  total: number;
  // multiple-choice + quiz
  counts?: number[];
  percentages?: number[];
  // quiz
  correctOptionIndex?: number;
  correctCount?: number;
  // word-cloud
  words?: { text: string; count: number }[];
  // rating
  average?: number;
  buckets?: number[];
  // ranking
  points?: number[];
}

export interface RankingOption {
  id: string;
  text: string;
}

export interface PublicSlide {
  questionType: SlideType;
  question: string;
  options?: string[] | RankingOption[];
  design?: SlideDesign;
  tally?: Tally | null;
  responses?: { text: string; upvotes: number; createdAt: string }[];
}

export interface LeaderboardEntry {
  /** Opaque per-room player label; unlike `name` it is unique. */
  key: string;
  name: string;
  score: number;
  rank: number;
}

export interface PresentationState {
  id: string;
  title: string;
  accessCode: string;
  /** Increases with every change to the live state; older snapshots are ignored. */
  revision?: number;
  theme?: 'iris' | 'apricot' | 'plum' | 'cobalt';
  currentSlide: number;
  votingOpen: boolean;
  resultsVisible: boolean;
  slides: PublicSlide[];
  // Quiz scores: only sent after voting closes and results are visible.
  leaderboard?: LeaderboardEntry[] | null;
}

export type LiveAction =
  | { type: 'vote:cast'; slideIndex: number; optionIndex: number; participantId: string }
  | { type: 'response:add'; slideIndex: number; text: string; participantId: string; clientId?: string }
  | { type: 'response:upvote'; slideIndex: number; responseIndex: number; participantId: string; on?: boolean }
  | { type: 'word:submit'; slideIndex: number; text: string; participantId: string }
  | { type: 'rating:cast'; slideIndex: number; value: number; participantId: string }
  | { type: 'ranking:submit'; slideIndex: number; order: string[]; participantId: string }
  | { type: 'participant:identify'; participantId: string; nickname: string };

export interface LiveTransport {
  join(accessCode: string): Promise<PresentationState>;
  send(action: LiveAction): Promise<void>;
  onState(handler: (state: PresentationState) => void): void;
  /** Optional: called after a dropped connection is re-established and the room is rejoined. */
  onReconnect?(handler: () => void): void;
  leave(): void;
}
