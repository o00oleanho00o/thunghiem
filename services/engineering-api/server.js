'use strict';

// The R5 API is a modular-monolith boundary over the proven CNB API modules.
// It intentionally does not start an OSS server or a second product service.
process.env.CNB_WEB_PORT = process.env.CNB_ENGINEERING_API_PORT || '8200';
process.env.CNB_ENGINEERING_API = 'true';
module.exports = require('../../apps/web/server.js');
