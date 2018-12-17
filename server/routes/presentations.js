const express = require('express');
const router = express.Router();
const {vote, findAll, findByCode, findById, create, destroy, update} = require('../controllers/presentations.controllers')

router.get('/', findAll);
router.post('/', create);

router.get('/:id', findById);
router.put('/:id', update);
router.delete('/:id', destroy);

router.get('/search/:access_code', findByCode);
router.put('/vote/:id', vote);

module.exports = router;
