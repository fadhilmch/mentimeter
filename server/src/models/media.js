import crypto from 'node:crypto';
import mongoose from 'mongoose';

/** The public id in the image link: 128 random bits, not the database id (which is partly guessable). */
export const newPublicId = () => crypto.randomBytes(16).toString('hex');

/** An image uploaded for a slide. Stored in the same database as the decks, so it needs no extra service. */
const mediaSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, default: newPublicId },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const Media = mongoose.model('Media', mediaSchema);
