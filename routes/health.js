'use strict'

const express = require('express');
const router = express.Router();
const jwt = require('express-jwt');

let properties = require('properties-reader')('./config/application.properties');

// userProperty defines what propertie will receive the token on 'req'
let auth = jwt({
	secret: properties.get('jwt.secret'),
	userProperty: 'payload'
});

router.get('/', function(req, res, next) {
	res.json('Simple-Docfy Server alive!');
});

router.get('/safe', auth, function(req, res, next) {
	res.json('Simple-Docfy Server alive and safe.');
});

module.exports = router;
