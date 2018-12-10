const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const answerSchema = new Schema({
  answer: String,
  question: {
    type: Schema.Types.ObjectId,
    ref: 'Question'
  },
  upvote: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
})

module.exports = mongoose.model('Answer', answerSchema);