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

const slideSchema = new mongoose.Schema(
  {
    // Stable identity stamped on save; lets edits keep votes/responses attached to the right slide.
    id: { type: String },
    questionType: { type: String, enum: ['multiple-choice', 'open-ended'], required: true },
    question: { type: String, required: true, trim: true, maxlength: 300 },
    options: { type: [optionSchema], default: [] },
    responses: { type: [responseSchema], default: [] },
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
