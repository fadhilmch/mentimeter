import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9_.-]+$/ },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id, name: this.name, username: this.username };
};

export const User = mongoose.model('User', userSchema);
