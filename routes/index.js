var express = require('express');
var router = express.Router();

router.use('/health', require('routes/health.js'));
router.use(require('routes/security.js'));

module.exports = router;
