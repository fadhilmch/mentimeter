import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    // Stable identity stamped on save; lets edits keep votes attached to the right option.
    id: { type: String },
    text: { type: String, required: true, trim: true, maxlength: 200 },
    votes: { type: [String], default: [] },
  },
  { _id: false },
);

const responseSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 280 },
    authorId: { type: String, required: true },
    upvotes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ratingSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 10 },
  },
  { _id: false },
);

const rankingSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    // Option ids in the participant's chosen order, best first.
    order: { type: [String], default: [] },
  },
  { _id: false },
);

const designSchema = new mongoose.Schema(
  {
    // Optional per-slide accent; inherits the presentation theme when unset.
    accent: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    imageLayout: { type: String, enum: ['beside', 'behind'] },
  },
  { _id: false },
);

const slideSchema = new mongoose.Schema(
  {
    // Stable identity stamped on save; lets edits keep votes/responses attached to the right slide.
    id: { type: String },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'open-ended', 'word-cloud', 'rating', 'ranking', 'quiz'],
      required: true,
    },
    question: { type: String, required: true, trim: true, maxlength: 300 },
    options: { type: [optionSchema], default: [] },
    responses: { type: [responseSchema], default: [] },
    ratings: { type: [ratingSchema], default: [] },
    rankings: { type: [rankingSchema], default: [] },
    // Quiz slides mark the correct option by its stable option id.
    correctOptionId: { type: String },
    design: { type: designSchema, default: undefined },
  },
  { _id: false },
);

const presentationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessCode: { type: String, required: true, unique: true, index: true },
    location: { type: String, trim: true, maxlength: 120 },
    theme: { type: String, enum: ['iris', 'apricot', 'plum', 'cobalt'], default: 'iris' },
    slides: { type: [slideSchema], default: [] },
    // Leaderboard names: optional nickname per stable anonymous participant id.
    participants: {
      type: [
        new mongoose.Schema(
          {
            participantId: { type: String, required: true },
            nickname: { type: String, trim: true, maxlength: 24 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    currentSlide: { type: Number, default: 0, min: 0 },
    votingOpen: { type: Boolean, default: true },
    resultsVisible: { type: Boolean, default: true },
    // Bumped only when the slide/option structure changes. Votes and live
    // actions do not touch it, so the editor can detect concurrent structural
    // edits without conflicting with live audience activity.
    structureRevision: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Presentation = mongoose.model('Presentation', presentationSchema);
