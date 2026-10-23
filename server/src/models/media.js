import mongoose from 'mongoose';

/** An image uploaded for a slide. Stored in the same database as the decks, so it needs no extra service. */
const mediaSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const Media = mongoose.model('Media', mediaSchema);
