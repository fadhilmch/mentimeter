import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Accounts made before Firebase sign-in have a username and password hash and no email.
    // Accounts made with Firebase have an email and firebaseUid and no username or hash.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9_.-]+$/ },
    passwordHash: { type: String },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 254 },
    firebaseUid: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id, name: this.name, username: this.username ?? null, email: this.email ?? null };
};

userSchema.pre('validate', function requireSomeLogin() {
  if (!this.firebaseUid && !(this.username && this.passwordHash)) {
    this.invalidate('username', 'An account needs either a Firebase identity or a username and password');
  }
});

export const User = mongoose.model('User', userSchema);
