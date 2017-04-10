'use strict'

var mongoose = require('mongoose');

var CustomerSchema = new mongoose.Schema({
	number: Number,
	alterNumber: Number,
	name: String,
	status: String,
	type: String,
	cpf: String,
	specialty: String,
	startServiceDate: Date,
	address: String,
	district: String,
	city: String,
	state: String,
	cep: String,
	email: String,
	contacts: [{
		name: String,
		tel: String,
		cel: String
	}],
	cei: String,
	gpsCode: String,
	accessCode: String,
	accessPassword: String,
	municipalRegist: String,
	crmCro: String,
	registryOffice: String,
	obs: String,
	accessoryObligations: [{
		name: String,
		activationDate: Date
	}]
});

mongoose.model('Customer', CustomerSchema);
