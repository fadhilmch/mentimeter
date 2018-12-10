var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var cors = require('cors');

var index = require('./routes/index');
var users = require('./routes/users');
var questions = require('./routes/questions');
var answers = require('./routes/answers');
var presentations = require('./routes/presentations');

var dbUrl = 'mongodb://localhost/mentimeter';
var db = mongoose.connection;
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/api/users', users);
app.use('/api/questions', questions);
app.use('/api/answers', answers);
app.use('/api/presentations', presentations);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

mongoose.connect(dbUrl,{ useNewUrlParser: true }, err => {
  if(!err)
    console.log('Connected to database');
  else
    console.log('Error connected to database: '+ err);
})

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
