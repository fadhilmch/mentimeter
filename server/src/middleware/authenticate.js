import { verifyUserToken } from '../lib/tokens.js';
import { User } from '../models/user.js';

// Verifies the bearer token and that its account still exists, so a deleted
// account's token stops working immediately instead of at expiry.
export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }
  try {
    req.auth = verifyUserToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    if (!(await User.exists({ _id: req.auth.userId }))) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
