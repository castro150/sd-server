'use strict'

const XMLWriter = require('xml-writer');
const https = require('https');
const mongoose = require('mongoose');
const google = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const xml2js = require('xml2js');
const xmlParser = new xml2js.Parser();
const properties = require('properties-reader')('./config/application.properties');

const logger = require('config/logger.js');
const ContactBox = mongoose.model('ContactBox');

const CLIENT_ID = properties.get('google.contacts.client.id');
const CLIENT_SECRET = properties.get('google.contacts.client.secret');
const REDIRECT_URL = properties.get('google.contacts.redirect.url');
const SCOPES = [
	'https://www.googleapis.com/auth/plus.me',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.google.com/m8/feeds/contacts/default/full'
];

let generateAuthUrl = function() {
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
	return oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
};

let authenticate = function(code, callback) {
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
	oauth2Client.getToken(code, function(err, tokens) {
		if (err) {
			return callback(err);
		}

		oauth2Client.setCredentials(tokens);
		google.plus('v1').people.get({
			userId: 'me',
			auth: oauth2Client
		}, function(err, profile) {
			if (err) {
				return callback(err);
			}

			return callback(null, profile.emails[0].value, tokens);
		});
	});
};

let getContacts = function(contactBox, updatedMin, callback) {
	let now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return getContacts(refreshedContactBox, updatedMin, callback);
		});
	} else {
		let path = '/m8/feeds/contacts/default/full?max-results=10000&showdeleted=true';
		if (updatedMin) {
			path += '&updated-min=' + updatedMin.toISOString();
		}
		let options = {
			host: 'www.google.com',
			path: path,
			method: 'GET',
			headers: {
				'Content-Type': 'application/atom+xml',
				'GData-Version': '3.0',
				'Authorization': 'Bearer ' + contactBox.tokens.access_token
			}
		};

		logger.debug('Getting contacts from Google: ' + contactBox.email);
		let request = https.request(options, function(response) {
			let returnedData = '';
			response.on('data', function(chunk) {
				returnedData += chunk;
			});

			response.on('end', function() {
				if (response.statusCode === 200) {
					xmlParser.parseString(returnedData, function(err, googleContacts) {
						let allContacts = googleContactsToEntity(googleContacts);
						logger.debug(allContacts.contacts.length + ' modified contacts found for ' + contactBox.email);
						callback(null, allContacts);
					});
				} else {
					callback('Error status: ' + response.statusCode);
				}
			});

			response.on('error', function(err) {
				callback(err);
			});
		});

		request.on('error', function(err) {
			callback(err);
		});

		request.end();
	}
};

let operateContacts = function(contactBox, contacts, operation, callback) {
	let now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return operateContacts(refreshedContactBox, contacts, operation, callback);
		});
	} else {
		let options = {
			host: 'www.google.com',
			path: '/m8/feeds/contacts/default/full/batch',
			method: 'POST',
			headers: {
				'Content-Type': 'application/atom+xml',
				'GData-Version': '3.0',
				'Authorization': 'Bearer ' + contactBox.tokens.access_token
			}
		};

		let batchIndex = 0;
		let promises = [];
		logger.debug('Sending contacts to Google: ' + contactBox.email + '. Operation: ' + operation);
		// TODO IMPORTANTE ACERTAR ISSO!!!
		// for (let i = 0, j = contacts.length; i < j; i += 100) {
		for (let i = 0, j = contacts.length; i < j; i += 2) {
			promises.push(new Promise(function(resolve, reject) {
				// let subcontacts = contacts.slice(i, i + 100);
				let subcontacts = contacts.slice(i, i + 2);

				let request = https.request(options, function(response) {
					let returnedData = '';
					response.on('data', function(chunk) {
						returnedData += chunk;
					});

					response.on('end', function() {
						batchIndex++;
						if (response.statusCode === 200) {
							xmlParser.parseString(returnedData, function(err, batchResponse) {
								logger.debug('Operation: ' + operation + ' to ' + contactBox.email + ' with success, batch ' + batchIndex);
								logger.file('log-' + contactBox.email + batchIndex + '.log').debug(returnedData);
								let contacts = googleContactsToEntity(batchResponse).contacts;
								resolve(contacts);
							});
						} else {
							reject('Google request error in some batch. Error status: ' + response.statusCode);
						}
					});

					response.on('error', function(err) {
						logger.debug('Google request error in some batch.');
						reject(err);
					});
				});

				request.on('error', function(err) {
					logger.debug('Google request error in some batch.');
					reject(err);
				});

				request.write(createBatchContactsXml(contactBox.email, subcontacts, operation));
				request.end();
			}).catch(function(err) {
				return callback(err);
			}));
		}

		Promise.all(promises).then(function(createdContacts) {
			return callback(null, createdContacts);
		}).catch(function(err) {
			logger.debug('Error to execute all promises to add google contacts requests.');
			logger.debug(err);
			return callback(err);
		});
	}
};

let refreshToken = function(contactBox, callback) {
	logger.debug('Refreshing token for ' + contactBox.email);
	let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
	oauth2Client.setCredentials(contactBox.tokens);
	oauth2Client.refreshAccessToken(function(err, newTokens) {
		if (err) {
			return callback(err);
		}

		logger.debug('Saving new token for ' + contactBox.email);
		ContactBox.findOneAndUpdate({
			email: contactBox.email
		}, {
			$set: {
				tokens: newTokens
			}
		}, {
			new: true
		}, function(err, updatedContactBox) {
			if (err) {
				return callback(err);
			}

			logger.debug('Success to save new token for ' + contactBox.email);
			return callback(null, updatedContactBox);
		});
	});
};

let createBatchContactsXml = function(email, contacts, operation) {
	let writer = new XMLWriter();
	writer.startDocument('1.0', 'UTF-8')
		.startElement('feed')
		.writeAttribute('xmlns', 'http://www.w3.org/2005/Atom')
		.writeAttribute('xmlns:gContact', 'http://schemas.google.com/contact/2008')
		.writeAttribute('xmlns:gd', 'http://schemas.google.com/g/2005')
		.writeAttribute('xmlns:batch', 'http://schemas.google.com/gdata/batch');

	contacts.forEach(function(contact) {
		let names = contact.name.split(' ');
		let familyName = names.slice(1, names.length).join(' ');
		if (operation != 'create') {
			contact.id = contact.id.replace('/base/', '/full/');
		}

		if (operation != 'create') {
			writer.startElement('entry').writeAttribute('gd:etag', '*')
				.startElement('batch:id').text(operation).endElement()
				.startElement('batch:operation').writeAttribute('type', operation).endElement()
				.startElement('id').text(contact.id).endElement();
		} else {
			writer.startElement('entry')
				.startElement('batch:id').text(operation).endElement()
				.startElement('batch:operation').writeAttribute('type', 'insert').endElement();
		}
		writer.startElement('category')
			.writeAttribute('scheme', 'http://schemas.google.com/g/2005#kind')
			.writeAttribute('term', 'http://schemas.google.com/g/2008#contact')
			.endElement()
			.startElement('gd:name')
			.startElement('gd:fullName').text(contact.name).endElement()
			.startElement('gd:givenName').text(names[0]).endElement()
			.startElement('gd:familyName').text(familyName).endElement()
			.endElement();
		if (contact.email !== undefined && contact.email !== null && contact.email !== '') {
			writer.startElement('gd:email')
				.writeAttribute('rel', 'http://schemas.google.com/g/2005#home')
				.writeAttribute('address', contact.email)
				.writeAttribute('primary', 'true')
				.endElement();
		}
		if (contact.phoneNumber !== undefined && contact.phoneNumber !== null && contact.phoneNumber !== '') {
			writer.startElement('gd:phoneNumber')
				.writeAttribute('rel', 'http://schemas.google.com/g/2005#other')
				.writeAttribute('primary', 'true')
				.text(contact.phoneNumber)
				.endElement();
		}
		writer.startElement('gContact:groupMembershipInfo')
			.writeAttribute('deleted', 'false')
			.writeAttribute('href', 'http://www.google.com/m8/feeds/groups/' + email + '/base/6')
			.endElement();
		writer.endElement();
	});

	writer.endElement()
		.endDocument();

	return writer.toString();
};

let googleContactsToEntity = function(googleContacts) {
	let contacts = [];
	let deleted = [];
	if (googleContacts.feed.entry) {
		googleContacts.feed.entry.forEach(function(googleEntry) {
			let contact = {};
			contact.id = googleEntry.id[0];
			if (googleEntry['gd:deleted']) {
				deleted.push(contact);
			} else {
				if (googleEntry['gd:email']) {
					contact.email = googleEntry['gd:email'][0].$.address;
				}
				if (googleEntry['gd:name']) {
					contact.name = googleEntry['gd:name'][0]['gd:fullName'][0];
				}
				if (googleEntry['gd:phoneNumber']) {
					contact.phoneNumber = googleEntry['gd:phoneNumber'][0].$.uri;
				}
				contacts.push(contact);
			}
		});
	}

	return {
		contacts: contacts,
		deleted: deleted
	};
}

exports.generateAuthUrl = generateAuthUrl;
exports.authenticate = authenticate;
exports.getContacts = getContacts;
exports.operateContacts = operateContacts;
