const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  id: String
  // name: String,
  // username: String,
  // password: String,
  // email: String
})

module.exports = mongoose.model('User', userSchema);