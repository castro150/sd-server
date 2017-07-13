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

				if (toCreate.length > 0 || toUpdate.length > 0) {
					logger.debug('There are modified contacts in the main email.');
					logger.debug('Modifing contacts in each registered contact box.');
					let addContactsPromises = [];
					let updateContactsPromises = [];
					ContactBox.find().exec(function(err, contactBoxes) {
						if (err) {
							logger.debug('Error to get contact boxes from database.');
							logger.debug(err);

							rollbackLastCheckDate();
							return;
						}

						contactBoxes.forEach(function(contactBox) {
							if (contactBox.email !== MAIN_EMAIL) {
								if (toCreate.length > 0) {
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
									}));
								}

								if (toUpdate.length > 0) {
									let toUpdateThisBox = [];
									let toCreateThisBox = [];
									toUpdate.forEach(function(contact) {
										if (contact.otherIds) {
											let thisId = contact.otherIds.filter(function(otherId) {
												return otherId.email === contactBox.email;
											});
											if (thisId.length > 0) {
												let cloneContact = extend({}, contact);
												cloneContact.id = thisId[0].id;
												toUpdateThisBox.push(cloneContact);
											} else {
												// toCreateThisBox.push(extend({}, contact));
												toCreateThisBox.push(contact);
											}
										} else {
											// toCreateThisBox.push(extend({}, contact));
											toCreateThisBox.push(contact);
										}
									});

									if (toUpdateThisBox.length > 0) {
										updateContactsPromises.push(new Promise(function(resolve) {
											logger.debug('Updating contacts in ' + contactBox.email);
											updateContacts(contactBox, toUpdateThisBox, function(err) {
												if (err) {
													logger.debug('Error to add update in ' + contactBox.email);
													logger.debug(err);

													rollbackLastCheckDate();
													return;
												}

												resolve();
											});
										}));
									}

									if (toCreateThisBox.length > 0) {
										updateContactsPromises.push(new Promise(function(resolve) {
											logger.debug('Adding new contacts from update in ' + contactBox.email);
											createContacts(contactBox, toCreateThisBox, function(err) {
												if (err) {
													logger.debug('Error to add contacts from update in ' + contactBox.email);
													logger.debug(err);

													rollbackLastCheckDate();
													return;
												}

												// toCreateThisBox.forEach(function(inThisBox) {
												// 	inToCreate = toUpdate.filter(function(create) {
												// 		return create.id === inThisBox.id;
												// 	});
												// 	inToCreate.otherIds = inThisBox.otherIds;
												// });

												resolve();
											});
										}));
									}
								}
							}
						});

						if (addContactsPromises.length > 0) {
							Promise.all(addContactsPromises).then(function() {
								logger.debug('Adding new contacts in database.');
								Contact.collection.insert(toCreate, function(err, newContacts) {
									if (err) {
										logger.debug('Error to add contacts in database.');
										logger.debug(err);

										rollbackLastCheckDate();
										return;
									}

									logger.debug(newContacts.ops.length + ' new contacts added to database.');
								});
							});
						}

						if (updateContactsPromises.length) {
							Promise.all(updateContactsPromises).then(function() {
								logger.debug('Updating contacts in database.');
								let bulk = Contact.collection.initializeOrderedBulkOp();
								toUpdate.forEach(function(update) {
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

										rollbackLastCheckDate();
										return;
									}

									logger.debug('Updated contacts in database with success.');
								});
							});
						}
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

let updateContacts = function(contactBox, toUpdate, callback) {
	GoogleService.operateContacts(contactBox, toUpdate, 'update', function(err, updatedContacts) {
		if (err) {
			return callback(err);
		}

		callback(null, updatedContacts);
	});
};

exports.registerContactBox = registerContactBox;
exports.watchMainEmail = watchMainEmail;
exports.updateContactsByMainEmail = updateContactsByMainEmail;
exports.stopMainEmailWatcher = stopMainEmailWatcher;
