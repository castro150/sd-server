var winston = require('winston');
var properties = require('properties-reader')('./config/application.properties');
winston.emitErrs = true;

var logger = new winston.Logger({
	transports: [
		new winston.transports.Console({
			level: properties.get('logger.level'),
			handleExceptions: true,
			json: false,
			timestamp: () => (new Date()).toISOString(),
			colorize: true
		})
	],
	exitOnError: false
});

module.exports = logger;
module.exports.stream = {
	write: function(message, encoding) {
		if (message.slice(-1) === '\n') {
			message = message.slice(0, -1);
		}
		logger.debug(message);
	}
};
