// xyOps Web App - Utils
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

function get_pretty_int_list(arr, ranges) {
	// compose int array to string using commas + spaces, and
	// the english "and" to group the final two elements.
	// also detect sequences and collapse those into dashed ranges
	if (!arr || !arr.length) return '';
	if (arr.length == 1) return arr[0].toString();
	arr = deep_copy_object(arr).sort( function(a, b) { return a - b; } );
	
	// check for ranges and collapse them
	if (ranges) {
		var groups = [];
		var group = [];
		for (var idx = 0, len = arr.length; idx < len; idx++) {
			var elem = arr[idx];
			if (!group.length || (elem == group[group.length - 1] + 1)) group.push(elem);
			else { groups.push(group); group = [elem]; }
		}
		if (group.length) groups.push(group);
		arr = [];
		for (var idx = 0, len = groups.length; idx < len; idx++) {
			var group = groups[idx];
			if (group.length == 1) arr.push( group[0] );
			else if (group.length == 2) {
				arr.push( group[0] );
				arr.push( group[1] );
			}
			else {
				arr.push( group[0] + ' - ' + group[group.length - 1] );
			}
		}
	} // ranges
	
	if (arr.length == 1) return arr[0].toString();
	return arr.slice(0, arr.length - 1).join(', ') + ' and ' + arr[ arr.length - 1 ];
}

function get_pretty_str_list(arr) {
	// compose string array to string using commas + spaces, and
	// the english "and" to group the final two elements
	if (!arr || !arr.length) return '';
	if (arr.length == 1) return arr[0].toString();
	return arr.slice(0, arr.length - 1).join(', ') + ' and ' + arr[ arr.length - 1 ];
}

function format_ordinal(num) {
	// keep English ordinal suffixes, but localize digits
	var date_opts = app.getDateOptions();
	var num_fmt = new Intl.NumberFormat(date_opts.locale, { useGrouping: false, numberingSystem: date_opts.numberingSystem });
	var suffix = 'th';
	if ((num % 100 < 11) || (num % 100 > 13)) {
		switch (num % 10) {
			case 1: suffix = 'st'; break;
			case 2: suffix = 'nd'; break;
			case 3: suffix = 'rd'; break;
		}
	}
	return num_fmt.format(num) + suffix;
};

function summarize_event_timings(event) {
	// summarize all event triggers from event into human-readable string
	// separate schedule items and options
	var triggers = event.triggers.filter( function(trigger) { return trigger.enabled; } );
	var schedules = triggers.filter( function(trigger) { return !!(trigger.type || '').match(/^(schedule|interval|single|startup|magic|keyboard|activity)$/); } );
	var parts = (schedules.length == 1) ? [summarize_event_timing(schedules[0])] : schedules.map( summarize_event_timing );
	if (!parts.length) {
		if (find_object(triggers, { type: 'manual', enabled: true })) return "On Demand";
		else return "Disabled";
	}
	var summary = (parts.length == 1) ? parts[0] : (parts.slice(0, parts.length - 1).join(', ') + ', and ' + parts[ parts.length - 1 ]);
	
	var opts = [];
	triggers.forEach( function(trigger) {
		switch (trigger.type) {
			case 'catchup': opts.push("Catch-Up"); break;
			case 'nth': 
				if (trigger.every > 1) opts.push("Every " + format_ordinal(trigger.every)); 
			break;
			case 'range': opts.push("Date Range"); break;
			case 'blackout': opts.push("Blackout"); break;
			case 'delay': opts.push("Delay"); break;
			case 'precision': opts.push("Precision"); break;
			case 'quiet': opts.push("Quiet"); break;
			case 'plugin':
				var plugin = find_object( app.plugins, { id: trigger.plugin_id } );
				if (plugin) opts.push(plugin.title);
				else opts.push("Plugin");
			break;
		}
	} );
	var unique_opts = [...new Set(opts)];
	if (unique_opts.length) summary += ' (' + unique_opts.join(', ') + ')';
	
	return summary;
}

function summarize_event_timing(trigger, idx) {
	// summarize event trigger into human-readable string
	if (trigger.type == 'startup') return "On Startup";
	if (trigger.type == 'plugin') return "Plugin";
	if (trigger.type == 'magic') return "Magic";
	if (trigger.type == 'keyboard') return "Keyboard";
	if (trigger.type == 'activity') return "Activity";
	if (trigger.type == 'single') {
		var text = app.formatDate(trigger.epoch, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
		return text;
	} // single shot
	
	if (trigger.type == 'interval') {
		return "Every " + get_text_from_seconds(trigger.duration, false, false);
	}
	
	// years
	var year_str = '';
	var date_opts = app.getDateOptions({ timeZone: 'UTC' });
	var locale = date_opts.locale;
	var lang = (locale || '').split(/\-/)[0];
	var is_english = (lang == 'en');
	var numbering = date_opts.numberingSystem;
	
	function build_formatter(extra) {
		var opts = Object.assign({}, date_opts, extra);
		var loc = opts.locale;
		delete opts.locale;
		return new Intl.DateTimeFormat(loc, opts);
	}
	var month_fmt = build_formatter({ month: 'long' });
	var wday_fmt = build_formatter({ weekday: 'long' });
	var hour_fmt = build_formatter({ hour: 'numeric' });
	var hm_fmt = build_formatter({ hour: 'numeric', minute: '2-digit' });
	var num_fmt = new Intl.NumberFormat(locale, { useGrouping: false, numberingSystem: numbering });
	var num2_fmt = new Intl.NumberFormat(locale, { useGrouping: false, numberingSystem: numbering, minimumIntegerDigits: 2 });
	
	function format_number(num, min_digits) {
		return (min_digits ? num2_fmt : num_fmt).format(num);
	}
	function format_ord(num) {
		// keep English ordinal suffixes, but localize digits
		var suffix = 'th';
		if ((num % 100 < 11) || (num % 100 > 13)) {
			switch (num % 10) {
				case 1: suffix = 'st'; break;
				case 2: suffix = 'nd'; break;
				case 3: suffix = 'rd'; break;
			}
		}
		return format_number(num) + suffix;
	}
	function format_month_name(num) {
		return month_fmt.format( new Date(Date.UTC(2020, num - 1, 1)) );
	}
	function format_weekday_name(num) {
		return wday_fmt.format( new Date(Date.UTC(2020, 7, 2 + num)) );
	}
	function normalize_time_label(text) {
		if (!is_english) return text;
		return text.replace(/\s+/g, '').replace(/am|pm/i, function(m_all) { return m_all.toLowerCase(); });
	}
	function format_hour_name(num) {
		return normalize_time_label( hour_fmt.format( new Date(Date.UTC(2020, 0, 1, num, 0)) ) );
	}
	function format_time_name(hour, minute) {
		return normalize_time_label( hm_fmt.format( new Date(Date.UTC(2020, 0, 1, hour, minute)) ) );
	}
	function format_weekday_label(num) {
		var name = format_weekday_name(num);
		return is_english ? (name + 's') : name;
	}
	function format_month_day(num) {
		if (num < 0) {
			if (num == -1) return 'last day';
			return format_ord(Math.abs(num)) + ' last day';
		}
		return format_ord(num);
	}
	function format_minute_label(num) {
		if (num == 0) return 'hour';
		if (num == 30) return 'half-hour';
		return ':' + format_number(num, 2);
	}
	
	if (trigger.years && trigger.years.length) {
		year_str = get_pretty_int_list(trigger.years, true).replace(/(\d+)/g, function(m_all, m_g1) {
			return format_number( parseInt(m_g1) );
		});
	}
	
	// months
	var mon_str = '';
	if (trigger.months && trigger.months.length) {
		mon_str = get_pretty_int_list(trigger.months, true).replace(/(\d+)/g, function(m_all, m_g1) {
			return format_month_name( parseInt(m_g1) );
		});
	}
	
	// days
	var mday_str = '';
	if (trigger.days && trigger.days.length) {
		mday_str = get_pretty_int_list(trigger.days, true).replace(/(\-?\d+)/g, function(m_all, m_g1) {
			return format_month_day( parseInt(m_g1) );
		});
	}
	
	// weekdays	
	var wday_str = '';
	if (trigger.weekdays && trigger.weekdays.length) {
		var wdays = deep_copy_object(trigger.weekdays).sort( function(a, b) { return a - b; } );
		if ((wdays.length == 5) && (wdays[0] == 1) && (wdays[4] == 5)) {
			wday_str = 'weekdays';
		}
		else {
			wday_str = get_pretty_int_list(wdays, true).replace(/(\d+)/g, function(m_all, m_g1) {
				return format_weekday_label( parseInt(m_g1) );
			});
		}
	}
	
	// hours
	var hour_str = '';
	if (trigger.hours && trigger.hours.length) {
		hour_str = get_pretty_int_list(trigger.hours, true).replace(/(\d+)/g, function(m_all, m_g1) {
			return format_hour_name( parseInt(m_g1) );
		});
	}
	
	// minutes
	var min_str = '';
	if (trigger.minutes && trigger.minutes.length) {
		var mins = deep_copy_object(trigger.minutes).sort( function(a, b) { return a - b; } );
		min_str = get_pretty_str_list( mins.map( function(min) { return format_minute_label(min); } ) );
	}
	
	// construct final string
	var groups = [];
	var mday_compressed = false;
	
	if (year_str) {
		groups.push( 'in ' + year_str );
		if (mon_str) groups.push( mon_str );
	}
	else if (mon_str) {
		// compress single month + single day
		if (trigger.months && trigger.months.length == 1 && trigger.days && trigger.days.length == 1) {
			groups.push( 'on ' + mon_str + ' ' + mday_str );
			mday_compressed = true;
		}
		else {
			groups.push( 'in ' + mon_str );
		}
	}
	
	if (mday_str && !mday_compressed) {
		if (mon_str || wday_str) groups.push( 'on the ' + mday_str );
		else groups.push( 'monthly on the ' + mday_str );
	}
	if (wday_str) groups.push( 'on ' + wday_str );
	
	// compress single hour + single minute
	if (trigger.hours && trigger.hours.length == 1 && trigger.minutes && trigger.minutes.length == 1) {
		var new_str = format_time_name(trigger.hours[0], trigger.minutes[0]);
		
		if (mday_str || wday_str) groups.push( 'at ' + new_str );
		else groups.push( 'daily at ' + new_str );
	}
	else {
		var min_added = false;
		if (hour_str) {
			if (mday_str || wday_str) groups.push( 'at ' + hour_str );
			else groups.push( 'daily at ' + hour_str );
		}
		else {
			// check for repeating minute pattern
			if (trigger.minutes && trigger.minutes.length) {
				var interval = detect_num_interval( trigger.minutes, 60 );
				if (interval) {
					var new_str = 'every ' + interval + ' minutes';
					if (trigger.minutes[0] > 0) {
						new_str += ' starting on the :' + format_number(trigger.minutes[0], 2);
					}
					groups.push( new_str );
					min_added = true;
				}
			}
			
			if (!min_added) {
				if (min_str) groups.push( 'hourly' );
			}
		}
		
		if (!min_added) {
			if (min_str) groups.push( 'on the ' + min_str );
			else groups.push( 'every minute' );
		}
	}
	
	var text = (typeof(idx) != 'undefined') ? groups.join(' ') : groups.join(', ');
	var output = text;
	if (!idx) output = text.substring(0, 1).toUpperCase() + text.substring(1, text.length);
	var timing_tz = trigger.timezone || app.config.tz;
	var user_tz = (app.user && app.user.timezone) ? app.user.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (timing_tz && user_tz && (timing_tz != user_tz)) output += ' (' + timing_tz + ')';
	
	return output;
};

function detect_num_interval(arr, max) {
	// detect interval between array elements, return if found
	// all elements must have same interval between them
	if (arr.length < 2) return false;
	// if (arr[0] > 0) return false;
	
	var interval = arr[1] - arr[0];
	for (var idx = 1, len = arr.length; idx < len; idx++) {
		var temp = arr[idx] - arr[idx - 1];
		if (temp != interval) return false;
	}
	
	// if max is provided, final element + interval must equal max
	// if (max && (arr[arr.length - 1] + interval != max)) return false;
	if (max && ((arr[arr.length - 1] + interval) % max != arr[0])) return false;
	
	return interval;
};

// Crontab Parsing Tools
// by Joseph Huckaby, (c) 2015, BSD 3-Clause License

var cron_aliases = {
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	may: 5,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	oct: 10,
	nov: 11,
	dec: 12,
	
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6
};
var cron_alias_re = new RegExp("\\b(" + hash_keys_to_array(cron_aliases).join('|') + ")\\b", "g");

function string_hash(str) {
	// DJB2 algorithm
	var hash = 5381, i = str.length;
	while (i) { hash = (hash * 33) ^ str.charCodeAt(--i); }
	return hash >>> 0;
};

function parse_crontab_part(trigger, raw, key, min, max, rand_seed) {
	// parse one crontab part, e.g. 1,2,3,5,20-25,30-35,59
	// can contain single number, and/or list and/or ranges and/or these things: */5 or 10-50/5
	if (raw == '*') { return; } // wildcard
	if (raw == 'h') {
		// unique value over accepted range, but locked to random seed
		// https://github.com/jhuckaby/Cronicle/issues/6
		raw = min + (string_hash(rand_seed) % ((max - min) + 1));
		raw = '' + raw;
	}
	if (!raw.match(/^[\w\-\,\/\*]+$/)) { throw new Error("Invalid crontab format: " + raw); }
	var values = {};
	var bits = raw.split(/\,/);
	
	for (var idx = 0, len = bits.length; idx < len; idx++) {
		var bit = bits[idx];
		if (bit.match(/^\d+$/)) {
			// simple number, easy
			values[bit] = 1;
		}
		else if (bit.match(/^(\d+)\-(\d+)$/)) {
			// simple range, e.g. 25-30
			var start = parseInt( RegExp.$1 );
			var end = parseInt( RegExp.$2 );
			for (var idy = start; idy <= end; idy++) { values[idy] = 1; }
		}
		else if (bit.match(/^\*\/(\d+)$/)) {
			// simple step interval, e.g. */5
			var step = parseInt( RegExp.$1 );
			var start = min;
			var end = max;
			for (var idy = start; idy <= end; idy += step) { values[idy] = 1; }
		}
		else if (bit.match(/^(\d+)\-(\d+)\/(\d+)$/)) {
			// range step inverval, e.g. 1-31/5
			var start = parseInt( RegExp.$1 );
			var end = parseInt( RegExp.$2 );
			var step = parseInt( RegExp.$3 );
			for (var idy = start; idy <= end; idy += step) { values[idy] = 1; }
		}
		else {
			throw new Error("Invalid crontab format: " + bit + " (" + raw + ")");
		}
	}
	
	// min max
	var to_add = {};
	var to_del = {};
	for (var value in values) {
		value = parseInt( value );
		if (value < min) {
			to_del[value] = 1;
			to_add[min] = 1;
		}
		else if (value > max) {
			to_del[value] = 1;
			value -= min;
			value = value % ((max - min) + 1); // max is inclusive
			value += min;
			to_add[value] = 1;
		}
	}
	for (var value in to_del) delete values[value];
	for (var value in to_add) values[value] = 1;
	
	// convert to sorted array
	var list = hash_keys_to_array(values);
	for (var idx = 0, len = list.length; idx < len; idx++) {
		list[idx] = parseInt( list[idx] );
	}
	list = list.sort( function(a, b) { return a - b; } );
	if (list.length) trigger[key] = list;
};

function parse_crontab(raw, rand_seed) {
	// parse standard crontab syntax, return trigger object
	// e.g. 1,2,3,5,20-25,30-35,59 23 31 12 * *
	// optional 6th element == years
	if (!rand_seed) rand_seed = get_unique_id();
	var trigger = {};
	
	// resolve all @shortcuts
	raw = trim(raw).toLowerCase();
	if (raw.match(/\@(yearly|annually)/)) raw = '0 0 1 1 *';
	else if (raw == '@monthly') raw = '0 0 1 * *';
	else if (raw == '@weekly') raw = '0 0 * * 0';
	else if (raw == '@daily') raw = '0 0 * * *';
	else if (raw == '@hourly') raw = '0 * * * *';
	
	// expand all month/wday aliases
	raw = raw.replace(cron_alias_re, function(m_all, m_g1) {
		return cron_aliases[m_g1];
	} );
	
	// at this point string should not contain any alpha characters or '@', except for 'h'
	if (raw.match(/([a-gi-z\@]+)/i)) throw new Error("Invalid crontab keyword: " + RegExp.$1);
	
	// split into parts
	var parts = raw.split(/\s+/);
	if (parts.length > 6) throw new Error("Invalid crontab format: " + parts.slice(6).join(' '));
	if (!parts[0].length) throw new Error("Invalid crontab format");
	
	// parse each part
	if ((parts.length > 0) && parts[0].length) parse_crontab_part( trigger, parts[0], 'minutes', 0, 59, rand_seed );
	if ((parts.length > 1) && parts[1].length) parse_crontab_part( trigger, parts[1], 'hours', 0, 23, rand_seed );
	if ((parts.length > 2) && parts[2].length) parse_crontab_part( trigger, parts[2], 'days', 1, 31, rand_seed );
	if ((parts.length > 3) && parts[3].length) parse_crontab_part( trigger, parts[3], 'months', 1, 12, rand_seed );
	if ((parts.length > 4) && parts[4].length) parse_crontab_part( trigger, parts[4], 'weekdays', 0, 6, rand_seed );
	if ((parts.length > 5) && parts[5].length) parse_crontab_part( trigger, parts[5], 'years', 1970, 3000, rand_seed );
	
	return trigger;
};

function distance(a, b) {
	// get distance between two points in 2d space
	if ((a[0] == b[0]) && (a[1] == b[1])) return 0;
	return Math.sqrt( Math.pow(Math.abs(b[0] - a[0]), 2) + Math.pow(Math.abs(b[1] - a[1]), 2) );
};

function gen_workflow_id(prefix) {
	// generate short unique ID for workflow nodes
	return get_short_id(prefix, 7);
};

function interval_hits_per_minute(trigger, epoch) {
	// calculate when an interval should hit in the current minute (epoch)
	// return an array of second offsets, similar to precision.seconds
	// trigger: { start, duration }
	if (trigger.start > epoch) return []; // trigger starts in future
	
	var first_idx = Math.ceil((epoch - trigger.start) / trigger.duration);
	var first_hit = trigger.start + first_idx * trigger.duration;
	var hits = [];
	
	for (var t = first_hit; t < epoch + 60; t += trigger.duration) {
		if (t >= epoch) hits.push(t - epoch);
	}
	
	return hits;
};

function always_string(thing) {
	// convert thing to string -- if array, grab first element
	return Array.isArray(thing) ? String(thing[0]) : String(thing);
}

function renderMarkdownText(text, inline = false) {
	// Render user-authored Markdown without stripping comparisons or code samples.
	// Keep this scoped to text-only Markdown fields; other viewers allow HTML.
	if (text == null) return '';
	
	var options = { ...config.ui.marked_config };
	var renderer = Object.create(options.renderer || marked.defaults.renderer || new marked.Renderer());
	
	// Escape HTML tokens after Markdown parsing, so blockquotes, autolinks and
	// code spans retain their normal meaning.  Raw HTML blocks remain visible.
	renderer.html = function(html) {
		return encode_entities(html);
	};
	
	// Marked may emit unescaped text while inside inline <script>/<code> tags.
	// Escape brackets here too, preserving entities already produced by Marked.
	renderer.text = function(text) {
		return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	};
	
	// Use Marked's built-in URL filtering and attribute rendering for links and
	// images, without enabling its deprecated whole-document HTML sanitizer.
	// The existing app link renderer does not perform this URL filtering.
	var url_renderer = new marked.Renderer({ ...options, sanitize: true });
	renderer.link = function(href, title, text) {
		var html = url_renderer.link(href, title, text);
		
		// Preserve the app's external-link styling after the URL has been checked.
		if ((html != text) && href.match(/^\w+\:\/\//) && !text.match(/<.+>/)) {
			html = html.replace(/^<a /, '<a target="_blank" ')
				.replace(/<\/a>$/, '<i style="padding-left:3px" class="mdi mdi-open-in-new"></i></a>');
		}
		return html;
	};
	renderer.image = function(href, title, text) {
		return url_renderer.image(href, title, text);
	};
	
	// Inherit the configured checkbox and blocknote renderers without changing
	// global Marked defaults or sharing this renderer's options with other calls.
	options.renderer = renderer;
	return inline ? marked.parseInline(String(text), options) : marked.parse(String(text), options);
}

CodeMirror.defineMode("mustache", function(config, parserConfig) {
	// define custom mode for double-curly-brace "mustache" syntax to use as overlay
	var mustacheOverlay = {
		token: function(stream, state) {
			var ch;
			if (stream.match("{{")) {
				while ((ch = stream.next()) != null)
					if (ch == "}" && stream.next() == "}") {
						stream.eat("}");
						return "mustache";
					}
			}
			while (stream.next() != null && !stream.match("{{", false)) {}
			return null;
		}
	};
	return CodeMirror.overlayMode(CodeMirror.getMode(config, parserConfig.backdrop || "text/html"), mustacheOverlay);
});

$.fn.buttonize = function(sel) {
	// convenience buttonizer for jquery
	app.buttonize(this, sel);
};
