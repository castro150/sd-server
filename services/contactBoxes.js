'use strict'

const mongoose = require('mongoose');

const logger = require('config/logger.js');
const Contact = mongoose.model('Contact');
const ContactBox = mongoose.model('ContactBox');
const GoogleService = require('services/google.js');

let updateContactsIds = function(contactBoxId) {
	let updateContactsIdsPromise = new Promise((resolve, reject) => {
		let contactBox, boxContacts;

		findContactBox(contactBoxId)
			.then((box) => {
				contactBox = box;
				return getGoogleContacts(contactBox);
			})
			.then((googleContacts) => {
				boxContacts = googleContacts;
				return updateDbIds(contactBox.email, boxContacts);
			})
			.then(() => resolve())
			.catch((err) => reject(err));
	});

	return updateContactsIdsPromise;
};

let findContactBox = function(id) {
	let findContactBoxPromise = new Promise((resolve, reject) => {
		ContactBox.findById(id, (err, contactBox) => {
			if (err) {
				logger.debug('Error to find contact box for id ' + id);
				logger.debug(err);
				return reject(err);
			}

			logger.debug('Contact box found with success, email: ' + contactBox.email);
			return resolve(contactBox);
		});
	});

	return findContactBoxPromise;
};

let getGoogleContacts = function(contactBox) {
	let getGoogleContactsPromise = new Promise((resolve, reject) => {
		GoogleService.getContacts(contactBox, null, (err, allContacts) => {
			if (err) {
				logger.debug('Error to get contacts from google for ' + mainBox.email);
				logger.debug(err);
				return reject(err);
			}

			logger.debug('Google contacts found with success.');
			return resolve(allContacts);
		});
	});

	return getGoogleContactsPromise;
};

let updateDbIds = function(email, boxContacts) {
	let updateDbIdsPromise = new Promise((resolve, reject) => {
		getAllDbContacts()
			.then((savedContacts) => {
				boxContacts.contacts.forEach((boxContact) => {
					let savedContact = savedContacts.filter((saved) => {
						return boxContact.email === saved.email &&
							boxContact.name === saved.name;
					})[0];

					if (savedContact && savedContact.otherIds) {
						let thisId = savedContact.otherIds.filter((id) => {
							return id.email === email
						})[0];

						if (thisId) {
							thisId.id = boxContact.id;
						} else {
							savedContact.otherIds.push({
								email: email,
								id: boxContact.id
							});
						}
					} else if (savedContact) {
						savedContact.otherIds = [];
						savedContact.otherIds.push({
							email: email,
							id: boxContact.id
						});
					}
				});

				return updateDbContacts(savedContacts);
			})
			.then(() => resolve())
			.catch((err) => reject(err));
	});

	return updateDbIdsPromise;
};

let getAllDbContacts = function() {
	let getAllDbContactsPromise = new Promise((resolve, reject) => {
		Contact.find().exec((err, savedContacts) => {
			if (err) {
				logger.debug('Error to get all contacts from database.');
				logger.debug(err);
				return reject(err);
			}

			logger.debug(savedContacts.length + ' contacts found in database.');
			return resolve(savedContacts);
		});
	});

	return getAllDbContactsPromise;
};

let updateDbContacts = function(contacts) {
	let updateDbContactsPromise = new Promise((resolve, reject) => {
		logger.debug('Updating contacts in database.');

		let bulk = Contact.collection.initializeOrderedBulkOp();
		contacts.forEach(function(update) {
			bulk.find({
				id: update.id
			}).update({
				$set: {
					name: update.name,
					email: update.email,
					phoneNumber: update.phoneNumber,
					otherIds: update.otherIds
				}
			});
		});

		bulk.execute(function(err) {
			if (err) {
				logger.debug('Error to update contacts in database.');
				logger.debug(err);
				return reject(err);
			}

			logger.debug('Updated contacts in database with success.');
			return resolve();
		});
	});

	return updateDbContactsPromise;
};

exports.updateContactsIds = updateContactsIds;
