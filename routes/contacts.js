'use strict'

const express = require('express');
const router = express.Router();

const logger = require('config/logger.js');
const ContectBoxesService = require('services/contactBoxes.js');
const ContactsService = require('services/contacts.js');
const GoogleService = require('services/google.js');

ContactsService.watchMainEmail();

router.get('/google/login', function(req, res, next) {
	let url = GoogleService.generateAuthUrl();

	res.writeHead(302, {
		'Location': url
	});
	res.end();
});

router.get('/google/callback', function(req, res, next) {
	GoogleService.authenticate(req.query.code, function(err, email, tokens) {
		ContactsService.registerContactBox(email, tokens, function(err, newBox) {
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

router.get('/entrypoint/force', function(req, res, next) {
	ContactsService.updateContactsByMainEmail();
	res.json('Updating contacts.');
});

router.get('/entrypoint/stop', function(req, res, next) {
	ContactsService.stopMainEmailWatcher();
	res.json('Job stoped.');
});

router.put('/boxes/:id/contacts-ids', function(req, res, next) {
	ContectBoxesService.updateContactsIds(req.params.id)
		.then(() => res.json('Ids updated.'))
		.catch((err) => next(err));
});

// TODO: remover
router.get('/teste', function(req, res, next) {
	ContactsService.updateContactsByMainEmail2();
	res.json('Testado.');
});

module.exports = router;
