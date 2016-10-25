'use strict';
var router = require('express').Router(); // eslint-disable-line new-cap
module.exports = router;

// Fill in routes here
//router.use('/tbd', require('./tbd'));

// Make sure this is after all of
// the registered routes!
router.use(function (req, res, next) {
    var err = new Error('Not found.');
    err.status = 404;
    next(err);
});
