const Presentation = require('../models/presentations.models');

module.exports = {
  findAll(req, res) {
    if(req.query.location == null) {
        Presentation.find()
        .sort('-createdAt')
        .exec()
        .then(data => {
            return res.status(200).json({
            message: 'get all presentation',
            data
            })
        })
        .catch(err => {
            return res.status(400).json({
            message: 'failed to get all presentation',
            err
            })
        })
    } else {
        Presentation.find({
            location: req.query.location
        })
        .then(data => {
            return res.status(200).json({
                message: "Succeed get presentation by location",
                data
            })
        })
        .catch(err => {
            return res.status(400).json({
                message: "Failed to get presentation by location",
                err
            })
        })
    }
  },

  findById(req, res) {
    Presentation.findOne({
      _id:req.params.id
    })
    .then(data => {
      return res.status(200).json({
          message: "Succeed get presentation by id",
          data
      })
    })
    .catch(err => {
        return res.status(400).json({
            message: "Failed to get presentation by Id"
        })
    })
  },

  create: (req, res) => {

    let number = '0123456789';
    let code = [];
    let all_access = [];

    Presentation.find()
    .then(data => {
        data.forEach(value => {
            all_access.push(value.access_code);
        });
        console.log('All access: ' + all_access);

        for(let i = 0; i < 6; i++){
            let index = Math.floor(Math.random() * 10);
            code[i] = (number[index]);
        }
    
        while(all_access.indexOf(code) != -1){
            for(let i = 0; i < 6; i++){
                let index = Math.floor(Math.random() * 11);
                code.push(number[index]);
            }
        }

        console.log("Code: " + code);
        Presentation.create({
            title: req.body.title,
            slides: [{
                type: '',
                question: '',
                options: []
            }],
            location: req.body.location,
            access_code: code.join("")
          }, (err, data) => {
            if (err) {
              return res.status(400).json({
                  message: "Failed to create presentation",
                  err
              })
            }
            return res.status(200).json({
                message: "Succeed to create presentation",
                data
            })
          })
        // return code.join("");
    })

    },
    update: (req, res) => {
        console.log(req.params.id);
        Presentation.findByIdAndUpdate(
                req.params.id,
                req.body, {
                    new: true
                }
            )
            .then((data) => {
                console.log(data)
                return res.status(200).json({
                    message: "Succeed to update presentation",
                    data
                })
            })
            .catch(err => {
                return res.status(400).json({
                    message: "failed to update presentation"
                })
            })
    },
    destroy: (req, res) => {
        // Presentation.findByIdAndRemove(
        //         req.params.id
        //     )
            // .then(data => {
            //     console.log("data: "+data);
            //     Question.find({
            //         presentation_id: req.params.id
            //     })
            //     .remove()
            Presentation.findOne({
                _id: req.params.id
            })
                .then(data => {
                    data.remove()
                    .then(() => {
                        return res.status(200).json({
                            message: "Succeed to delete presentation",
                            data

                    })
                    })
                })
                .catch(err => {
                    return res.status(400).json({
                        message: "Failed to delete presenation",
                        err
                    })
                })
            // })
            // .catch(err => {
            //     return res.status(400).json({
            //         message: "Failed to delete presentation",
            //         err
            //     })
            // })
    }


    }