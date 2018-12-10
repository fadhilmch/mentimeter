const Answer = require('../models/answers.models');
const Question = require('../models/questions.models');

module.exports = {
    findAnswerByQuestion(req, res) {
        Answer.find({
                question: req.params.question_id
            })
            .populate('question')
            .populate('upvote')
            .exec()
            .then(data => {
                return res.status(200).json({
                    message: 'get all answer data by question',
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: 'failed to get answer data by question',
                    err
                })
            })
    },
    findAll(req, res) {
        Answer.find()
            .populate('question')
            .populate('upvote')
            .exec()
            .then(data => {
                return res.status(200).json({
                    message: "get all answer data",
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: 'failed to get all answers data',
                    err
                })
            })
    },
    findById: (req, res) => {
        Answer.findOne({
                _id: req.params.id
                // userId : req.params.user_id
            })
            .populate('question')
            .populate('upvote')
            .exec()
            .then(data => {
                return res.status(200).json({
                    message: "Succeed get answer data by id",
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: "Failed to get answer data by Id"
                })
            })
    },
    create: (req, res) => {
        Answer.create({
            answer: req.body.answer,
            upvote: [],
            question: req.params.question_id
        }, (err, data) => {
            if (err) {
                return res.status(400).json({
                    message: "Failed to create answer",
                    err
                })
            }

            Question.findById(req.params.question_id)
                .exec()
                .then(question => {
                    question.answers.push(data._id);
                    question.save()
                        .then(data => {
                          return res.status(200).json({
                            message: "Succeed to create answer",
                            data
                        }) 
                        })
                        .catch(err => {
                            return res.status(400).json({
                                message: "Failed to create answer",
                                err
                            })
                        })
                })

        })

    },
    update: (req, res) => {
        console.log(req.params.id);
        Answer.findByIdAndUpdate(
                req.params.id,
                req.body, {
                    new: true
                }
            )
            .then((data) => {
                console.log(data)
                return res.status(200).json({
                    message: "Succeed to update answer data",
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: "failed to update data"
                })
            })
    },
    destroy: (req, res) => {
        Answer.findByIdAndRemove(
                req.params.id
            )
            .then(data => {
                console.log("data: "+data);
                Question.findById(data.question)
                    .then(question => {
                        var index = question.answers.indexOf(req.params.id);
                        console.log(index);
                        question.answers.splice(index,1);
                        question.save();
                        console.log("Answer:"+question.answers);
                        return res.status(200).json({
                            message: "Succeed to delete answer",
                            data
                        })
                    })
                    .catch(err => {
                        return res.status(400).json({
                            message: "Failed to delete answer",
                            err
                        })
                    })
            })
            .catch(err => {
                return res.status(400).json({
                    message: "Failed to delete answer",
                    err
                })
            })
    },
    upvote: (req, res) => {
        let userId = req.body.userId;
        let answerId = req.body.answerId;
        // let questionId = req.body.questionId;

        Answer.findById({
            _id: answerId
        })
            .then(data => {
                let indexUserUpvote = data.upvote.indexOf(userId);
                console.log(`index upvote ${indexUserUpvote}`)
                if(indexUserUpvote == -1) {
                    data.upvote.push(userId);
                    data.save();
                }
                return res.status(200).json({
                    message: "Succeed upvote",
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: "Failed upvote",
                    err
                })
            })

        // Answer.findById({
        //     _id: answerId
        // })
        //     .then(data => {
        //         let indexUserUpvote = data.upvote.indexOf(userId);
        //         console.log(`index upvote ${indexUserUpvote}`)
        //         if(indexUserUpvote == -1) {
        //             data.upvote.push(userId);
        //             data.save();
        //         }

  

                
        //         // let indexUserDownvote = data.downvote.indexOf(userId);
        //         // console.log(`index downvote ${indexUserDownvote}`)
        //         if ((indexUserUpvote == -1) && (indexUserDownvote == -1)) {
        //             data.upvote.push(userId);
        //             data.save()
        //                 .then(answer => {
        //                     return res.status(200).json({
        //                         message: 'succeed to upvote answer',
        //                         data: answer
        //                     })
        //                 })
        //                 .catch(err => {
        //                     return res.status(400).json({
        //                         message: 'failed to upvote answer',
        //                         err
        //                     })
        //                 })
        //         } else if ((indexUserUpvote == -1) && (indexUserDownvote != -1)) {
        //             data.downvote.splice(indexUserDownvote, 1);
        //             data.upvote.push(userId);
        //             data.save()
        //                 .then(answer => {
        //                     return res.status(200).json({
        //                         message: 'succeed to upvote answer',
        //                         data: answer
        //                     })
        //                 })
        //                 .catch(err => {
        //                     return res.status(400).json({
        //                         message: 'failed to upvote answer',
        //                         err
        //                     })
        //                 })
        //         } else {
        //             return res.status(200).json({
        //                 message: 'user already upvoted'
        //             })
        //         }
        //     })
        //     .catch(err => {
        //         return res.status(400).json({
        //             message: 'cannor find answer',
        //             err
        //         })
        //     })
    },
    resetvote: (req, res) => {
        let answerId = req.body.answerId;
        Answer.findByIdAndUpdate(
                answerId, {
                    upvote: []
                }, {
                    new: true
                }
            )
            .then(answer => {
                return res.status(200).json({
                    message: 'succeed to reset vote answer',
                    data: answer
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: 'failed to reset vote answer',
                    err
                })
            })
    },
}