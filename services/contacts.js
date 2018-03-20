'use strict'

const mongoose = require('mongoose');
const properties = require('properties-reader')('./config/application.properties');
const extend = require('util')._extend;

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

let updateContactsByMainEmail = async function() {
	if (!MAIN_EMAIL) {
		return logger.debug('Missing google.contacts.main.email property.');
	}

	logger.debug('Getting main email box.');
	let mainBox = await ContactBox.findOne({ email: MAIN_EMAIL }).exec();
	if (!mainBox) {
		return logger.debug(MAIN_EMAIL + ' (main email) not registered.');
	}

	logger.debug('Getting main email contacts.');
	let allContacts = await GoogleService.getContacts(mainBox, mainBox.lastCheck);

	rollbackDate = mainBox.lastCheck;
	updateLastChackDate(MAIN_EMAIL, new Date());

	if (allContacts.contacts.length === 0 && allContacts.deleted.length === 0) {
		return logger.debug('No modified contacts in the main email.');
	}

	logger.debug('Getting database contacts.');
	let savedContacts = await Contact.find().exec();
	logger.debug(savedContacts.length + ' contacts found in database.');

	let toUpdate = [];
	let toCreate = allContacts.contacts.filter(function(elem1) {
		return savedContacts.filter(function(elem2) {
			if (elem2.id === elem1.id) {
				elem1.domainId = elem2.domainId;
				toUpdate.push(elem1);
			}
			return elem2.id === elem1.id;
		}).length === 0;
	});
	let toDelete = {};
	toDelete.savedIds = [];
	toDelete.domainIds = [];
	allContacts.deleted.forEach(function(deleted) {
		savedContacts.forEach(function(saved) {
			if (deleted.id === saved.id) {
				toDelete.savedIds.push(saved._id);
				toDelete.domainIds.push({
					domainId: saved.domainId
				});
			}
		});
	});

	if (toCreate.length > 0) {
		logger.debug('Adding new contacts');
		try {
			await createContacts(mainBox, toCreate);

			logger.debug('Adding new contacts in database.');
			Contact.collection.insert(toCreate, function(err, newContacts) {
				if (err) {
					logger.debug('Error to add contacts in database.');
					logger.debug(err);

					return rollbackLastCheckDate();
				}

				logger.debug(newContacts.ops.length + ' new contacts added to database.');
			});
		} catch (err) {
			logger.debug('Error to create contacts:');
			logger.debug(err.message);
			rollbackLastCheckDate();
		}
	}

	if (toUpdate.length > 0) {
		logger.debug('Updating contacts');
		try {
			await updateContacts(mainBox, toUpdate);

			logger.debug('Updating contacts in database.');
			let bulk = Contact.collection.initializeOrderedBulkOp();
			toUpdate.forEach(function(update) {
				bulk.find({ id: update.id }).update({
					$set: {
						name: update.name,
						email: update.email,
						phoneNumber: update.phoneNumber,
						domainId: update.domainId
					}
				});
			});
			bulk.execute(function(err) {
				if (err) {
					logger.debug('Error to update contacts in database.');
					logger.debug(err);

					return rollbackLastCheckDate();
				}

				logger.debug('Updated contacts in database with success.');
			});
		} catch (err) {
			logger.debug('Error to update contacts:');
			logger.debug(err.message);
			rollbackLastCheckDate();
		}
	}

	if (toDelete.savedIds.length > 0) {
		logger.debug('Deleting contacts');
		try {
			await deleteContacts(mainBox, toDelete.domainIds);

			logger.debug('Deleting contacts in database.');
			Contact.remove({
				_id: {
					$in: toDelete.savedIds
				}
			}, function(err) {
				if (err) {
					logger.debug('Error to delete contacts in database.');
					logger.debug(err);

					rollbackLastCheckDate();
					return;
				}

				logger.debug('Deleted contacts in database with success.');
			});
		} catch (err) {
			logger.debug('Error to delete contacts:');
			logger.debug(err.message);
			rollbackLastCheckDate();
		}
	}
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

let createContacts = async function(contactBox, toCreate) {
	let createdContacts = await GoogleService.operateContacts(contactBox, toCreate, 'create');

	createdContacts.forEach(function(contactArray) {
		if (contactArray) {
			contactArray.forEach(function(contact) {
				toCreate.forEach(function(toSave) {
					if(contact.email === toSave.email && contact.name === toSave.name) {
						toSave.domainId = contact.id;
					}
				});
			});
		}
	});
};

let updateContacts = async function(contactBox, toUpdate) {
	await GoogleService.operateContacts(contactBox, toUpdate, 'update');
};

let deleteContacts = async function(contactBox, toDelete) {
	await GoogleService.operateContacts(contactBox, toDelete, 'delete');
};

exports.registerContactBox = registerContactBox;
exports.watchMainEmail = watchMainEmail;
exports.updateContactsByMainEmail = updateContactsByMainEmail;
exports.stopMainEmailWatcher = stopMainEmailWatcher;
