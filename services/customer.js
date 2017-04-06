'use strict'

var mongoose = require('mongoose');

var msg = require('properties-reader')('./config/messages.properties');
var logger = require('config/logger.js');
var Customer = mongoose.model('Customer');
var CustomerStatus = require('models/CustomerStatus.js');

var activeNumberExistsMsg = msg.get('customer.create.active.number.exists');

exports.create = function(customerProperties, callback) {
  var newCustomer = new Customer(customerProperties);

  validateExistisActiveNumber(newCustomer, function(err) {
    if (err) { return callback(err); }

    newCustomer.save(function(err) {
      if (err) { return callback(err); }

      logger.debug('New customer created: ' + newCustomer.number + ' - ' + newCustomer.name);
      return callback(null, newCustomer);
    });
  });
};

var validateExistisActiveNumber = function(newCustomer, callback) {
  var query = Customer.find({
    number: newCustomer.number,
    status: CustomerStatus.ACTIVE
  });

  query.exec(function(err, customer) {
    if (err) { return callback(err); }
    if (customer.length !== 0) {
      return callback(createError(activeNumberExistsMsg, 'Create Customer: number ' + newCustomer.number + ' in use for active customer', 400));
    }

    return callback(null);
  });
};

var createError = function(name, msg, status) {
  var err = new Error(msg);
  err.name = name;
  err.status = status;
  return err;
};
