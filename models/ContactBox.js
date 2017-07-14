'use strict'

const mongoose = require('mongoose');

let ContactBoxSchema = new mongoose.Schema({
	email: {
		type: String,
		unique: true
	},
	tokens: {
		access_token: String,
		expiry_date: Number,
		id_token: String,
		refresh_token: String,
		token_type: String
	},
	lastCheck: Date
});

mongoose.model('ContactBox', ContactBoxSchema);
