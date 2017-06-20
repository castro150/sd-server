'use strict'

const mongoose = require('mongoose');
const properties = require('properties-reader')('./config/application.properties');

const logger = require('config/logger.js');
const Contact = mongoose.model('Contact');
const ContactBox = mongoose.model('ContactBox');
const GoogleService = require('services/google.js');

const MAIN_EMAIL = properties.get('google.contacts.main.email');

exports.registerContactBox = function(email, googleTokens, callback) {
	let newBox = new ContactBox({
		email: email,
		tokens: googleTokens
	});

	newBox.save(function(err) {
		if (err) {
			return callback(err);
		}

		logger.debug('New contact box registered for email: ' + newBox.email);
		return callback(null, newBox);
	});
};

exports.watchMainEmail = function() {
	if (!MAIN_EMAIL) {
		logger.debug('Missing google.contacts.main.email property.');
		return;
	}

	ContactBox.findOne({
		email: MAIN_EMAIL
	}).exec(function(err, mainBox) {
		if (err) {
			logger.debug('Error to get main email box.');
			logger.debug(err);
			return;
		}
		if (!mainBox) {
			logger.debug(MAIN_EMAIL + ' (main email) not registered.');
			return;
		}

		GoogleService.getContacts(mainBox, function(err, contacts) {
			if (err) {
				logger.debug('Error to get contacts from google.');
				logger.debug(err);
				return;
			}

			Contact.find().exec(function(err, savedContacts) {
				if (err) {
					logger.debug('Error to get contacts from database.');
					logger.debug(err);
					return;
				}

				var diff = contacts.filter(function(elem1) {
					return savedContacts.filter(function(elem2) {
						return elem2.id === elem1.id;
					}).length === 0
				});

				Contact.collection.insert(diff, function(err, newContacts) {
					if (err) {
						logger.debug('Error to update contacts from database.');
						logger.debug(err);
						return;
					}

					logger.debug(newContacts.ops.length + ' new contacts added.');
				});

				// TODO atualizar todas as boxes
			});
		});
	});
};
