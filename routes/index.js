'use strict'

var express = require('express');
var router = express.Router();

router.use('/health', require('routes/health.js'));
router.use(require('routes/security.js'));
router.use('/customer', require('routes/customer.js'));

module.exports = router;
