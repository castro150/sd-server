'use strict'

const express = require('express');
const router = express.Router();

const logger = require('config/logger.js');
const ContactsService = require('services/contacts.js');
const GoogleService = require('services/google.js');

router.get('/google/login', function(req, res, next) {
	let url = GoogleService.generateAuthUrl();

	res.json({
		consent_url: url
	});
});

router.get('/google/callback', function(req, res, next) {
	GoogleService.authenticateNewContactBox(req.query.code, function(err, newEmail, tokens) {
		ContactsService.registerContactBox(newEmail, tokens, function(err, newBox) {
			if (err) {
				return next(err);
			}

			res.status(201).json(newBox.email + ' registered.');
		});
	});
});

router.get('/entrypoint', function(req, res, next) {
	ContactsService.watchMainEmail();
	res.json('Job fired.');
});

module.exports = router;
