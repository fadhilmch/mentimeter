import jwt from 'jsonwebtoken';
import { verifyUserToken } from '../lib/tokens.js';
import { firebaseEnabled, verifyFirebaseToken } from '../lib/firebase.js';
import { User } from '../models/user.js';

export function bearerToken(req) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : '';
}

// The app's own session tokens are signed with HS256. Firebase ID tokens are not (RS256, or
// unsigned in the local emulator), so the header tells the two apart before anything is verified.
export function isLegacyToken(token) {
  return jwt.decode(token, { complete: true })?.header?.alg === 'HS256';
}

const invalid = (res) => res.status(401).json({ message: 'Invalid or expired token' });

// Verifies a Firebase ID token only. Used where the person has signed in but may not have an
// app profile yet (creating the profile, moving an old account, reading or deleting the account).
export function identifyFirebase({ checkRevoked = false } = {}) {
  return async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ message: 'Missing bearer token' });
    if (!firebaseEnabled() || isLegacyToken(token)) return invalid(res);
    try {
      req.firebase = await verifyFirebaseToken(token, { checkRevoked });
      return next();
    } catch {
      return invalid(res);
    }
  };
}

// Sets req.auth = { userId } for either kind of session, and confirms the account still exists,
// so a deleted account's token stops working at once instead of at expiry.
export async function authenticate(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ message: 'Missing bearer token' });
  try {
    if (isLegacyToken(token)) {
      try {
        req.auth = verifyUserToken(token);
      } catch {
        return invalid(res);
      }
      if (!(await User.exists({ _id: req.auth.userId }))) return invalid(res);
      return next();
    }
    if (!firebaseEnabled()) return invalid(res);
    let identity;
    try {
      identity = await verifyFirebaseToken(token);
    } catch {
      return invalid(res);
    }
    const user = await User.findOne({ firebaseUid: identity.uid }).select('_id');
    if (!user) {
      // Signed in with Firebase but no profile yet. 403, not 401, so the client does not sign out.
      return res.status(403).json({ message: 'Finish setting up your account', code: 'PROFILE_REQUIRED' });
    }
    req.auth = { userId: String(user._id), firebaseUid: identity.uid };
    return next();
  } catch (err) {
    return next(err);
  }
}
