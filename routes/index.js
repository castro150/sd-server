'use strict'

const express = require('express');
const router = express.Router();

router.use('/health', require('routes/health.js'));
router.use(require('routes/security.js'));
router.use('/customer', require('routes/customer.js'));
router.use('/contacts', require('routes/contacts.js'));

module.exports = router;
