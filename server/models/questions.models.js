const mongoose = require('mongoose');
const Schema = mongoose.Schema;
let Answer = require('./answers.models');

const questionSchema = new Schema({
  presentation_id: String,
  question: String,
  answers: [{
    type: Schema.Types.ObjectId,
    ref: 'Answer'
  }]
}, {
  timestamps: true
})

questionSchema.pre('remove', function(next) {
  Answer.remove({question: this._id}).exec();
  next();
})

module.exports = mongoose.model('Question', questionSchema);