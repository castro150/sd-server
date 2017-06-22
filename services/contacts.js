'use strict'

const mongoose = require('mongoose');
const properties = require('properties-reader')('./config/application.properties');

const logger = require('config/logger.js');
const Contact = mongoose.model('Contact');
const ContactBox = mongoose.model('ContactBox');
const GoogleService = require('services/google.js');

const MAIN_EMAIL = properties.get('google.contacts.main.email');
const WAIT_TIME = parseInt(properties.get('google.contacts.watch.wait.time'));

let mainEmailWatcher = null;

let registerContactBox = function(email, googleTokens, callback) {
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

let watchMainEmail = function() {
	if (!mainEmailWatcher) {
		logger.debug('Watching main email every ' + WAIT_TIME + 'ms.');
		mainEmailWatcher = setInterval(updateContactsByMainEmail, WAIT_TIME);
	} else {
		logger.debug('Main email already watched.');
	}
};

let stopMainEmailWatcher = function() {
	if (mainEmailWatcher) {
		clearTimeout(mainEmailWatcher);
		mainEmailWatcher = null;
		logger.debug('Main email watcher stoped.');
	} else {
		logger.debug('No job running.');
	}
}

let updateContactsByMainEmail = function() {
	if (!MAIN_EMAIL) {
		logger.debug('Missing google.contacts.main.email property.');
		return;
	}

	logger.debug('Getting main email box.');
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

		logger.debug('Getting main email contacts.');
		GoogleService.getContacts(mainBox, function(err, contacts) {
			if (err) {
				logger.debug('Error to get contacts from google.');
				logger.debug(err);
				return;
			}

			logger.debug('Getting database contacts.');
			Contact.find().exec(function(err, savedContacts) {
				if (err) {
					logger.debug('Error to get contacts from database.');
					logger.debug(err);
					return;
				}

				logger.debug(savedContacts.length + ' contacts found in database.');
				var diff = contacts.filter(function(elem1) {
					return savedContacts.filter(function(elem2) {
						return elem2.id === elem1.id;
					}).length === 0;
				});

				if (diff.length > 0) {
					logger.debug('There are new contacts in the main email.');
					logger.debug('Adding new contacts in database.');
					Contact.collection.insert(diff, function(err, newContacts) {
						if (err) {
							logger.debug('Error to update contacts from database.');
							logger.debug(err);
							return;
						}

						logger.debug(newContacts.ops.length + ' new contacts added to database.');
					});

					logger.debug('Adding new contacts in each registered contact box.');
					ContactBox.find().exec(function(err, contactBoxes) {
						contactBoxes.forEach(function(contactBox) {
							if (contactBox.email !== MAIN_EMAIL) {
								logger.debug('Adding new contacts in ' + contactBox.email);
								GoogleService.addContacts(contactBox, diff, function(err) {
									if (err) {
										logger.debug('Error to add contacts in ' + contactBox.email);
										logger.debug(err);
										return;
									}
								});
							}
						});
					});
				} else {
					logger.debug('No new contacts in the main email.');
				}
			});
		});
	});
};

exports.registerContactBox = registerContactBox;
exports.watchMainEmail = watchMainEmail;
exports.updateContactsByMainEmail = updateContactsByMainEmail;
exports.stopMainEmailWatcher = stopMainEmailWatcher;
