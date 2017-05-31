var path = require('path');
require('app-module-path').addPath(path.resolve());

var chai = require('chai');
global.chai = chai;

chai.config.includeStack = true;

global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;

require('models/User');
require('models/Customer');
