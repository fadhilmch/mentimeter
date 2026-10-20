export type SlideType = 'multiple-choice' | 'open-ended';

export interface Tally {
  total: number;
  counts: number[];
  percentages: number[];
}

export interface PublicSlide {
  questionType: SlideType;
  question: string;
  options?: string[];
  tally?: Tally;
  responses?: { text: string; upvotes: number; createdAt: string }[];
}

export interface PresentationState {
  id: string;
  title: string;
  accessCode: string;
  currentSlide: number;
  slides: PublicSlide[];
}

export type LiveAction =
  | { type: 'slide:change'; slideIndex: number }
  | { type: 'vote:cast'; slideIndex: number; optionIndex: number; participantId: string }
  | { type: 'response:add'; slideIndex: number; text: string; participantId: string }
  | { type: 'response:upvote'; slideIndex: number; responseIndex: number; participantId: string };

export interface LiveTransport {
  join(accessCode: string): Promise<PresentationState>;
  send(action: LiveAction): Promise<void>;
  onState(handler: (state: PresentationState) => void): void;
  leave(): void;
}
