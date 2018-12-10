const Question = require('../models/questions.models');
const Presentation = require('../models/presentations.models');
const Answer = require('../models/answers.models');

module.exports = {
  findAll(req, res) {
    Question.find()
      .populate('answers')
      .sort('-createdAt')
      .exec()
      .then(data => {
        return res.status(200).json({
          message: 'get all questions',
          data
        })
      })
      .catch(err => {
        return res.status(400).json({
          message: 'failed to get all answer',
          err
        })
      })
  },

  findById(req, res) {
    Question.findOne({
      _id:req.params.id
    })
    .populate('answer')
    .exec()
    .then(data => {
      return res.status(200).json({
          message: "Succeed get question by id",
          data
      })
    })
    .catch(err => {
        return res.status(400).json({
            message: "Failed to get question by Id"
        })
    })
  },

  findByPresentationId(req,res) {
    Question.find({
      presentation_id:req.params.presentation_id
    })
    .populate('answer')
    .exec()
    .then(data => {
      return res.status(200).json({
          message: "Succeed get question by presentation id",
          data
      })
    })
    .catch(err => {
        return res.status(400).json({
            message: "Failed to get question by presentation Id"
        })
    }) 
  },

  create: (req, res) => {
    Question.create({
      question: req.body.question,
      presentation_id: req.params.presentation_id,
      answers: []
    }, (err, data) => {
      if (err) {
        return res.status(400).json({
            message: "Failed to create qeustion",
            err
        })
      }

      Presentation.findById(req.params.presentation_id)
      .exec()
      .then(presentation => {
        presentation.questions.push(data._id);
        presentation.save()
          .then(() => {
            return res.status(200).json({
              message: "Succeed to create question",
              data
            }) 
          })
          .catch(err => {
              return res.status(400).json({
                  message: "Failed to create question",
                  err
              })
          })
      })
    })
  },

  update: (req, res) => {
    console.log(req.params.id);
    Question.findByIdAndUpdate(
            req.params.id,
            req.body, {
                new: true
            }
        )
        .then((data) => {
            console.log(data)
            return res.status(200).json({
                message: "Succeed to update question",
                data
            })
        })
        .catch(err => {
            return res.status(400).json({
                message: "failed to update question"
            })
        })
},
destroy: (req, res) => {
  Question.findOne({
    _id:req.params.id
  })
  .then(data => {
    data.remove()
      .then(() => {
        console.log("data: "+data);
        Presentation.findById(data.presentation_id)
          .then((presentation) => {
            var index = presentation.questions.indexOf(req.params.id);
            presentation.questions.splice(index,1);
            presentation.save();
            console.log("Question: "+presentation.questions);
            
            return res.status(200).json({
              message: "Succeed to delete question",
              data
            })
          })
          .catch(err => {
            return res.status(400).json({
              message: "Failed to delete question",
              err
            })
          })
      })
      .catch(err => {
        return res.status(400).json({
          message: "Failed to delete question",
          err
        }) 
      })
    })
    .catch(err => {
        return res.status(400).json({
            message: "Failed to delete question",
            err
        })
    })
    // Question.findByIdAndRemove(
    //         req.params.id
    //     )
    //     .then(data => {
    //         console.log("data: "+data);
    //         Presentation.findById(data.presentation_id)
    //           .then((presentation) => {
    //             var index = presentation.questions.indexOf(req.params.id);
    //             presentation.questions.splice(index,1);
    //             presentation.save();
    //             console.log("Question: "+presentation.questions);
    //             Answer.find({
    //               question: req.params.id
    //             })
    //             .remove()
    //             .then(data => {
    //               return res.status(200).json({
    //                 message: "Succeed to delete question",
    //                 data
    //               })
    //             })
    //             .catch(err => {
    //               return res.status(400).json({
    //                 message: "Failed to delete question",
    //                 err
    //               })
    //             })
    //           })
    //           .catch(err => {
    //             return res.status(400).json({
    //               message: "Failed to delete question",
    //               err
    //             }) 
    //           })
    //     })
    //     .catch(err => {
    //         return res.status(400).json({
    //             message: "Failed to delete question",
    //             err
    //         })
    //     })
},


}