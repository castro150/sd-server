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
let rollbackDate;

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
		GoogleService.getContacts(mainBox, mainBox.lastCheck, function(err, allContacts) {
			if (err) {
				logger.debug('Error to get contacts from google.');
				logger.debug(err);
				return;
			}

			rollbackDate = mainBox.lastCheck;
			updateLastChackDate(MAIN_EMAIL, new Date());

			logger.debug('Getting database contacts.');
			Contact.find().exec(function(err, savedContacts) {
				if (err) {
					logger.debug('Error to get contacts from database.');
					logger.debug(err);

					rollbackLastCheckDate();
					return;
				}

				logger.debug(savedContacts.length + ' contacts found in database.');
				let toUpdate = [];
				let toCreate = allContacts.contacts.filter(function(elem1) {
					return savedContacts.filter(function(elem2) {
						if (elem2.id === elem1.id) {
							elem1.otherIds = elem2.otherIds;
							toUpdate.push(elem1);
						}
						return elem2.id === elem1.id;
					}).length === 0;
				});

				if (toCreate.length > 0) {
					logger.debug('There are new contacts in the main email.');
					logger.debug('Adding new contacts in each registered contact box.');
					let addContactsPromises = [];
					ContactBox.find().exec(function(err, contactBoxes) {
						if (err) {
							logger.debug('Error to get contact boxes from database.');
							logger.debug(err);

							rollbackLastCheckDate();
							return;
						}

						contactBoxes.forEach(function(contactBox) {
							if (contactBox.email !== MAIN_EMAIL) {
								addContactsPromises.push(new Promise(function(resolve) {
									logger.debug('Adding new contacts in ' + contactBox.email);
									createContacts(contactBox, toCreate, function(err) {
										if (err) {
											logger.debug('Error to add contacts in ' + contactBox.email);
											logger.debug(err);

											rollbackLastCheckDate();
											return;
										}

										resolve();
									});
									// GoogleService.operateContacts(contactBox, toCreate, 'create', function(err, createdContacts) {
									// 	if (err) {
									// 		logger.debug('Error to add contacts in ' + contactBox.email);
									// 		logger.debug(err);
									//
									// 		rollbackLastCheckDate();
									// 		return;
									// 	}
									//
									// 	createdContacts.forEach(function(contactArray) {
									// 		contactArray.forEach(function(contact) {
									// 			let toSave = toCreate.filter(function(create) {
									// 				return contact.email === create.email &&
									// 					contact.name === create.name &&
									// 					contact.phoneNumber === create.phoneNumber;
									// 			});
									// 			if (!toSave[0].otherIds) {
									// 				toSave[0].otherIds = [];
									// 			}
									// 			toSave[0].otherIds.push({
									// 				email: contactBox.email,
									// 				id: contact.id
									// 			});
									// 		});
									// 	});
									//
									// 	resolve();
									// });
								}));
							}
						});

						Promise.all(addContactsPromises).then(function() {
							logger.debug('Adding new contacts in database.');
							Contact.collection.insert(toCreate, function(err, newContacts) {
								if (err) {
									logger.debug('Error to update contacts from database.');
									logger.debug(err);
									return;
								}

								logger.debug(newContacts.ops.length + ' new contacts added to database.');
							});
						});
					});
				} else {
					logger.debug('No modified contacts in the main email.');
				}
			});
		});
	});
};

let updateLastChackDate = function(email, newCheckDate) {
	logger.debug('Updating last check date for ' + email);
	ContactBox.findOneAndUpdate({
		email: email
	}, {
		$set: {
			lastCheck: newCheckDate
		}
	}, {
		new: true
	}, function(err) {
		if (err) {
			logger.debug('Error to update last check date for ' + email);
			logger.debug(err);
			return;
		}

		logger.debug('Success to update last check date for ' + email);
	});
};

let rollbackLastCheckDate = function() {
	logger.debug('Rolling back last check date.');
	updateLastChackDate(MAIN_EMAIL, rollbackDate);
};

let createContacts = function(contactBox, toCreate, callback) {
	GoogleService.operateContacts(contactBox, toCreate, 'create', function(err, createdContacts) {
		if (err) {
			return callback(err);
		}

		createdContacts.forEach(function(contactArray) {
			if (contactArray) {
				contactArray.forEach(function(contact) {
					let toSave = toCreate.filter(function(create) {
						return contact.email === create.email &&
							contact.name === create.name &&
							contact.phoneNumber === create.phoneNumber;
					});
					if (!toSave[0].otherIds) {
						toSave[0].otherIds = [];
					}
					toSave[0].otherIds.push({
						email: contactBox.email,
						id: contact.id
					});
				});
			}
		});

		callback(null);
	});
};

exports.registerContactBox = registerContactBox;
exports.watchMainEmail = watchMainEmail;
exports.updateContactsByMainEmail = updateContactsByMainEmail;
exports.stopMainEmailWatcher = stopMainEmailWatcher;
