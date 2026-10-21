import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Accounts made before Firebase sign-in have a username and password hash and no email.
    // Accounts made with Firebase have an email and firebaseUid and no password hash. The username
    // index is left exactly as it was (unique, required), so a Firebase account gets a generated
    // placeholder username that is never shown or accepted for login (see syntheticUsername).
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9_.-]+$/ },
    passwordHash: { type: String },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 254 },
    firebaseUid: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id, name: this.name, username: this.firebaseUid ? null : this.username, email: this.email ?? null };
};

userSchema.pre('validate', function requireSomeLogin() {
  if (!this.firebaseUid && !this.passwordHash) {
    this.invalidate('passwordHash', 'An account needs either a Firebase identity or a password');
  }
});

/** Placeholder for the required, unique username of a Firebase account. Derived from the uid, so it is unique and stable. */
export function syntheticUsername(uid) {
  return `fb-${createHash('sha256').update(uid).digest('hex').slice(0, 24)}`;
}

export const User = mongoose.model('User', userSchema);
