import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signUserToken(userId, secret = config.jwtSecret, expiresIn = config.jwtExpiresIn) {
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn });
}

export function verifyUserToken(token, secret = config.jwtSecret) {
  const payload = jwt.verify(token, secret);
  return { userId: payload.sub };
}
