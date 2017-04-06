'use strict'

var mongoose = require('mongoose');

var CustomerSchema = new mongoose.Schema({
  number: Number,
  name: String,
  status: String,
  accessoryObligations: [{ name: String, activationDate: Date }]
});

mongoose.model('Customer', CustomerSchema);
