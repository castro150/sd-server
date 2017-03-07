var mongoose = require('mongoose');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var UserSchema = new mongoose.Schema({
  username: { type: String, lowercase: true, unique: true },
  hash: String,
  salt: String
});

UserSchema.methods.setPassword = setPassword;
function setPassword(password) {
  this.salt = crypto.randomBytes(16).toString('hex');

  this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
}

UserSchema.methods.validPassword = validPassword;
function validPassword(password) {
  var hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');

  return this.hash === hash;
}

UserSchema.methods.generateJWT = generateJWT;
function generateJWT() {
  // set expiration to 20 minutes
  var today = new Date();
  var exp = new Date(today);
  exp.setMinutes(today.getMinutes() + 20);

  return jwt.sign({
    _id: this._id,
    username: this.username,
    exp: parseInt(exp.getTime() / 1000),
  }, 'SECRET');
  // TODO é recomendável deixar este segundo argumento em uma variável
  // de ambiente, fora da base do código, porque é o segredo usado para
  // gerar os tokens.
}

mongoose.model('User', UserSchema);
