// User Page -- My Settings

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.MySettings = class MySettings extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('Preferences');
		app.setHeaderTitle( '<i class="mdi mdi-settings">&nbsp;</i>User Settings' );
		app.showSidebar(true);
		
		this.receiveUser({ user: app.user });
		return true;
	}
	
	receiveUser(resp) {
		var self = this;
		var html = '';
		var user = resp.user;
		
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var lang = ropts.locale.match(/\-/) ? ropts.locale.split(/\-/).shift() : ropts.locale.toLowerCase();
		var reg = ropts.locale.match(/\-/) ? ropts.locale.split(/\-/).pop() : ropts.locale.toUpperCase();
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Localization Settings';
			html += '<div class="button right phone_collapse" onClick="$P().reset_loc()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
		html += '</div>';
		html += '<div class="box_content" style="margin-bottom:30px">';
		
		// Language
		var langs = [
			['', "Auto-Detect (" + this.getNiceLanguage(lang) + ")"]
		].concat(app.config.intl.languages);
		
		html += this.getFormRow({
			label: 'Language:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_language',
				title: 'Select Language',
				options: langs,
				value: user.language || '',
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Select your desired language for localizing dates and times.'
		});
		
		// Region
		var regs = [
			['', "Auto-Detect (" + this.getNiceRegion(reg) + ")"]
		].concat(app.config.intl.regions);
		
		html += this.getFormRow({
			label: 'Region:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_region',
				title: 'Select Region',
				options: regs,
				value: user.region || '',
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Select your desired region for localizing dates and times.'
		});
		
		// Timezone
		var zones = [
			['', "Auto-Detect (" + ropts.timeZone + ")"]
		].concat(app.config.intl.timezones);
		
		html += this.getFormRow({
			label: 'Timezone:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_tz',
				title: 'Select Timezone',
				options: zones,
				value: user.timezone || '',
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Select your desired timezone for date and time display.'
		});
		
		// Number Format
		var nums = [
			['', "Auto-Detect (" + this.getNiceNumberingSystem(ropts.numberingSystem) + ")"]
		].concat(app.config.intl.numberingSystems);
		
		html += this.getFormRow({
			label: 'Number Format:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_numformat',
				title: 'Select Format',
				options: nums,
				value: user.num_format || '',
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Select your desired numbering format for displaying digits in dates and times.'
		});
		
		// 12 hour 24 hour?
		html += this.getFormRow({
			label: 'Hour Cycle:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_hrcycle',
				title: 'Select Hour Cycle',
				options: app.config.intl.hourCycles,
				value: user.hour_cycle || '',
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Select your desired hour cycle format for displaying hours of the day.'
		});
		
		// milliseconds
		html += this.getFormRow({
			label: 'Precision:',
			content: this.getFormCheckbox({
				id: 'fe_ms_milliseconds',
				label: 'Show Milliseconds',
				checked: !!user.milliseconds,
				onChange: '$P().update_date_time_preview(true)'
			}),
			caption: 'Enable or disable millisecond precision when showing dates/times (when available).'
		});
		
		// preview
		html += this.getFormRow({
			label: 'Preview:',
			content: '<div id="d_ms_dt_preview" style="font-weight:bold"></div>',
			caption: 'This is how the date & time will be formatted using the current settings.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		// html += '<div class="box_buttons">';
		// 	html += '<div class="button primary" onClick="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		// html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'User Interface Settings';
			html += '<div class="button right phone_collapse" onClick="$P().reset_ui()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
		html += '</div>';
		html += '<div class="box_content" style="margin-bottom:30px">';
		
		// motion preference
		html += this.getFormRow({
			label: 'Motion:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_motionacc',
				title: 'Select Motion Preference',
				options: [ 
					{ id: 'auto', title: 'Auto (System)', icon: 'creation' }, 
					{ id: 'full', title: 'Full Motion', icon: 'run-fast' }, 
					{ id: 'reduced', title: 'Reduced Motion', icon: 'walk' } 
				],
				value: user.motion || 'auto',
				onChange: '$P().saveChanges()'
			}),
			caption: 'Select your desired preference for motion.  Reduced motion disables certain animations which may be sensitive to some people.'
		});
		
		// contrast preference
		html += this.getFormRow({
			label: 'Contrast:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_contrastacc',
				title: 'Select Contrast Level',
				options: [ 
					{ id: 'auto', title: 'Auto (System)', icon: 'creation' }, 
					{ id: 'low', title: 'Low Contrast', icon: 'circle' },
					{ id: 'normal', title: 'Normal Contrast', icon: 'circle-half-full' }, 
					{ id: 'high', title: 'High Contrast', icon: 'circle-outline' },
				],
				value: user.contrast || 'auto',
				onChange: '$P().previewContrastMode(this)'
			}),
			caption: 'Select your desired preference for contrast.  This affects the brightness range between the text and background colors.'
		});
		
		// color acc mode
		html += this.getFormRow({
			label: 'Vision:',
			content: this.getFormCheckbox({
				id: 'fe_ms_coloracc',
				label: 'Color Accessibility Mode',
				checked: !!user.color_acc,
				onChange: '$P().previewColorMode(this)'
			}),
			caption: 'Enable or disable color assistance, which uses indicators other than color for differentiation.'
		});
		
		// show page descriptions
		html += this.getFormRow({
			label: 'Assistance:',
			content: this.getFormCheckbox({
				id: 'fe_ms_pageinfo',
				label: 'Show Page Descriptions',
				checked: !!user.page_info,
				onChange: '$P().saveChanges()'
			}),
			caption: 'Enable or disable page descriptions, which introduce each page in the app.  This can be helpful for new users.'
		});
		
		// notifications
		html += this.getFormRow({
			label: 'Notifications:',
			content: this.getFormCheckbox({
				id: 'fe_ms_notify',
				label: 'Use System Notifications',
				checked: user.notifications,
				disabled: !app.secure,
				onChange: '$P().saveChanges()'
			}),
			caption: 'Enable or disable system notifications, for custom channel messages' + (app.secure ? '' : ' (requires SSL)') + '.'
		});
		
		// whimsy (effects)
		html += this.getFormRow({
			label: 'Whimsy:',
			content: this.getFormCheckbox({
				id: 'fe_ms_effects',
				label: 'Visual Effects',
				checked: !!user.effects,
				onChange: '$P().previewVisualEffects(this)'
			}),
			caption: 'Who doesn\'t need a little whimsy in their life?  This adds playful animations for certain app events.'
		});
		
		// privacy mode
		html += this.getFormRow({
			label: 'Privacy:',
			content: this.getFormCheckbox({
				id: 'fe_ms_privacy',
				label: 'Streamer Mode',
				checked: !!user.privacy_mode,
				onChange: '$P().previewPrivacyMode(this)'
			}),
			caption: 'Enable or disable streamer mode, which hides sensitive information such as IP addresses, hostnames, usernames, full names, and email addresses.',
			'data-private': ''
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		// html += '<div class="box_buttons">';
		// 	html += '<div class="button primary" onClick="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		// html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		// a/v settings
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Audio / Visual Adjustments';
			html += '<div class="button right phone_collapse" onClick="$P().reset_av()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
			html += '<div class="box_subtitle" style="font-style:italic; color:var(--label-color)">(Press &ldquo;Escape&rdquo; key to reset these.)</div>';
		html += '</div>';
		html += '<div class="box_content" style="margin-bottom:30px">';
		
		// sound volume
		html += this.getFormRow({
			label: 'Sound Volume:',
			content: this.getFormRange({
				id: 'fe_ms_volume',
				min: 0,
				max: 10,
				step: 1,
				value: user.volume || 0,
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-play-circle-outline" title="Preview Volume..." onClick="$P().playPreviewSound()" onMouseDown="event.preventDefault();"></div>',
			// caption: 'Select your desired audio volume level for app notifications.'
		});
		
		// brightness
		html += this.getFormRow({
			label: 'Brightness:',
			content: this.getFormRange({
				id: 'fe_ms_brightness',
				min: 0,
				max: 200,
				step: 1,
				value: user.filters.brightness || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol">%</div>',
		});
		
		// contrast
		html += this.getFormRow({
			label: 'Contrast:',
			content: this.getFormRange({
				id: 'fe_ms_contrast',
				min: 0,
				max: 200,
				step: 1,
				value: user.filters.contrast || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol">%</div>',
		});
		
		// hue
		html += this.getFormRow({
			label: 'Hue:',
			content: this.getFormRange({
				id: 'fe_ms_hue',
				min: -180,
				max: 180,
				step: 1,
				value: user.filters.hue || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol"><i class="mdi mdi-triangle-outline"></i></div>',
		});
		
		// saturation
		html += this.getFormRow({
			label: 'Saturation:',
			content: this.getFormRange({
				id: 'fe_ms_saturation',
				min: 0,
				max: 200,
				step: 1,
				value: user.filters.saturation || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol">%</div>',
		});
		
		// sepia
		html += this.getFormRow({
			label: 'Sepia:',
			content: this.getFormRange({
				id: 'fe_ms_sepia',
				min: 0,
				max: 100,
				step: 1,
				value: user.filters.sepia || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol">%</div>',
		});
		
		// grayscale
		html += this.getFormRow({
			label: 'Grayscale:',
			content: this.getFormRange({
				id: 'fe_ms_grayscale',
				min: 0,
				max: 100,
				step: 1,
				value: user.filters.grayscale || 0,
				onInput: '$P().previewFilters()',
				onChange: '$P().saveChanges()'
			}),
			suffix: '<div class="form_suffix_symbol">%</div>',
		});
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		// hot keys
		html += '<div class="box" id="d_hot_keys">';
			html += '<div class="box_title">';
				html += '<span>Keyboard Shortcuts</span>';
				html += '<div class="button right phone_collapse" onClick="$P().reset_keys()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
			html += '</div>';
			html += '<div class="box_content table">';
				html += this.getHotKeyTable();
			html += '</div>'; // box_content
		html += '</div>'; // box
		
		// admin section
		if (app.isAdmin()) {
			html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Administrator Settings';
				html += '<div class="button right phone_collapse" onClick="$P().reset_admin()"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
			html += '</div>';
			html += '<div class="box_content" style="margin-bottom:30px">';
			
			html += this.getFormRow({
				label: 'System Events:',
				content: this.getFormCheckbox({
					id: 'fe_ms_admin_notify_sys',
					label: 'Show Notifications for System Events',
					checked: !user.admin_hide_notify_sys,
					onChange: '$P().saveChanges()'
				}),
				caption: 'Check this box to show notifications for system activity, such as servers connecting or disconnecting.'
			});
			
			html += this.getFormRow({
				label: 'User Events:',
				content: this.getFormCheckbox({
					id: 'fe_ms_admin_notify_user',
					label: 'Show Notifications for User Events',
					checked: !user.admin_hide_notify_user,
					onChange: '$P().saveChanges()'
				}),
				caption: 'Check this box to show notifications for user activity, including every time a user makes a change.'
			});
			
			html += '</div>'; // box_content
			html += '</div>'; // box
		} // admin
		
		this.div.html( html ).buttonize();
		SingleSelect.init( this.div.find('#fe_ms_language, #fe_ms_region, #fe_ms_tz, #fe_ms_numformat, #fe_ms_hrcycle, #fe_ms_motionacc, #fe_ms_contrastacc') );
		this.update_date_time_preview();
	}
	
	previewContrastMode(elem) {
		// set local mode on change
		app.user.contrast = $(elem).val();
		app.updateAccessibility();
		this.saveChanges();
	}
	
	previewColorMode(elem) {
		// set local mode on change
		app.user.color_acc = $(elem).is(':checked');
		app.updateAccessibility();
		this.saveChanges();
	}
	
	previewPrivacyMode(elem) {
		// set local mode on change
		app.user.privacy_mode = $(elem).is(':checked');
		app.updateAccessibility();
		this.saveChanges();
	}
	
	previewVisualEffects(elem) {
		// preview fireworks if checkbox is checked
		app.user.effects = $(elem).is(':checked');
		app.confetti({
			particleCount: 150,
			origin: elem
		});
		this.saveChanges();
	}
	
	playPreviewSound() {
		// play preview sound at new volume level (unless zero)
		var volume = parseInt( this.div.find('#fe_ms_volume').val() );
		if (volume > 0) app.playSound( rand_array(app.sounds), volume);
	}
	
	previewFilters() {
		// preview page backdrop filters
		var filters = app.user.filters;
		filters.brightness = parseInt( this.div.find('#fe_ms_brightness').val() );
		filters.contrast = parseInt( this.div.find('#fe_ms_contrast').val() );
		filters.hue = parseInt( this.div.find('#fe_ms_hue').val() );
		filters.saturation = parseInt( this.div.find('#fe_ms_saturation').val() );
		filters.sepia = parseInt( this.div.find('#fe_ms_sepia').val() );
		filters.grayscale = parseInt( this.div.find('#fe_ms_grayscale').val() );
		app.updateAccessibility();
	}
	
	update_date_time_preview(do_save) {
		// update date/time preview
		var json = this.get_settings_form_json();
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var lang = ropts.locale.match(/\-/) ? ropts.locale.split(/\-/).shift() : ropts.locale.toLowerCase();
		var reg = ropts.locale.match(/\-/) ? ropts.locale.split(/\-/).pop() : ropts.locale.toUpperCase();
		
		lang = json.language || lang;
		reg = json.region || reg;
		
		var opts = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: json.milliseconds ? 3 : undefined,
			locale: lang + '-' + reg,
			timeZone: json.timezone || ropts.timeZone,
			numberingSystem: json.num_format || ropts.numberingSystem,
			hourCycle: json.hour_cycle
		};
		
		this.div.find('#d_ms_dt_preview').html( (new Date()).toLocaleString( opts.locale, opts ) );
		if (do_save) this.saveChanges();
	}
	
	/* "global": {
		"clickSearchNavPrev": { "keys": ["ArrowLeft"], "title": "Previous Search Page" },
		"clickSearchNavNext": { "keys": ["ArrowRight"], "title": "Next Search Page" },
		"clickNewButton": { "keys": ["KeyN"], "title": "Create New" },
		"clickSaveButton": { "keys": ["Meta+KeyS", "Control+KeyS"], "title": "Save Changes" },
		"clickCloseButton": { "keys": ["Escape"], "title": "Close Editor" },
		"scrollToPageBox": { "keys": ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"], "title": "Scroll to Section" }
	},
	"Groups": {
		"goEditGroup": { "sub": "view", "keys": ["KeyE"], "title": "Edit Group" },
		"chooseHistoricalView": { "sub": "view", "keys": ["KeyH"], "title": "Historical View" },
		"createSnapshot": { "sub": "view", "keys": ["Meta+KeyS", "Control+KeyS"], "title": "Take Snapshot" },
		"openWatchDialog": { "sub": "view", "keys": ["KeyW"], "title": "Add Group Watch" },
		"addServerToGroup": { "sub": "view", "keys": ["KeyA"], "title": "Add Server to Group" }
	}, */
	
	renderHotKeys() {
		// refresh hot key table
		this.div.find('#d_hot_keys > div.box_content').html( this.getHotKeyTable() );
	}
	
	getHotKeyTable() {
		// get HTML for hot key table
		var self = this;
		var cols = ["Group", "Action", "Bound Keys", "Edited", "Actions"];
		var html = '';
		var rows = [];
		var user_keys = app.user.hot_keys || {};
		
		for (var page_id in config.ui.hot_keys) {
			var page_keys = config.ui.hot_keys[page_id];
			
			for (var key_id in page_keys) {
				var key_def = page_keys[key_id];
				var full_key_id = page_id + '-' + key_id;
				
				var row = {
					id: full_key_id,
					page_id: page_id,
					title: key_def.title,
					keys: key_def.keys
				};
				if (user_keys[full_key_id]) {
					row.keys = user_keys[full_key_id];
					row.edited = true;
				}
				
				rows.push(row);
			} // foreach key
		} // foreach page
		
		var grid_args = {
			rows: rows,
			cols: cols,
			data_type: 'action',
			class: 'data_grid hot_key_grid',
		};
		
		html += this.getBasicGrid( grid_args, function(item, idx) {
			var tds = [
				'<span><i class="mdi mdi-' + ((item.page_id == 'Global') ? 'earth' : 'folder-open-outline') + '">&nbsp;</i>' + item.page_id + '</span>',
				`<button class="link icon_pad" onClick="$P().doEditHotKey(this)" data-keyid="${item.id}"><i class="mdi mdi-keyboard-outline"></i><b>${item.title}</b></button>`,
				self.getNiceHotKeyList(item.keys) || '&nbsp;',
				item.edited ? '<i class="mdi mdi-checkbox-marked-outline"></i>' : '-',
				`<button class="link" onClick="$P().doEditHotKey(this)" data-keyid="${item.id}"><b>Edit Keys</b></button>`
			];
			return tds;
		}); // grid
		
		return html;
	}
	
	getNiceHotKeyList(keys, glue = ', ') {
		// get nice list of hot keys
		var self = this;
		if (!keys || !keys.length) return '';
		return keys.map( function(key) { return self.getNiceHotKey(key); } ).join(glue);
	}
	
	getNiceHotKey(key) {
		// get nice hot key for display
		var label = KeySelect.getkeyLabel(key);
		return `<span class="hot_key">${label}</span>`;
	}
	
	doEditHotKey(elem) {
		// pop dialog to edit keybind
		var self = this;
		var full_key_id = $(elem).data('keyid');
		var [ page_id, key_id ] = full_key_id.split(/\-/);
		var page_keys = config.ui.hot_keys[page_id];
		var key_def = page_keys[key_id];
		var user_keys = app.user.hot_keys || {};
		var values = user_keys[full_key_id] || key_def.keys;
		var title = page_id + ': ' + key_def.title;
		var html = '<div class="dialog_box_content maximize">';
		
		// hot key
		html += this.getFormRow({
			label: 'Bound Keys:',
			content: this.getFormMenuMulti({
				id: 'fe_hot_keys',
				title: 'Type new key combo:',
				placeholder: '(None)',
				options: values.map( function(key) { return { id: key, title: KeySelect.getkeyLabel(key) }; } ),
				values: values,
				icon: 'keyboard-outline',
				default_icon: 'keyboard-outline',
				// 'data-shrinkwrap': 1
			}),
			caption: 'Click above to add a key combo, or click the "X" icons to remove.'
		});
		
		html += '</div>';
		
		var buttons_html = "";
		buttons_html += '<div class="button mobile_collapse" onClick="Dialog.hide()"><i class="mdi mdi-close-circle-outline">&nbsp;</i><span>Cancel</span></div>';
		buttons_html += '<div class="button danger mobile_collapse" id="btn_hotkey_reset"><i class="mdi mdi-undo-variant">&nbsp;</i><span>Reset to Defaults</span></div>';
		buttons_html += '<div class="button primary" id="btn_hotkey_save"><i class="mdi mdi-floppy">&nbsp;</i><span>Save Changes</span></div>';
		
		Dialog.showSimpleDialog(title, html, buttons_html);
		
		// special mode for key capture
		Dialog.active = 'confirmation';
		Dialog.confirm_callback = function(result) { 
			if (result) Dialog.hide(); 
		};
		
		$('#btn_hotkey_reset').on('click', function() {
			// $('#fe_hot_keys').val( key_def.keys ).trigger('change');
			if (!app.user.hot_keys) app.user.hot_keys = {};
			delete app.user.hot_keys[full_key_id];
			Dialog.hide();
			self.receiveUser({ user: app.user });
			self.saveHotKeyChanges();
		});
		
		$('#btn_hotkey_save').on('click', function() {
			if (!app.user.hot_keys) app.user.hot_keys = {};
			app.user.hot_keys[full_key_id] = $('#fe_hot_keys').val();
			Dialog.hide();
			self.receiveUser({ user: app.user });
			self.saveHotKeyChanges();
		});
		
		KeySelect.init( '#fe_hot_keys' );
		Dialog.autoResize();
	}
	
	saveHotKeyChanges() {
		// persist hot keys back to user storage
		app.api.post( 'app/user_settings', { hot_keys: app.user.hot_keys }, function(resp) {
			app.user = resp.user;
		});
	}
	
	reset_keys() {
		// reset hot keys to defaults
		var user = app.user;
		
		user.hot_keys = {};
		
		this.receiveUser({ user: app.user });
		this.saveHotKeyChanges();
	}
	
	reset_loc() {
		// reset localization settings
		var user = app.user;
		var defaults = config.default_user_prefs;
		
		user.language = defaults.language;
		user.region = defaults.region;
		user.timezone = defaults.timezone;
		user.num_format = defaults.num_format;
		user.hour_cycle = defaults.hour_cycle;
		
		this.receiveUser({ user: app.user });
		this.saveChanges();
	}
	
	reset_ui() {
		// reset ui settings
		var user = app.user;
		var defaults = config.default_user_prefs;
		
		user.motion = defaults.motion;
		user.contrast = defaults.contrast;
		user.color_acc = defaults.color_acc;
		user.privacy_mode = defaults.privacy_mode;
		user.page_info = defaults.page_info;
		user.notifications = defaults.notifications;
		user.effects = defaults.effects;
		
		this.receiveUser({ user: app.user });
		app.updateAccessibility();
		this.saveChanges();
	}
	
	reset_av() {
		// reset av settings
		var user = app.user;
		var defaults = config.default_user_prefs;
		
		user.filters = deep_copy_object(defaults.filters);
		
		this.receiveUser({ user: app.user });
		app.updateAccessibility();
		this.saveChanges();
	}
	
	reset_admin() {
		// reset admin settings
		var user = app.user;
		var defaults = config.default_user_prefs;
		
		user.admin_hide_notify_sys = false;
		user.admin_hide_notify_user = false;
		
		this.receiveUser({ user: app.user });
		this.saveChanges();
	}
	
	get_settings_form_json() {
		// get all form settings into object for saving
		var settings = {
			language: this.div.find('#fe_ms_language').val(),
			region: this.div.find('#fe_ms_region').val(),
			timezone: this.div.find('#fe_ms_tz').val(),
			num_format: this.div.find('#fe_ms_numformat').val(),
			hour_cycle: this.div.find('#fe_ms_hrcycle').val(),
			milliseconds: this.div.find('#fe_ms_milliseconds').is(':checked'),
			volume: parseInt( this.div.find('#fe_ms_volume').val() ),
			motion: this.div.find('#fe_ms_motionacc').val(),
			contrast: this.div.find('#fe_ms_contrastacc').val(),
			color_acc: this.div.find('#fe_ms_coloracc').is(':checked'),
			privacy_mode: this.div.find('#fe_ms_privacy').is(':checked'),
			page_info: this.div.find('#fe_ms_pageinfo').is(':checked'),
			notifications: this.div.find('#fe_ms_notify').is(':checked'),
			effects: this.div.find('#fe_ms_effects').is(':checked'),
			filters: {}
		};
		
		var filters = settings.filters;
		filters.brightness = parseInt( this.div.find('#fe_ms_brightness').val() );
		filters.contrast = parseInt( this.div.find('#fe_ms_contrast').val() );
		filters.hue = parseInt( this.div.find('#fe_ms_hue').val() );
		filters.saturation = parseInt( this.div.find('#fe_ms_saturation').val() );
		filters.sepia = parseInt( this.div.find('#fe_ms_sepia').val() );
		filters.grayscale = parseInt( this.div.find('#fe_ms_grayscale').val() );
		
		if (app.isAdmin()) {
			settings.admin_hide_notify_sys = !this.div.find('#fe_ms_admin_notify_sys').is(':checked');
			settings.admin_hide_notify_user = !this.div.find('#fe_ms_admin_notify_user').is(':checked');
		}
		
		return settings;
	}
	
	onKeyDown(event) {
		// esc key needs to reset av settings
		if (event.keyCode == 27) this.reset_av();
	}
	
	saveChanges() {
		// save changes to user info
		var self = this;
		app.clearError();
		// Dialog.showProgress( 1.0, "Saving preferences..." );
		
		var json = this.get_settings_form_json();
		
		app.api.post( 'app/user_settings', json, function(resp) {
			// save complete
			// Dialog.hideProgress();
			// app.showMessage('success', "Your settings were saved successfully.");
			
			app.user = resp.user;
			
			// app.prepUser();
			app.initSidebarTabs();
			app.updateHeaderInfo();
			app.updateAccessibility();
			app.setupNotifications();
		} );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
