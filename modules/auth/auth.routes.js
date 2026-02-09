const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.get('/login', controller.loginForm);
router.post('/login', controller.login);
router.get('/logout', controller.logout);

module.exports = router;
