import mongoose from 'mongoose';
import { slideSchema, participantSchema } from './presentation.js';

/**
 * PREVIEW. A run of a deck: its own code, its own answers, its own state.
 * Not used by any live route yet. See docs/live-sessions.md for the plan and the migration.
 *
 * `slides` is an immutable snapshot taken at start, in the same shape as Presentation.slides, so
 * answers (votes, responses with ids, ratings, rankings, reveal locks) live with the run they
 * belong to and editing the deck cannot change a running or finished session.
 */
const liveSessionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    presentation: { type: mongoose.Schema.Types.ObjectId, ref: 'Presentation', required: true, index: true },
    // The deck's structureRevision when the run started.
    deckRevision: { type: Number, default: 0 },
    title: { type: String, required: true },
    theme: { type: String },
    slides: { type: [slideSchema], default: [] },
    participants: { type: [participantSchema], default: [] },
    code: { type: String, required: true },
    status: { type: String, enum: ['active', 'ended', 'archived'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    currentSlide: { type: Number, default: 0 },
    votingOpen: { type: Boolean, default: true },
    resultsVisible: { type: Boolean, default: true },
    moderationMode: { type: String, default: 'off' },
    liveRevision: { type: Number, default: 0 },
    // Set only on a session created from pre-session data. One per deck, which makes migration idempotent.
    legacyOf: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true },
);

// Lets the shared live logic treat a session like a deck (publicState reads accessCode).
liveSessionSchema.virtual('accessCode').get(function accessCode() {
  return this.code;
});

liveSessionSchema.pre('save', function bumpLiveRevision() {
  if (!this.isNew && this.isModified()) this.$inc('liveRevision', 1);
});

// A code belongs to one running session at a time. Ended sessions release it.
liveSessionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
liveSessionSchema.index({ legacyOf: 1 }, { unique: true, partialFilterExpression: { legacyOf: { $type: 'objectId' } } });

export const LiveSession = mongoose.model('LiveSession', liveSessionSchema);
