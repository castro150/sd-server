'use strict'

const mongoose = require('mongoose');

let CustomerSchema = new mongoose.Schema({
	number: Number,
	alterNumber: String,
	name: String,
	companyName: String,
	status: String,
	type: String,
	cpf: String,
	cnpj: String,
	specialty: String,
	startServiceDate: Date,
	startActivityDate: Date,
	address: String,
	addressNumber: String,
	addressComp: String,
	district: String,
	city: String,
	state: String,
	cep: String,
	contacts: [{
		name: String,
		email: String,
		tel: String,
		cel: String
	}],
	partners: [{
		name: String,
		identity: String,
		cpf: String,
		participation: String
	}],
	syndics: [{
		name: String,
		email: String,
		tel: String,
		period: String,
		identity: String,
		cpf: String
	}],
	cei: String,
	gpsCode: String,
	management: String,
	cae: String,
	nirc: String,
	cnae: String,
	cnae2: [String],
	syndicateName: String,
	syndicateCode: String,
	accessCode: String,
	accessPassword: String,
	municipalRegist: String,
	stateRegist: String,
	shareCapital: String,
	crmCro: String,
	registryOffice: String,
	obs: String,
	stateTax: String,
	irpj: String,
	cssl: String,
	accessoryObligations: [{
		name: String,
		activationDate: Date
	}]
});

mongoose.model('Customer', CustomerSchema);
