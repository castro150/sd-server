'use strict'

var express = require('express');
var router = express.Router();
var passport = require('passport');
var jwt = require('express-jwt');

var properties = require('properties-reader')('./config/application.properties');
var msg = require('properties-reader')('./config/messages.properties');
var logger = require('config/logger.js');
var SecurityService = require('services/security.js');

// userProperty defines what propertie will receive the token on 'req'
var auth = jwt({
	secret: properties.get('jwt.secret'),
	userProperty: 'payload'
});

var fillAllFields = msg.get('security.login.fill.all.fields');

router.post('/register', function(req, res, next) {
	if (!req.body.username || !req.body.password) {
		return next(createError(fillAllFields, 'Register: not all fields filled', 400));
	}

	SecurityService.register(req.body.username, req.body.password, function(err, user) {
		if (err) {
			return next(err);
		}

		return res.json({
			token: user.generateJWT()
		});
	});
});

router.post('/login', function(req, res, next) {
	if (!req.body.username || !req.body.password) {
		return next(createError(fillAllFields, 'Login: not all fields filled', 400));
	}

	passport.authenticate('local', function(err, user, info) {
		if (err) {
			return next(err);
		}

		if (user) {
			logger.debug(user.username + ' loged in.');
			return res.json({
				token: user.generateJWT()
			});
		} else {
			logger.warn('Failed to login ' + req.body.username + ': ' + info.message);
			return res.status(401).json(info);
		}
	})(req, res, next);
});

router.post('/token', auth, function(req, res, next) {
	SecurityService.renewToken(req.body.token, function(err, newToken) {
		if (err) {
			return next(err);
		}

		return res.json({
			token: newToken
		});
	});
});

var createError = function(name, msg, status) {
	var err = new Error(msg);
	err.name = name;
	err.status = status;
	return err;
};

module.exports = router;
