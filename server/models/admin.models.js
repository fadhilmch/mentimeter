const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const adminSchema = new Schema({
  name: String,
  password: String,
  username: String,
  // password: String,
  // email: String
})

module.exports = mongoose.model('Admin', adminSchema);