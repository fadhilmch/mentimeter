import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User } from '../models/user.js';
import { Presentation } from '../models/presentation.js';
import { authenticate } from '../middleware/authenticate.js';
import { signUserToken } from '../lib/tokens.js';
import { validate } from '../middleware/validate.js';

const credentialsSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_.-]+$/),
  password: z.string().min(8).max(128),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post('/signup', authLimiter, validate(credentialsSchema), async (req, res, next) => {
  try {
    const { name, username, password } = req.body;
    if (await User.exists({ username })) {
      return res.status(409).json({ message: 'Username is already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name ?? username, username, passwordHash });
    return res.status(201).json({ token: signUserToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/login', authLimiter, validate(credentialsSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    const matches = user && (await bcrypt.compare(password, user.passwordHash));
    if (!matches) {
      return res.status(401).json({ message: 'Wrong username or password' });
    }
    return res.json({ token: signUserToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    return next(err);
  }
});

const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

// Permanently deletes the signed-in account and every presentation it owns,
// including their votes, answers and audience nicknames. The password is
// required again so a stolen session token alone cannot erase an account.
authRouter.delete('/me', authLimiter, authenticate, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(403).json({ message: 'Wrong password' });
    }
    const { deletedCount } = await Presentation.deleteMany({ owner: user._id });
    await User.deleteOne({ _id: user._id });
    return res.json({ ok: true, deletedPresentations: deletedCount });
  } catch (err) {
    return next(err);
  }
});
