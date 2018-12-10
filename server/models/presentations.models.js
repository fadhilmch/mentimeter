const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Question = require('./questions.models');

const presentationSchema = new Schema({
  // id: String,
  title: String,
  slides: [{
    type: String,
    question: String,
    options: [{
      option: String,
      vote: Number
    }]
  }],
  access_code: String,
  location: String
}, {
  timestamps: true
})


// presentationSchema.pre('remove', function(next){
//   // Question.remove({presentation_id: this._id}).exec();
//   Question.find({
//     presentation_id: this._id
//   }).then(data => {
//     data.forEach((value) => {
//       value.remove()
//     })
//   })
//   // console.log('remove question '+this._id);
//   // console.log(this);
//   next()
// })

// // presentationSchema.post('remove', function(next){
// //   console.log('post remove question');
// //   next()
// // })

module.exports = mongoose.model('Presentation', presentationSchema);