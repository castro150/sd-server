'use strict'

var express = require('express');
var router = express.Router();
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');

// userProperty defines what propertie will receive the token on 'req'
var auth = jwt({ secret: properties.get('jwt.secret'), userProperty: 'payload' });

router.get('/', function(req, res, next) {
  res.json('Simple-Docfy Server alive!');
});

router.get('/safe', auth, function(req, res, next) {
  res.json('Simple-Docfy Server alive and safe.');
});

module.exports = router;
