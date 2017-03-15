var mongoose = require('mongoose');

var User = mongoose.model('User');

exports.register = function(username, password, callback) {
  var user = new User();

  user.username = username;
  user.setPassword(password);

  user.save(function(err) {
    if (err) { return callback(err); }

    return callback(null, user);
  });
};
