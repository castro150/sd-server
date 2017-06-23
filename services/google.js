'use strict'

const XMLWriter = require('xml-writer');
const https = require('https');
const mongoose = require('mongoose');
const google = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const GoogleContacts = require('google-contacts').GoogleContacts;
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

let getContacts = function(contactBox, callback) {
	let now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return getContacts(refreshedContactBox, callback);
		});
	} else {
		let contactsApi = new GoogleContacts({
			consumerKey: CLIENT_ID,
			consumerSecret: CLIENT_SECRET,
			token: contactBox.tokens.access_token,
			refreshToken: contactBox.tokens.refresh_token
		});

		logger.debug('Getting contacts from Google: ' + contactBox.email);
		contactsApi.getContacts(function(err, contacts) {
			if (err) {
				return callback(err);
			}

			logger.debug(contacts.length + ' contacts found for ' + contactBox.email);
			return callback(null, contacts);
		});
	}
};

let addContacts = function(contactBox, contacts, callback) {
	let now = new Date();
	if (now.getTime() >= contactBox.tokens.expiry_date) {
		refreshToken(contactBox, function(err, refreshedContactBox) {
			if (err) {
				return callback(err);
			}

			return addContacts(refreshedContactBox, contacts, callback);
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
		logger.debug('Sending contacts to Google: ' + contactBox.email);
		for (let i = 0, j = contacts.length; i < j; i += 100) {
			let subcontacts = contacts.slice(i, i + 100);

			let request = https.request(options, function(response) {
				let returnedData = '';
				response.on('data', function(chunk) {
					returnedData += chunk;
				});

				response.on('end', function() {
					batchIndex++;
					if (response.statusCode === 200) {
						logger.debug('New contacts added to ' + contactBox.email + ', batch ' + batchIndex);
						logger.file('log-' + contactBox.email + batchIndex + '.log').debug(returnedData);
						callback(null, returnedData);
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

			request.write(createContactsXml(contactBox.email, subcontacts));
			request.end();
		}
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

let createContactsXml = function(email, contacts) {
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

		writer.startElement('entry')
			.startElement('batch:id').text('create').endElement()
			.startElement('batch:operation').writeAttribute('type', 'insert').endElement()
			.startElement('category')
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

exports.generateAuthUrl = generateAuthUrl;
exports.authenticate = authenticate;
exports.getContacts = getContacts;
exports.addContacts = addContacts;
