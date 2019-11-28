
var result_hd = document.createElement('h2');
	result_hd.appendChild(document.createTextNode('Validation Results:'));

var no_err = document.createElement('p');
	no_err.appendChild(document.createTextNode('Manifest validated successfully!'));

function validateManifest() {

	var results = document.getElementById('results');
	
	while (results.hasChildNodes()) {
		results.removeChild(results.firstChild);
	}
	
	results.appendChild(result_hd);
	
	var data = '';
	
	try {
		data = JSON.parse(document.getElementById('manifest').value);
	}
	catch (e) {
		var err_p = document.createElement('p');
			err_p.appendChild(document.createTextNode('Fatal error parsing manifest: ' + e));
		results.appendChild(err_p);
		return;
	}
	
	var ajv = new Ajv();
	var validate = ajv.compile(pubmanifest);
	var valid = validate(data);
	
	if (valid) {
		results.appendChild(no_err);
	}
	else {
		var ul = document.createElement('ul');
		
		console.log(validate.errors);
		
		validate.errors.forEach(function(error) {
			var msg = error.message;
			
			if (msg.match(/should have/)) {
				msg = 'Manifest ' + msg.replace('should have','missing');
			}
			
			else if (msg.match(/should be/) && error.hasOwnProperty('params') && error.params.hasOwnProperty('type')) {
				msg = error.keyword + ' must be a ' + error.params.type.replace(',', ' or ');
			}
		
			var li = document.createElement('li');
				li.appendChild(document.createTextNode(msg));
			ul.appendChild(li)
		});
		
		results.appendChild(ul)
	}
}

