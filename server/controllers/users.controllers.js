const User = require('../models/users.models');
const Admin = require('../models/admin.models');
const bcrypt = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const saltRound = 10

function uniqueID(){
  function chr4(){
    return Math.random().toString(16).slice(-4);
  }
  return chr4() + chr4() +
    '-' + chr4() +
    '-' + chr4() +
    '-' + chr4() +
    '-' + chr4() + chr4() + chr4();
}

module.exports = {
  create: (req, res) => {
    User.create({
      id: uniqueID()
    })
    .then(data => {
      return res.status(200).json({
        message: "Succeed login user",
        data
      })
    })
    .catch(err => {
      return res.status(400).json({
        message: "Failed to login user",
        err
      })
    })
  },
  findAll: (req, res) => {
    User.find()
    .then(data => {
      return res.status(200).json({
        message: "Succeed to find user",
        data
      })
    })
    .catch(err => {
      return res.status(400).json({
        message: "Failed to find user",
        err
      })
    })
  },
  destroy: (req, res) => {
    User.findByIdAndRemove(
      req.params.id
    )
    .then(() => {
      return res.status(200).json({
        message: "Succeed delete user"
      })
    })
    .catch(() => {
      return res.status(400).json({
        message: "Failed to delete user"
      })
    })
  },
  login: (req, res) => {
    Admin
      .findOne({
          username : req.body.username,
      })
      .exec()
      .then(userData => {
        console.log(userData)
          if (userData) {
            let passwordCheck = bcrypt.compareSync(req.body.password, userData.password)
            if (passwordCheck) {
              let token = jwt.sign({id : userData._id},
              'secret')
              return res.status(200).json({
                message: 'Sign in success',
                data : {
                  id        : userData._id,
                  username  : userData.username,
                  token
                }
              })
            } else {
              return res.status(400).json({
                message: 'Failed to sign in, wrong password'
              })
            }
          } else {
            return res.status(400).json({
              message: 'Username / email not found'
            })
          }
      })
      .catch(err => {
        return res.status(400).json({
          message:"Cannot get user data",
          err
        })
      })
  },
  signUp: (req, res) => {
    Admin
      .findOne({
          username   :req.body.username
      })
      .then(userData => {
        if(userData) {
          return res.status(500).json({
            message   : 'Username / Email already exist'
          })
        } else {
          let userPassword = bcrypt.hashSync(req.body.password, saltRound);
          Admin.create({
            username  : req.body.username,
            password  : userPassword,
          })
            .then(data => {
              let token = jwt.sign({id : data._id}, 'secret');

              return res.status(201).json({
                message: 'Created new account succeed',
                id: data._id,
                username: data.username,
                token
              })
            })
            .catch(err => {
              return res.status(500).json({
                message: 'Failed to create new account',
                err
              })
            })
        }
      })
      .catch(err => {
        return res.status(500).json({
          message: 'Failed to get users data',
          err
        })
      })
  },
  findAllAdmin: (req, res) => {
    Admin.find()
    .then(data => {
      return res.status(200).json({
        message: "Succeed to find user",
        data
      })
    })
    .catch(err => {
      return res.status(400).json({
        message: "Failed to find user",
        err
      })
    })
  },
  destroyAdmin: (req, res) => {
    Admin.findByIdAndRemove(
      req.params.id
    )
    .then(() => {
      return res.status(200).json({
        message: "Succeed delete user"
      })
    })
    .catch(() => {
      return res.status(400).json({
        message: "Failed to delete user"
      })
    })
  },
  // findAll: (req, res) => {
  //     User.find()
  //         .exec()
  //         .then(data => {
  //             return res.status(200).json({
  //                 message: "Succeed get all users data",
  //                 data
  //             })
  //         })
  //         .catch(err => {
  //             return res.status(400).json({
  //                 message: "Failed get all users data",
  //             })
  //         })
  // },
  // findById: (req, res) => {
  //     User.findOne({
  //         _id: req.params.id
  //     })
  //     .exec()
  //     .then(data => {
  //         return res.status(200).json({
  //             message: "Succeed get user data by id",
  //             data
  //         })
  //     })
  //     .catch(err => {
  //         return res.status(400).json({
  //             message: "Failed to get user data by Id"
  //         })
  //     })
  // },
  // update: (req, res) => {
  //     User.findOneAndUpdate(
  //         req.params.id,
  //         req.body,
  //         {
  //             new: true
  //         }
  //     )
  //     .then((data) => {
  //         return res.status(200).json({
  //             message: "Succeed to update user data",
  //             data
  //         })
  //     })
  //     .catch(err => {
  //         return res.status(400).json({
  //             message: "failed to update data"
  //         })
  //     })
  // },
  // destroy: (req,res) => {
  //     User.findByIdAndRemove(
  //         req.params.id
  //     )
  //     .then(() => {
  //         return res.status(200).json({
  //             message: "Succeed to delete data"
  //         })
  //     })
  //     .catch(() => {
  //         return res.status(400).json({
  //             message: "Failed to delete data"
  //         })
  //     })
  // }
}