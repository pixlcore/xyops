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
		var lang = ropts.locale.split(/\-/).shift();
		var reg = ropts.locale.split(/\-/).pop();
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Localization Settings';
			html += '<div class="button right phone_collapse" onClick="$P().reset_loc()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset to Defaults</div>';
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
				onChange: '$P().update_date_time_preview()'
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
				onChange: '$P().update_date_time_preview()'
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
				onChange: '$P().update_date_time_preview()'
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
				onChange: '$P().update_date_time_preview()'
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
				onChange: '$P().update_date_time_preview()'
			}),
			caption: 'Select your desired hour cycle format for displaying hours of the day.'
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
			html += '<div class="button right phone_collapse" onClick="$P().reset_ui()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset to Defaults</div>';
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
				label: '<span data-private>Streamer Mode</span>',
				checked: !!user.privacy_mode,
				onChange: '$P().previewPrivacyMode(this)'
			}),
			caption: 'Enable or disable streamer mode, which hides sensitive information such as IP addresses, hostnames, usernames, full names, and email addresses.'
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
			html += 'Audio / Visual Settings';
			html += '<div class="button right phone_collapse" onClick="$P().reset_av()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset to Defaults</div>';
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
			suffix: '<div style="position:relative; left:-15px;">%</div>',
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
			suffix: '<div style="position:relative; left:-15px;">%</div>',
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
			suffix: '<div style="position:relative; left:-15px;"><i class="mdi mdi-triangle-outline"></i></div>',
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
			suffix: '<div style="position:relative; left:-15px;">%</div>',
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
			suffix: '<div style="position:relative; left:-15px;">%</div>',
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
			suffix: '<div style="position:relative; left:-15px;">%</div>',
		});
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		if (app.isAdmin()) {
			html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Administrator Settings';
				html += '<div class="button right phone_collapse" onClick="$P().reset_admin()"><i class="mdi mdi-undo-variant">&nbsp;</i>Reset to Defaults</div>';
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
		
		this.div.html( html );
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
	
	update_date_time_preview() {
		// update date/time preview
		var json = this.get_settings_form_json();
		var ropts = Intl.DateTimeFormat().resolvedOptions();
		var lang = ropts.locale.split(/\-/).shift();
		var reg = ropts.locale.split(/\-/).pop();
		
		lang = json.language || lang;
		reg = json.region || reg;
		
		var opts = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long',
			hour: 'numeric',
			minute: '2-digit',
			locale: lang + '-' + reg,
			timeZone: json.timezone || ropts.timeZone,
			numberingSystem: json.num_format || ropts.numberingSystem,
			hourCycle: json.hour_cycle
		};
		
		this.div.find('#d_ms_dt_preview').html( (new Date()).toLocaleString( opts.locale, opts ) );
		this.saveChanges();
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
