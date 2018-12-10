var express = require('express');
var router = express.Router();
// var {signIn, signUp, findAll, destroy} = require('../controllers/users.controllers')
var {create, findAll, signUp, login, findAllAdmin, destroyAdmin, destroy} = require('../controllers/users.controllers');
// router.get('/', findAll);
// router.post('/signin', signIn);
// router.post('/signup', signUp);

router.delete('/:id', destroy);

router.get('/', findAll);
router.post('/', create);
router.post('/signUp', signUp);
router.post('/login', login);
router.get('/admin', findAllAdmin);
router.delete('/admin/:id', destroyAdmin);



module.exports = router;
