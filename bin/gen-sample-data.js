// Generate Sample Data
// Usage: node bin/gen-sample-data.js > conf/sample-data.json
// Then: node bin/storage-cli.js run conf/sample-data.json

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

var Tools = require('pixl-tools');
var Request = require('pixl-request');
var request = new Request();
request.setAutoError(true);

var data = {
	storage: []
};

request.json( 'https://random-data-api.com/api/company/random_company?size=100', null, function(err, resp, companies, perf) {
	var industries = {};
	var phrases = {};
	companies.forEach( function(company) {
		// console.log( company.industry );
		industries[ company.industry ] = 1;
		phrases[ company.catch_phrase ] = 1;
	} );
	industries = Object.keys(industries);
	phrases = Object.keys(phrases);
	
	// console.log( industries, phrases );
	
	for (var idx = 1; idx <= 10; idx++) {
		var now = Tools.timeNow(true) - Math.floor( Math.random() * 864000 );
		data.storage.push([ "listPush", "global/categories", {
			"id": "cat" + idx,
			"title": industries.shift(),
			"enabled": true,
			"sort_order": idx,
			"username": "admin",
			"modified": now,
			"created": now,
			"notes": "",
			"limits": [],
			"actions": []
		} ]);
	}
	
	for (var idx = 1, len = phrases.length; idx <= len; idx++) {
		var now = Tools.timeNow(true) - Math.floor( Math.random() * 864000 );
		var event = {
			"id": "event" + idx,
			"revision": 1,
			"title": phrases.shift(),
			"enabled": true,
			"username": "admin",
			"modified": now,
			"created": now,
			"category": 'cat' + Math.floor( (Math.random() * 10) + 1 ),
			"targets": ["main"],
			"algo": "random",
			"notes": "",
			"limits": [
				{
					"type": "job",
					"enabled": true,
					"amount": 1
				},
				{
					"type": "queue",
					"enabled": true,
					"amount": 0
				},
				{
					"type": "retry",
					"enabled": true,
					"amount": 0,
					"duration": 0
				}
			],
			"actions": [],
			"tags": []
		};
		
		// plugin & params
		switch (Math.floor(Math.random() * 3)) {
			case 0:
				event.plugin = 'shellplug';
				event.params = {
					script: "#!/bin/bash\n\nsleep " + Math.floor(Math.random() * 60) + ";\necho \"HELLO.\";\n",
					annotate: false,
					json: false
				};
			break;
			
			case 1:
				event.plugin = 'testplug';
				event.params = {
					duration: Math.floor(Math.random() * 60),
					action: 'Success',
					progress: true,
					burn: false,
					secret: 'foo'
				};
			break;
			
			case 2:
				event.plugin = 'httpplug';
				event.params = {
					method: 'GET',
					url: 'https://github.com/jhuckaby/performa-satellite/releases/latest/download/performa-satellite-linux-x64',
					headers: '',
					data: '',
					timeout: 30,
					success_match: '',
					error_match: '',
					follow: true,
					ssl_cert_bypass: false,
					download: true
				};
			break;
		}
		
		// triggers
		var dargs = Tools.getDateArgs( Tools.timeNow(true) + Math.floor( Math.random() * 86400 * 365 ) );
		switch (Math.floor(Math.random() * 7)) {
			case 0:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					years: [ dargs.year ],
					months: [ dargs.mon ],
					days: [ dargs.mday ],
					hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 1:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					// years: [ dargs.year ],
					months: [ dargs.mon ],
					days: [ dargs.mday ],
					hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 2:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					// years: [ dargs.year ],
					// months: [ dargs.mon ],
					days: [ dargs.mday ],
					hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 3:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					// years: [ dargs.year ],
					// months: [ dargs.mon ],
					// days: [ dargs.mday ],
					hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 4:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					// years: [ dargs.year ],
					// months: [ dargs.mon ],
					// days: [ dargs.mday ],
					// hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 5:
				event.triggers = [{
					type: 'schedule',
					enabled: true,
					// years: [ dargs.year ],
					// months: [ dargs.mon ],
					// days: [ dargs.mday ],
					weekdays: [ dargs.wday ],
					hours: [ dargs.hour ],
					minutes: [ dargs.min ]
				}];
			break;
			
			case 6:
				event.triggers = [{
					type: 'single',
					enabled: true,
					epoch: dargs.epoch
				}];
			break;
		}
		
		// if (Math.random() < 0.1) event.triggers.push({ type: 'catchup', enabled: true });
		
		data.storage.push([ "listPush", "global/events", event ]);
	}
	
	console.log( JSON.stringify(data, null, "\t") );
} );

