var express = require('express');
var app = express();
var pg = require('pg');

//pg.defaults.ssl = true;

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


pg.connect(process.env.DATABASE_URL, function(err, client) {
  if (err) throw err;

	app.get('/', function(request, response) {
	  var users = [];
	  client.query('SELECT username, rank FROM public.users order by rank desc;', function(err, result) {
	  	response.render('pages/index', { users: result.rows });
	  });
	});

	app.listen(app.get('port'), function() {
	  console.log('Node app is running on port', app.get('port'));
	});

  
});


