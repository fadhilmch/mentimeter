const express = require('express');
const router = express.Router();
const {upvote, resetvote, findAll, findById, create, destroy, update, findAnswerByQuestion} = require('../controllers/answers.controllers')

router.get('/', findAll);

router.post('/upvote', upvote);
router.post('/reset', resetvote);

router.get('/:question_id', findAnswerByQuestion);
router.post('/:question_id', create);

router.get('/:id', findById);
router.put('/:id', update);
router.delete('/:id', destroy);



module.exports = router;