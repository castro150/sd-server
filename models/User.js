'use strict'

const properties = require('properties-reader')('./config/application.properties');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let UserSchema = new mongoose.Schema({
	username: {
		type: String,
		lowercase: true,
		unique: true
	},
	hash: String,
	salt: String
});

UserSchema.methods.setPassword = setPassword;

function setPassword(password) {
	this.salt = crypto.randomBytes(16).toString('hex');

	this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha1').toString('hex');
}

UserSchema.methods.validPassword = validPassword;

function validPassword(password) {
	let hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha1').toString('hex');

	return this.hash === hash;
}

UserSchema.methods.generateJWT = generateJWT;

function generateJWT() {
	// set expiration to 1000 minutes
	let today = new Date();
	let exp = new Date(today);
	exp.setMinutes(today.getMinutes() + 1000);

	return jwt.sign({
		_id: this._id,
		username: this.username,
		exp: parseInt(exp.getTime() / 1000),
	}, properties.get('jwt.secret'));
}

mongoose.model('User', UserSchema);
