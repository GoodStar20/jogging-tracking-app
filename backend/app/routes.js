var User = require('./models/user');
var bcrypt = require('bcrypt');
var https = require('https');
// var nodemailer = require('nodemailer');
var crypto = require('crypto');
var axios = require('axios');
var passport = require('passport');
// var {OAuth2Client} = require('google-auth-library');
var { generateToken, sendToken } = require('./utils/token.utils');
var config = require('../config/auth');
// var smtpTransport = nodemailer.createTransport({
//     service: "Gmail",
//     auth: {
//         user: "",
//         pass: ""
//     }
// });

var rand,mailOptions,host,link;

var GoogleTokenStrategy = require('passport-google-token').Strategy;

passport.use(new GoogleTokenStrategy({
	clientID: config.googleAuth.clientID,
	clientSecret: config.googleAuth.clientSecret
	},
	function (accessToken, refreshToken, profile, done) {
			// console.log(profile);
			var email = profile.id;
			var provider = profile.provider;
			var name = profile.displayName;
			var picutre = profile._json.picture;
			User.findOne({
				email: email
			}, function (err, result) {
				if (!result) {
					var newUser = new User({
						name: name,
						email: email,
						picture: picutre,
						provider: provider,
						activity: 1
					});
					User.createUser(newUser, function (err, user) {		
						return done(err, user);
					});
				}
				else{
					return done(err,result);
				}

			});
	}
));

module.exports = function (app) {
	// 	app.use(function(req, res, next) {
	// 	const err = new Error('Not Found');
	// 	err.status = 404;
	// 	next(err);
	// });
	
	// // error handler
	// app.use(function(err, req, res, next) {
	// 	// set locals, only providing error in development
	// 	res.locals.message = err.message;
	// 	res.locals.error = req.app.get('env') === 'development' ? err : {};
	
	// 	// render the error page
	// 	res.status(err.status || 500);
	// 	res.render('error');
	// });	
	// register users
	app.post('/user/register', function (req, res) {
		User.findOne({
			email: req.body.email
		}, function (err, result) {
			if (!result) {
				var email = req.body.email;
				var api_key = 'at_RWBXbuZqk5oBmcJsfcbJxsEWYK2SI';
				var api_url = 'https://emailverification.whoisxmlapi.com/api/v1?';
				var url = api_url + 'apiKey=' + api_key + '&emailAddress=' + email;

				https.get(url, function(response) {
					var str = '';
					var string = '';
					response.on('data', function(chunk) { str += chunk; });
					response.on('end', function() {
						string = JSON.parse(str);
						if( string.smtpCheck ){
							rand = crypto.randomBytes(16).toString('hex');
							host = req.get('host');
							link="http://"+req.get('host')+"/user/verify?id="+rand;
							console.log(rand);
							// mailOptions={
							// 	to : req.query.to,
							// 	subject : "Please confirm your Email account",
							// 	html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>"	
							// }
							// smtpTransport.sendMail(mailOptions, function(error, response){
							// 	if(error) {
							// 		console.log(error);
							// 		res.end("error");
							// 	}
							// 	else {
							// 		console.log("Message sent: " + response.message);
							// 		res.end("sent");
							// 	}
							// });
							var newUser = new User({
								name: req.body.name,
								email: req.body.email,
								password: req.body.password,
							});
							User.createUser(newUser, function (err, user) {		
								if (err) {
									res.send(err);
								} else {
									res.send({
										'email': req.body.email,
										'state': 1,
										'message': "Your account has been successfully created!"
									});
								}
							});
						}
						else {
							res.send({
								'state': 0,
								'message': "Your email is valid or non-existing email. Please check your email."
							});
						}
					});
				}).end();	
			} else {
				res.send({
					'state': 0,
					'message': "This email is existing Email!"
				});
			}
		});
	});
	app.post('/user/resetpass', function (req, res) {
		User.findOne({
			email: req.body.email
		}, function (err, result) {
			if (result) {
				var email = req.body.email;
				var newpass = req.body.newpass;
				var userpassword = result.password;
				var password = req.body.curpass;
				User.comparePassword(password, userpassword, function (err, isMatch) {
					if (err) throw err;
					if (isMatch) {
						bcrypt.genSalt(10, function (err, salt) {
							bcrypt.hash(newpass, salt, function (err, hash) {
								newpass = hash;
								User.updateOne({
									email: email
								}, {
									password: newpass
								}, function (err, result) {
									if (err) {
										res.send(err);
									} else {
										res.send({
											'state': 1,
											'message': "Reset Password!"
										});
									}
								});
							});
						});
					} else {
						res.send({
							'state': 0,
							'message': "Current Password isn't correct!"
						});
					}
				});

			} else {
				res.send({
					'state': 0,
					'message': "unregistered User!"
				});
			}
		});
	});

	app.post('/user/fileupload', (req, res, next) => {
		let imageFile = req.files.file;
		console.log(`${__dirname}/../public/user_images/${req.body.filename}.jpg`);
		imageFile.mv(`${__dirname}/../public/user_images/${req.body.filename}.jpg`, function(err) {
			if (err) {
				return res.status(500).send(err);
			}
			res.json({file: `user_images/${req.body.filename}.jpg`});
		});
	
	});

	//check user in login
	app.post('/user/login', function (req, res) {
		User.findOne({
			email: req.body.email,
		}, function (err, result) {
			if (!result) {
				res.send({
					'state': 0,
					'message': "There isn't Email Address!"
				});
			} else {
				var userpassword = result.password;
				var password = req.body.password;
				var email = req.body.email;
				User.comparePassword(password, userpassword, function (err, isMatch) {
					if (err) throw err;
					if (isMatch) {
						if(result.activity === 1){
							res.send({
								'state': 1,
								'message': "Successfully Login!"
							});
						}
						else{
							res.send({
								'state': 0,
								'message': "Please contact Admin!"
							});
						}
						
					} else {
						res.send({
							'state': 0,
							'email' : email,
							'message': "Password isn't correct!"
						});
					}
				});
			}
		});
	});

	app.get('/user/verify',function(req,res){
		if((req.protocol+"://"+req.get('host')) === ("http://"+host)){
			if(req.query.id === rand){
				User.updateOne({
					email: req.query.email
				}, {
					activity: 1
				}, function (err, result) {
					if (err) {
						res.send(err);
					} else {
						res.send({
							'state': 1,
							'message': "Email is been Successfully verified"
						});
					}
				});
			}
			else {
				res.send({
					'state': 1,
					'message': "Taken is valid"
				});
			}
		}
		else {
			res.send({
				'state': 0,
				'message': "Request is from unknown source"
			});
		}
	});

	app.post('/user/google', passport.authenticate('google-token', {session: false}), function(req, res, next) {
		console.log("qqqqqqqqqq")
		if (!req.user) {
				return res.send(401, 'User Not Authenticated');
		}
		req.auth = {
				id: req.user.id
		};
		next();
	}, generateToken, sendToken);
		// console.log(id_token);
		// passport.authenticate(id_token), function (req, res) {
		// 	// do something with req.user
		// 	console.log(id_token);
		// 	res.send(req.user? 200 : 401);
		// }
		// User.findOne({
		// 	email: req.body.googleId
		// }, function (err, result) {
		// 	if (!result) {
		// 		var newUser = new User({
		// 			name: req.body.googleId,
		// 			email: req.body.googleId,
		// 			password: req.body.id_token,
		// 			activity: 1
		// 		});
		// 		User.createUser(newUser, function (err, user) {		
		// 			if (err) {
		// 				res.send(err);
		// 			} else {
		// 				res.send({
		// 					'state': 1,
		// 					'message': "Your account has been successfully created!"
		// 				});
		// 			}
		// 		});
		// 	}
		// 	else{
		// 		var userpassword = result.password;
		// 		var password = req.body.id_token;
		// 		var email = req.body.googleId;
		// 		User.comparePassword(password, userpassword, function (err, isMatch) {
		// 			if (err) throw err;
		// 			if (isMatch) {
		// 				res.send({
		// 					'state': 1,
		// 					'message': "Successfully Login!"
		// 				});
		// 			} else {
		// 				res.send({
		// 					'state': 0,
		// 					'email' : email,
		// 					'message': "Password isn't correct!"
		// 				});
		// 			}
		// 		});
		// 	}
		// });
	
	// application -------------------------------------------------------------
	app.get('*', function (req, res) {
		res.sendFile(__dirname + '/public/index.html'); // load the single view file (angular will handle the page changes on the front-end)
	});
};