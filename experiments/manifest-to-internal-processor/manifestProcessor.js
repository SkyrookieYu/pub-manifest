
'use strict';

var manifestProcessor = (function() {

	var duration = new RegExp('^P([0-9]+(?:[,\.][0-9]+)?Y)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?D)?(?:T([0-9]+(?:[,\.][0-9]+)?H)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?S)?)?$');
	var bcp47 = new RegExp('^((?:(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?:([A-Za-z]{2,3}(-(?:[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?:[A-Za-z]{4}))?(-(?:[A-Za-z]{2}|[0-9]{3}))?(-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?:[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?:x(-[A-Za-z0-9]{1,8})+))?)|(?:x(-[A-Za-z0-9]{1,8})+))$');
	// regex works for general cases, but haven't tested in depth 
	var dateTime = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])(T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{3})?(Z)?)?$');
	
	var knownProfiles = {
		'https://www.w3.org/TR/audiobooks/': 'audiobooks',
		'https://www.w3.org/TR/pub-manifest/': 'generic'
	};
	
	var bodyRelValues = new Set('contents', 'cover', 'pagelist');
	
	var expectsObject = {
		'accessModeSufficient': ['']
	};
	
	var expectsArray = {
		'url': [''],
		'type': ['', 'Person', 'Organization', 'LinkedResource'],
		'inLanguage': [''],
		'conformsTo': [''],
		'name': ['', 'Person', 'Organization', 'LinkedResource'],
		'identifier': ['Person', 'Organization'],
		'address': [''],
		'accessMode': [''],
		'accessModeSufficient': [''],
		'accessibilityFeature': [''],
		'accessibilityHazard': [''],
		'artist': [''],
		'author': [''],
		'colorist': [''],
		'contributor': [''],
		'creator': [''],
		'editor': [''],
		'illustrator': [''],
		'inker': [''],
		'letterer': [''],
		'penciler': [''],
		'publisher': [''],
		'readBy': [''],
		'translator': [''],
		'readingOrder': [''],
		'resources': [''],
		'links': [''],
		'alternate': ['LinkedResource'],
		'description': ['LinkedResource'],
		'rel': ['LinkedResource']
	};
	
	var expectsEntity = {
		'artist': [''],
		'author': [''],
		'colorist': [''],
		'contributor': [''],
		'creator': [''],
		'editor': [''],
		'illustrator': [''],
		'inker': [''],
		'letterer': [''],
		'penciler': [''],
		'publisher': [''],
		'readBy': [''],
		'translator': ['']
	};
	
	var expectsLocalizableString = {
		'name': ['', 'Person', 'Organization', 'LinkedResource'],
		'accessibilitySummary': [''],
		'description': ['LinkedResource']
	}
	
	var expectsLinkedResource = {
		'readingOrder': [''],
		'resources': [''],
		'links': [''],
		'alternate': ['LinkedResource']
	};
	
	var expectsURL = {
		'url': ['', 'Person', 'Organization', 'LinkedResource'],
		'address': ['']
	};
	
	var expectsLiteral = {
		'type': ['', 'Person', 'Organization', 'LinkedResource'],
		'encodingFormat': ['LinkedResource'],
		'rel': ['LinkedResource'],
		'integrity': ['LinkedResource'],
		'accessMode': [''],
		'accessibilityHazard': [''],
		'accessibilityFeature': [''],
		'duration': ['', 'LinkedResource'],
		'dateModified': [''],
		'datePublished': [''],
		'inLanguage': [''],
		'readingProgression': [''],
		'url': ['LinkedResource'],
		'identifier': ['Person', 'Organization']
	};
	
	var expectsIdentifier = {
		'id': ['', 'Person', 'Organization']
	}
	
	var expectsBoolean = {
		'abridged': ['']
	};
	
	var expectsNumber = {};
	
	var _internal_rep = '';
	
	function getInternalRepresentation() {
		return _internal_rep;
	}
	
	function processManifest(manifest_link) {
		
		return new Promise(function(resolve, reject) {
			getManifest(manifest_link)
				.then(function(data) {
					
					if (!data) {
						console.error('Manifest text not found.');
						throw new Error()
					}
					
					var base = location.href.substring(0, location.href.lastIndexOf("/")+1);
					var doc = document;
					
					_internal_rep = processManifestData(data, base, doc);
					resolve();
				}
			)
			.catch (function(err) {
				console.error(err);
				reject();
			});
		});
	}
	
	
	function getManifest(manifest_link) {
		
		return new Promise(function(resolve, reject) {
		
			if (manifest_link) {
				if (manifest_link.indexOf('#') != -1) {
					var script = document.getElementById(manifest_link.substring(manifest_link.indexOf('#')+1));
					if (script) {
						var data = script.innerHTML.trim();
						resolve(data);
					}
				}
				else {
					$.ajax({
						url:       manifest_link,
						cache:     false,
						success: function(data) {
							resolve(JSON.stringify(data));
						},
						error: function(err) {
							reject(err);
						}
					});
				}
			}
			
			else {
				console.error('Manifest link could not be located');
				reject();
			}
		});
	}
	
	
	function processManifestData(text, base, doc) {
	
		// step 1 - create processed object
		
		var processed = {};
		
		// step 2 - parse json
		
		var manifest;
		
		try {
			manifest = JSON.parse(text);
			if (Array.isArray(manifest) || typeof(manifest) !== 'object') {
				console.error('The manifest must be a JSON object.');
				throw new Error();
			}
		}
		
		catch (e) {
			console.error('Error parsing manifest: ' + e);
			throw new Error();
		}
		
		// step 3 - manifest contexts
		
		if (!manifest.hasOwnProperty('@context')) {
			console.error('@context not set.');
			throw new Error();
		}
		
		if (!Array.isArray(manifest['@context'])) {
			console.error('@context is not an array.');
			throw new Error();
		}
		
		if (manifest['@context'][0] != 'https://schema.org' || manifest['@context'][1] != 'https://www.w3.org/ns/pub-context') {
			console.error('First two declartaions in @context must be "https://schema.org" and "https://www.w3.org/ns/pub-context"');
			throw new Error();
		}
		
		// step 4 - profile conformance
		
		if (!manifest.hasOwnProperty('conformsTo')) {
			console.error('No profile specified. (No testing for compatible profiles in this processor.)');
			throw new Error();
		}
		
		else if (Array.isArray(manifest['conformsTo'])) {
			var matches = [];
			for (var i = 0; i < manifest['conformsTo'].length; i++) {
				if (knownProfiles.hasOwnProperty(manifest['conformsTo'][i])) {
					matches.push(manifest['conformsTo'][i]);
				}
			}
			
			if (matches.length == 0) {
				console.error('No profiles recognized. (No testing for compatible profiles in this processor.)');
				throw new Error();
			}
			
			else {
				processed['profile'] = matches[0];
			}
		}
		
		else {
			if (knownProfiles.hasOwnProperty(manifest['conformsTo'])) {
				processed['profile'] = manifest['conformsTo'];
			}
			else {
				console.error('Profile not recognized. (No testing for compatible profiles in this processor.)');
				throw new Error();
			}
		}
		
		// step 5 - global language/direction 
		
		var lang = '';
		var dir = '';
		
		for (var i = manifest['@context'].length - 1; i >= 0; i--) {
			if (manifest['@context'][i] !== null && !Array.isArray(typeof(manifest['@context'][i])) && typeof(manifest['@context'][i]) === 'object') {
				if (lang == '' && manifest['@context'][i].hasOwnProperty('language')) {
					lang = manifest['@context'][i]['language'];
				}
				if (dir == '' && manifest['@context'][i].hasOwnProperty('direction')) {
					lang = manifest['@context'][i]['direction'];
				}
				if (lang != '' && dir != '') {
					break;
				}
			}
			
			if (lang && !bcp47.test(lang)) {
				console.warn('Invalid global language tag "' + lang + '" found.');
				lang = '';
			}
			
			if (dir && (dir != 'ltr' && dir != 'rtl')) {
				console.warn('Invalid global direction "' + dir + '" found.');
				dir = '';
			}
		}
		
		// step 6 - add normalized data to processed
		
		for (var key in manifest) {
			try {
				processed[key] = normalizeData(key, manifest[key], lang, dir, base, '');
			}
			catch(e) {
				// don't add key to processed
			}
		}
		
		// step 7 - run data validation checks
		
		processed = dataValidation(processed);
		
		// step 8 - add html defaults
		
		try {
			processed = addHTMLDefaults(processed, doc);
		}
		catch(e) {
			console.error('Terminating processing.');
			throw new Error();
		}
		
		// step 9 - profile extensions
		
		if (processed['profile'] == 'https://www.w3.org/TR/audiobooks/') {
			
			// step 1 - check table of contents
			if (!doc || !doc.querySelector('*[role="doc-toc"]')) {
				var toc = false;
				if (processed.hasOwnProperty('resources')) {
					res: for (var i = 0; i < processed['resources'].length; i++) {
						if (processed['resources'][i].hasOwnProperty('rel')) {
							for (var j = 0; j < processed['resources'][i]['rel'].length; j++) {
								if (processed['resources'][i]['rel'][j] == 'contents') {
									toc = true;
									break res;
								}
							}
						}
					}
				}
				if (!toc) {
					console.warn('No table of contents found in the publication.');
				}
			}
		
		}
		
		// non-spec steps to make valid json output
		
		// convert the set used to hold the unique resources to an array
		processed['uniqueResources'] =  Array.from(processed['uniqueResources']);

		
		// step 10 - return finished data 
		
		return processed;
	
	}
	
	
	function normalizeData(key, value, lang, dir, base, context) {
		
		// step 1 - set normalized to the incoming value
		
		var normalized = value;
		
		// step 2 - remove @context
		
		if (key == '@context') {
			throw new Error();
		}
		
		// step 3 - create arrays
		
		if (checkExpectsArray(key, context)) {
			if (!Array.isArray(value)) {
				normalized = [value];
			}
		}
		
		// steb 4 - expand entity names
		
		if (checkExpectsValue('Entity', key, context)) {
			for (var i = normalized.length - 1; i >= 0; i--) {
				if (typeof(normalized[i]) === 'string') {
					if (normalized[i]) {
						normalized[i] = {
							"type": "Person",
							"name": normalized[i]
						}
					}
					else {
						normalized.splice(i,1);
					}
				}
				else if (typeof(normalized[i]) !== 'object') {
					console.warn(key + 'requires a string or entity. Found ' + typeof(normalized[i]) + '. Removing from array.');
					normalized.splice(i,1);
				}
				else {
					if (normalized[i].hasOwnProperty('type')) {
						if (!checkHasType(normalized[i]['type'], 'Person') && !checkHasType(normalized[i]['type'], 'Organization')) {
							normalized[i]['type'].push('Person');
						}
					}
					else {
						normalized[i]['type'] = ['Person'];
					}
				}
			}
		}
		
		
		// step 5 - localizable strings
		
		if (checkExpectsValue('LocalizableString', key, context)) {
			for (var i = normalized.length - 1; i >= 0; i--) {
				var type = typeof(normalized[i]);
				if (type === 'string') {
					normalized[i] = {"value": normalized[i]};
					if (lang) {
						normalized[i]['language'] = lang;
					}
					if (dir) {
						normalized[i]['direction'] = dir;
					}
				}
				else if (Array.isArray(normalized[i]) || type !== 'object') {
					console.warn('Non-string value found in ' + key + '.');
					normalized.splice(i,1);
				}
				else {
					if (!normalized[i].hasOwnProperty('language') && lang) {
						normalized[i]['language'] = lang;
					}
					else {
						if (!normalized[i]['language']) {
							delete(normalized[i]['language']);
						}
					}
					if (!normalized[i].hasOwnProperty('direction') && dir) {
						normalized[i]['direction'] = dir;
					}
					else {
						if (!normalized[i]['direction']) {
							delete(normalized[i]['direction']);
						}
					}
				}
			}
		}
		
		// step 6 - convert strings to linkedresources
		
		if (checkExpectsValue('LinkedResource', key, context)) {
			for (var i = normalized.length - 1; i >= 0; i--) {
				var type = typeof(normalized[i]);
				if (type === 'string') {
					normalized[i] = {"type": ["LinkedResource"], "url": convertAbsoluteURL(normalized[i], base)};
				}
				else if (Array.isArray(normalized[i]) || type !== 'object') {
					console.warn(key + ' requires only strings or objects in its array. Found ' + type + '. Removing from array.');
					normalized.splice(i,1);
				}
				else {
					if (normalized[i].hasOwnProperty('type')) {
						if (!checkHasType(normalized[i]['type'], 'LinkedResource')) {
							normalized[i]['type'].push('LinkedResource');
						}
					}
					else {
						normalized[i]['type'] = ['LinkedResource'];
					}
				}
			}
		}
		
		// step 7 - convert relative URLs

		if (checkExpectsValue('URL', key, context)) {
			var type = typeof(normalized);
			
			if (type == 'string') {
				try {
					normalized = convertAbsoluteURL(normalized, base);
				}
				catch (e) {
					throw new Error();
				}
				
			}
			else if (Array.isArray(normalized)) {
				for (var i = normalized.length - 1; i >= 0; i--) {
					try {
						normalized[i] = convertAbsoluteURL(normalized[i], base);
					}
					catch (e) {
						normalized.splice(i,1);
					}
				}
			}
			else {
				console.warn('Invalid data type "' + type + '" for URL.');
				throw new Error();
			}
		};
		
		// step 8 - no extension steps
		
		// step 9 - recursively update values
		
		if (Array.isArray(normalized)) {
			for (var i = 0; i < normalized.length; i++) {
				if (typeof(normalized[i]) === 'object') {
					var obj_context = getContext(normalized[i]);
					for (var key in normalized[i]) {
						try {
							normalized[i][key] = normalizeData(key, normalized[i][key], lang, dir, base, obj_context);
						}
						catch(e) {
							delete(normalized[i][key]);
						}
					}
				}
			}
		}
		
		else if (typeof(normalize) === 'object') {
			var obj_context = getContext(normalized);
			for (var key in normalize) {
				try {
					normalized[key] = normalizeData(key, normalized[key], lang, dir, base, obj_context);
				}
				catch(e) {
					delete(normalized[key]);
				}
			}
		}
		
		// step 10 - set the updated value 
		
		return normalized;
	}
	
	
	function convertAbsoluteURL(data, base) {
		if (typeof(data) === 'string') {
			var url = new URL(data, base);
			return url.toString();
		}
		else {
			console.warn(key + ' requires a string. Found ' + type + '.');
			throw new Error();
		}
	}


	function dataValidation(data) {
		
		// step 1 - recursive validity checks
		
		for (var key in data) {
			try {
				data[key] = globalDataChecks(key, data[key], ''); 
			}
			catch (e) {
				delete(data[key]);
			}
		}
		
		// step 2 - profile extensions
		
		if (data['profile'] == 'https://www.w3.org/TR/audiobooks/') {
			
			// step 1 - default reading order
			
			if (!data.hasOwnProperty('readingOrder') || data['readingOrder'].length == 0) {
				console.error('Audbook must have a reading order');
				throw new Error();
			}
			
			// TODO - remove non-audio resources
			
			if (data['readingOrder'].length == 0) {
				console.error('Audbook must have a reading order');
				throw new Error();
			}
			
			
			// step 2 - publication type
			
			if (!data.hasOwnProperty('type') || data['type'].length == 0) {
				data['type'] = ['Audiobook'];
			}
			
			
			// step 3 - recommended properties
			
			if (!data.hasOwnProperty('abridged')) {
				console.warn('abridged is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('accessMode')) {
				console.warn('accessMode is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('accessModeSufficient')) {
				console.warn('accessModeSufficient is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('accessibilityFeature')) {
				console.warn('accessibilityFeature is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('accessibilityHazard')) {
				console.warn('accessibilityHazard is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('accessibilitySummary')) {
				console.warn('accessibilitySummary is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('url')) {
				console.warn('address is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('author')) {
				console.warn('author is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('dateModified')) {
				console.warn('dateModified is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('datePublished')) {
				console.warn('datePublished is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('duration')) {
				console.warn('duration is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('id')) {
				console.warn('id is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('inLanguage')) {
				console.warn('inLanguage is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('name')) {
				console.warn('name is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('readBy')) {
				console.warn('readBy is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('readingProgression')) {
				console.warn('readingProgression is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('resources')) {
				console.warn('resource is a recommended property for audiobooks.');
			}
			
			if (!data.hasOwnProperty('type')) {
				console.warn('type is a recommended property for audiobooks.');
			}
			
			// step 3 - recommended resources
			
			
			// step 4 - durations
			
			
			
		}
		
		// step 3 - check type is set
		
		if (!data.hasOwnProperty('type') || data['type'].length == 0) {
			console.warn('Publication type not set.');
			data['type'] = ['CreativeWork'];
		}
		
		// step 4 - validate accessModeSufficient itemlists
		
		if (data.hasOwnProperty('accessModeSufficient')) {
			for (var i = data['accessModeSufficient'].length - 1; i >= 0; i--) {
				if (!data['accessModeSufficient'][i].hasOwnProperty('type') || data['accessModeSufficient'][i]['type'] != 'ItemList') {
					console.warn('accessModeSufficient must only contain ItemList objects.');
					data['accessModeSufficient'].splice(i,1);
				}
			}
		}
		
		// step 5 - canonical id
		
		if (!data.hasOwnProperty('id') || !data['id']) {
			console.warn('A canonical identifier should be specified.');
		}
		
		// step 6 - valid duration
		
		if (data.hasOwnProperty('duration')) {
			if (!duration.test(data['duration'])) {
				console.warn('The duration must be a valid ISO 8601 duration.');
				delete(data['duration']);
			}
		}
		
		// step 7 - valid modification date
		
		if (data.hasOwnProperty('dateModified')) {
			if (!dateTime.test(data['dateModified'])) {
				console.warn('The last modified date must be a valid ISO 8601 dateTime.');
				delete(data['dateModified']);
			}
		}
		
		// step 8 - valid publication date

		if (data.hasOwnProperty('datePublished')) {
			if (!dateTime.test(data['datePublished'])) {
				console.warn('The publication date must be a valid ISO 8601 dateTime.');
				delete(data['datePublished']);
			}
		}
		
		// step 9 - well-formed languages
		
		if (data.hasOwnProperty('inLanguage')) {
			for (var i = data['inLanguage'].length - 1; i >= 0; i--) {
				if (!bcp47.test(data['inLanguage'][i])) {
					console.warn('The language tag "' + data['inLanguage'][i] + '" is not well formed.');
					data['inLanguage'].splice(i,1);
				}
			}
		}
		
		// step 10 - valid reading progression
		
		if (data.hasOwnProperty('readingProgression')) {
			if (data['readingProgression'] != 'ltr' && data['readingProgression'] != 'rtl') {
				console.warn('The reading progression must be "ltr" or "rtl".');
				data['readingProgression'] = 'ltr';
			}
		}
		else {
			data['readingProgression'] = 'ltr'
		}
		
		// step 11 - get list of unique URLs
		
		var readingOrderURLs = data.hasOwnProperty('readingOrder') ? getUniqueURLs(data['readingOrder']) : new Set();
		
		var resourcesURLs = data.hasOwnProperty('resources') ? getUniqueURLs(data['resources']) : new Set();
		
		data['uniqueResources'] =  union(readingOrderURLs, resourcesURLs);
		
		// step 12 - check links
		
		if (data['links']) {
			for (var i = data['links'].length - 1; i >= 0; i--) {
				var url = data['links'][i]['url'];
				if (data['uniqueResources'].has(url)) {
					console.warn('Linked resource ' + url + ' cannot also be publication resources.');
					data['links'].splice(i,1);
					continue;
				}
				if (data['links'][i].hasOwnProperty('rel')) {
					for (var j = 0; j < data['links'][i]['rel'].length; j++) {
						if (bodyRelValues.has(data['links'][i]['rel'][j])) {
							console.warn('Link relation ' + data['links'][i]['rel'][j] + ' cannot also be used in the links section.');
							data['links'].splice(i,1);
							break;
						}
					}
				}
			}
		}
		
		// step 13 - remove empty arrays
		
		for (var term in data) {
			try {
				data[term] = removeEmptyArrays(data[term]);
			}
			catch(e) {
				delete(data[term]);
			}
		}
		
		// step 14 - return data
		
		return data;
	}
	
		
	function globalDataChecks(term, value, context) {
		
		// step 1 - value category check 
		
		if (hasKnownValueCategory(term)) {
			try {
				value = verifyValueCategory(term, value, context);
			}
			catch (e) {
				throw new Error();
			}
		}
		
		else {
			return value;
		}
		
		
		// step 2 - recursively check value
		
		if (!Array.isArray(value) && typeof(value) === 'object') {
			
			var obj_context = getContext(value);
			
			if (obj_context) {
				for (var key in value) {
					try
					{
						value[key] = globalDataChecks(key, value[key], obj_context);
					}
					catch(e) {
						delete(value[key]);
					}
				}
			}
		}
		
		else if (Array.isArray(value)) {
			for (var i = 0; i < value.length; i++) {
				if (!Array.isArray(value[i]) && typeof(value[i]) === 'object') {
					var obj_context = getContext(value[i]);
					if (obj_context) {
						for (var key in value[i]) {
							try {
								value[i][key] = globalDataChecks(key, value[i][key], obj_context);
							}
							catch (e) {
								delete(value[i][key]);
							}
						}
					}
				}
			}
		}
		
		// step 3 - valid language and direction
		
		if (expectsLocalizableString.hasOwnProperty(term)) {
			for (var i = value.length - 1; i >= 0; i--) {
				if (!value[i].hasOwnProperty('value')) {
					value.splice(i,1);
				}
				
				if (value[i].hasOwnProperty('language')) {
					if (!bcp47.test(value[i]['language'])) {
						console.warn('Language tag is not well formed.');
						delete(value[i]['language']);
					}
				}
				if (value[i].hasOwnProperty('direction')) {
					if (value[i]['direction'] != 'ltr' && value[i]['direction'] != 'rtl') {
						console.warn('Direction must be "ltr" or "rtl".');
						delete(value[i]['direction']);
					}
				}
			} 
		}
		
		// step 4 - entity names
		
		if (expectsEntity.hasOwnProperty(term) && value.length > 0) {
			for (var i = value.length - 1; i >= 0; i--) {
				if (!value[i].hasOwnProperty('name') || value[i]['name'].length == 0) {
					console.warn('Item ' + i + ' in ' + term + ' does not have a name');
					value.splice(i,1);
				}
			}
		}
		
		// step 5 - linkedresources have url, duration and encodingFormat
		
		if (expectsLinkedResource.hasOwnProperty(term)) {
			
			for (var i = value.length - 1; i >= 0; i--) {
				
				// check urls
				if (!value[i].hasOwnProperty('url') || !value[i]['url']) {
					console.error('Resource does not have a url.');
					value.splice(i,1);
					continue;
				}
				else {
					var url = new URL(value[i]['url']);
					
					if (!url.host) {
						console.error('Resource has invalid url "' + value[i]['url'] + '".');
						value.splice(i,1);
						continue;
					}
				}
				
				// check durations
				if (value[i].hasOwnProperty('length')) {
					if (value[i]['length'] < 0) {
						console.error('Resource lengths cannot be negative numbers.');
						delete(value[i]['length']);
					}
				}
			}
		}
		
		// step 6 - return value
		
		return value;
	}
	
	
	function hasKnownValueCategory(key) {
		if (expectsObject.hasOwnProperty(key) 
		    || expectsEntity.hasOwnProperty(key)
		    || expectsLinkedResource.hasOwnProperty(key)
		    || expectsLocalizableString.hasOwnProperty(key)
		    || expectsLinkedResource.hasOwnProperty(key)
		    || expectsURL.hasOwnProperty(key)
		    || expectsLiteral.hasOwnProperty(key)
		    || expectsIdentifier.hasOwnProperty(key)
		    || expectsBoolean.hasOwnProperty(key)) {
			return true;
		}
		return false;
	}
	
	
	function verifyValueCategory(term, value, context) {
	
		// step 1 - check values in arrays
		
		if (checkExpectsArray(term, context)) {
			if (!Array.isArray(value)) {
				console.warn(term + ' requires an array of values.');
				throw new Error();
			}
			else {
				for (var i = value.length - 1; i >= 0; i--) {
					try {
						confirmCategory(term, value[i], '');
					}
					catch (e) {
						value.splice(i,1);
						continue;
					}
					
					if (!Array.isArray(value[i]) && typeof(value[i]) === 'object') {
						var obj_context = getContext(value[i]);
						for (var key in value[i]) {
							if (hasKnownValueCategory(key)) {
								try {
									value[i][key] = verifyValueCategory(key, value[i][key], obj_context);
								}
								catch (e) {
									console.warn(key + " in " + term + " has an invalid value.");
									delete(value[i][key]);
								}
							}
						}
					}
				}
				if (value.length == 0) {
					console.warn(term + ' is an empty array after processing.');
					throw new Error();
				}
			}
		}
		else if (expectsObject.hasOwnProperty(term) || 
				 expectsEntity.hasOwnProperty(term) || 
				 expectsLocalizableString.hasOwnProperty(term) || 
				 expectsLinkedResource.hasOwnProperty(term)) {
			
			if (typeof(processed[term]) !== 'object') {
				console.warn(term + ' requires an object.');
				throw new Error();
			}
			else {
				for (var key in value) {
					try {
						value[key] = verifyValueCategory(key, value[key], context);
					}
					catch (e) {
						console.warn(key + " of " + term + " has an invalid value.");
						delete(value[key]);
					}
				}
				if (value.keys().length == 0) {
					console.warn(term + ' is an empty object after processing.');
					throw new Error();
				}
			}
		}
		else {
			try {
				if (!confirmCategory(term, value, context)) {
					throw new Error();
				}
			}
			catch (e) {
				throw new Error();
			}
		}
		return value;
	}
	
	
	function confirmCategory(term, value, context) {
	
		var type = typeof(value);
		var expected_type = getExpectedType(term, context);
		
		if (expected_type == 'string' && type !== 'string') {
			console.warn(term + ' requires a literal.');
			throw new Error();
		}
		else if (expected_type == 'number' && type !== 'number') {
			console.warn(term + ' requires a number.');
			throw new Error();
		}
		else if (expected_type == 'boolean' && type !== 'boolean') {
			console.warn(term + ' requires a boolean.');
			throw new Error();
		}
		else if (expected_type == 'object' && type !== 'object') {
			console.warn(term + ' requires an object.');
			throw new Error();
		}
		
		return true;
	}
	
	
	
	function getExpectedType(term, context) {
		if (checkExpectsValue('Literal', term, context) || checkExpectsValue('Identifier', term, context) || checkExpectsValue('URL', term, context)) {
			return 'string';
		}
		else if (checkExpectsValue('Number', term, context)) {
			return 'number';
		}
		else if (checkExpectsValue('Boolean', term, context)) {
			return 'boolean';
		}
		else if (checkExpectsValue('LocalizableString', term, context) || checkExpectsValue('Entity', term, context) || checkExpectsValue('LinkedResource', term, context)) {
			return 'object';
		}
		return '';
	}
	
	
	
	function getUniqueURLs(resources) {
		
		// step 1 - new set
		
		var uniqueURLs = new Set();
		
		// step 2 - iterate urls and warn if duplicates
		
		for (var i = 0; i < resources.length; i++) {
			
			var url = resources[i]['url'].split('#')[0];
			
			if (uniqueURLs.has(url)) {
				console.warn('Duplicate resource ' + url + ' declared.')
			}
			else {
				uniqueURLs.add(url);
			}
			
			if (resources[i].hasOwnProperty('alternate')) {
				for (var j = 0; j < resources[i]['alternate'].length; j++) {
					var alt_url = resources[i]['alternate'][j];
					
					if (uniqueURLs.has(alt_url)) {
						console.warn('Duplicate alternate resource ' + url + ' declared.')
					}
					else {
						uniqueURLs.add(alt_url);
					}
				}
			}
		}
		
		// step 3 return unique urls
		
		return uniqueURLs;
	}
	
	
	function removeEmptyArrays(value) {
		if (Array.isArray(value)) {
			if (value.length == 0) {
				console.warn('Empty array.');
				throw new Error();
			}
			else {
				for (var i = 0; i < value.length; i++) {
					if (!Array.isArray(value[i]) && typeof(value[i]) === 'object') {
						for (var key in value[i]) {
							try {
								value[i][key] = removeEmptyArrays(value[i][key]);
							}
							catch(e) {
								delete(value[i][key]);
							}
						}
					}
				}
			}
		}
		else if (typeof(value) === 'object') {
			for (var key in value) {
				try {
					value[key] = removeEmptyArrays(value[key]);
				}
				catch(e) {
					delete(value[key]);
				}
			}
		}
		return value;
	}


	function addHTMLDefaults(processed, doc) {
		
		// add html title if name is missing
		
		if (!processed.hasOwnProperty('name')) {
		
			var title = doc.title;
			
			processed.name = {};
			
			if (title) {
				processed.name.value = title;
				if (doc.documentElement.lang) {
					processed.name.language = doc.documentElement.lang;
				}
				if (doc.dir && doc.dir != 'auto') {
					processed.name.direction = doc.dir;
				}
			}
			else {
				processed.name.value = 'Untitled Publication';
				processed.name.language = 'en';
				processed.name.direction = 'ltr';
			}
			
		}
		
		if (!processed.hasOwnProperty('readingOrder')) {
			if (doc.location.href) {
				processed.readingOrder = [{
					"url": doc.location.href
				}];
			}
			else {
				console.error('No reading order. Document URL could not be determined.');
				throw new Error();
			}
		}
		
		return processed;
	}
	
	
	function checkExpectsArray(term, context) {
		if (expectsArray.hasOwnProperty(term)) {
			for (var i = 0; i < expectsArray[term].length; i++) {
				if (expectsArray[term][i] == context) {
					return true;
				}
			}
		}
		return false;
	}
	
	
	
	function checkExpectsValue(category, term, context) {
		
		var contexts;
		
		switch (category) {
			case "Entity":
				contexts = expectsEntity.hasOwnProperty(term) ? expectsEntity[term] : null;
				break;
			case "LinkedResource":
				contexts = expectsLinkedResource.hasOwnProperty(term) ? expectsLinkedResource[term] : null;
				break;
			case "LocalizableString":
				contexts = expectsLocalizableString.hasOwnProperty(term) ? expectsLocalizableString[term] : null;
				break;
			case "URL":
				contexts = expectsURL.hasOwnProperty(term) ? expectsURL[term] : null;
				break;
			case "Literal":
				contexts = expectsLiteral.hasOwnProperty(term) ? expectsLiteral[term] : null;
				break;
			case "Boolean":
				contexts = expectsBoolean.hasOwnProperty(term) ? expectsBoolean[term] : null;
				break;
			case "Identifier":
				contexts = expectsIdentifier.hasOwnProperty(term) ? expectsIdentifier[term] : null;
				break;
			case "Number":
				contexts = expectsNumber.hasOwnProperty(term) ? expectsNumber[term] : null;
				break;
			case "Object":
				contexts = expectsObject.hasOwnProperty(term) ? expectsObject[term] : null;
				break;
			default:
				contexts = null;
		}
		
		if (contexts !== null) {
			for (var i = 0; i < contexts.length; i++) {
				if (contexts[i] == context) {
					return true;
				}
			}
		}
		
		return false;
	}
	
	
	function checkHasType(types, type) {
		for (var j = 0; j < types.length; j++) {
			if (types[j] == type) {
				return true;
			}
		}
		return false;
	}
	
	
	function getContext(value) {
		if (Array.isArray(value) || typeof(value) !== 'object') {
			return '';
		}
		if (value.hasOwnProperty('type')) {
			for (var k = 0; k < value['type'].length; k++) {
				if (value['type'][k] == 'Person' || value['type'][k] == 'Organization' || value['type'][k] == 'LinkedResource') {
					return value['type'][k];
				}
			}
		}
		return '';
	}
	
	
	


	return {
		processManifest: function(manifest_link) {
			return processManifest(manifest_link);
		},
		getInternalRepresentation() {
			return _internal_rep;
		}
	}

})();

	
	function union(setA, setB) {
		var _union = new Set(setA);
		for (var elem of setB) {
		    _union.add(elem);
		}
		return _union;
	}
