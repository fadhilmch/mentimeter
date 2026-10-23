import express, { Router } from 'express';
import mongoose from 'mongoose';
import { Media } from '../models/media.js';
import { authenticate } from '../middleware/authenticate.js';
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_USER, sniffImageType } from '../lib/media.js';

export const mediaRouter = Router();

/** Owner uploads one image (raw bytes: jpeg, png or webp, up to 600 KB). Returns the path to use as a slide image. */
mediaRouter.post(
  '/',
  authenticate,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(415).json({ message: 'Send a JPEG, PNG or WebP image.' });
      }
      const contentType = sniffImageType(req.body);
      if (!contentType) return res.status(415).json({ message: 'That file is not a JPEG, PNG or WebP image.' });
      const owner = new mongoose.Types.ObjectId(req.auth.userId);
      if ((await Media.countDocuments({ owner })) >= MAX_IMAGES_PER_USER) {
        return res.status(429).json({ message: `You can keep up to ${MAX_IMAGES_PER_USER} uploaded images.` });
      }
      const media = await Media.create({ owner, contentType, data: req.body });
      return res.status(201).json({ data: { url: `/api/media/${media._id}`, bytes: req.body.length } });
    } catch (err) {
      if (err.type === 'entity.too.large') return res.status(413).json({ message: 'That image is too large (600 KB maximum).' });
      return next(err);
    }
  },
);

/** Public: the audience's phones load slide images without an account. The id is unguessable. */
mediaRouter.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Image not found' });
    const media = await Media.findById(req.params.id).lean();
    if (!media) return res.status(404).json({ message: 'Image not found' });
    res.set({
      'Content-Type': media.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });
    return res.send(Buffer.from(media.data.buffer ?? media.data));
  } catch (err) {
    return next(err);
  }
});
