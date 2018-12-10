const express = require('express');
const router = express.Router();
const {findAll, findById, create, destroy, update, findByPresentationId} = require('../controllers/questions.controllers')

router.get('/', findAll);
router.post('/:presentation_id', create);

router.get('/:id', findById);
router.put('/:id', update);
router.delete('/:id', destroy);

router.get('/presentation/:presentation_id', findByPresentationId);


module.exports = router;
