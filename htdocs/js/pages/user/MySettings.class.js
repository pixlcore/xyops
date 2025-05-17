
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
		html += '<div class="box_title">Localization Settings</div>';
		html += '<div class="box_content">';
		
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
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		html += '<div class="box">';
		html += '<div class="box_title">User Interface Settings</div>';
		html += '<div class="box_content">';
		
		// sound volume
		html += this.getFormRow({
			label: 'Sound Volume:',
			content: this.getFormRange({
				id: 'fe_ms_volume',
				min: 0,
				max: 10,
				step: 1,
				value: user.volume || 0
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-play-circle-outline" title="Preview Volume..." onClick="$P().playPreviewSound()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Select your desired audio volume level for app notifications.'
		});
		
		// motion preference
		html += this.getFormRow({
			label: 'Motion:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_motion',
				title: 'Select Motion Preference',
				options: [ 
					{ id: 'auto', title: 'Auto (System)', icon: 'creation' }, 
					{ id: 'full', title: 'Full Motion', icon: 'run-fast' }, 
					{ id: 'reduced', title: 'Reduced Motion', icon: 'walk' } 
				],
				value: user.motion || 'auto'
			}),
			caption: 'Select your desired preference for motion.  Reduced motion disables certain animations which may be sensitive to some people.'
		});
		
		// contrast preference
		html += this.getFormRow({
			label: 'Contrast:',
			content: this.getFormMenuSingle({
				id: 'fe_ms_contrast',
				title: 'Select Contrast Level',
				options: [ 
					{ id: 'auto', title: 'Auto (System)', icon: 'creation' }, 
					{ id: 'low', title: 'Low Contrast', icon: 'circle' },
					{ id: 'normal', title: 'Normal Contrast', icon: 'circle-half-full' }, 
					{ id: 'high', title: 'High Contrast', icon: 'circle-outline' },
				],
				value: user.contrast || 'auto'
			}),
			caption: 'Select your desired preference for contrast.  This affects the brightness range between the text and background colors.'
		});
		
		// color blind mode
		html += this.getFormRow({
			label: 'Vision:',
			content: this.getFormCheckbox({
				id: 'fe_ms_colorblind',
				label: 'Color Accessibility Mode',
				checked: !!user.color_blind
			}),
			caption: 'Enable or disable color assistance, which uses indicators other than color for differentiation.'
		});
		
		// show page descriptions
		html += this.getFormRow({
			label: 'Assistance:',
			content: this.getFormCheckbox({
				id: 'fe_ms_pageinfo',
				label: 'Show Page Descriptions',
				checked: !!user.page_info
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
				disabled: !app.secure
			}),
			caption: 'Enable or disable system notifications, for custom channel messages' + (app.secure ? '' : ' (requires SSL)') + '.'
		});
		
		// whimsy (effects)
		html += this.getFormRow({
			label: 'Whimsy:',
			content: this.getFormCheckbox({
				id: 'fe_ms_effects',
				label: 'Visual Effects',
				checked: !!user.effects
			}),
			caption: 'Who doesn\'t need a little whimsy in their life?  This adds playful animations for certain app events.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		SingleSelect.init( this.div.find('#fe_ms_language, #fe_ms_region, #fe_ms_tz, #fe_ms_numformat, #fe_ms_hrcycle, #fe_ms_motion, #fe_ms_contrast') );
		this.update_date_time_preview();
	}
	
	playPreviewSound() {
		// play preview sound at new volume level (unless zero)
		var volume = parseInt( this.div.find('#fe_ms_volume').val() );
		if (volume > 0) app.playSound('success-2.mp3', volume);
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
	}
	
	get_settings_form_json() {
		// get all form settings into object for saving
		return {
			language: this.div.find('#fe_ms_language').val(),
			region: this.div.find('#fe_ms_region').val(),
			timezone: this.div.find('#fe_ms_tz').val(),
			num_format: this.div.find('#fe_ms_numformat').val(),
			hour_cycle: this.div.find('#fe_ms_hrcycle').val(),
			volume: parseInt( this.div.find('#fe_ms_volume').val() ),
			motion: this.div.find('#fe_ms_motion').val(),
			contrast: this.div.find('#fe_ms_contrast').val(),
			color_blind: this.div.find('#fe_ms_colorblind').is(':checked'),
			page_info: this.div.find('#fe_ms_pageinfo').is(':checked'),
			notifications: this.div.find('#fe_ms_notify').is(':checked'),
			effects: this.div.find('#fe_ms_effects').is(':checked')
		};
	}
	
	is_dirty() {
		// return true if user made changes, false otherwise
		var user = app.user;
		if (!user) return false; // sanity
		if (!this.div.find('#fe_ms_tz').length) return false; // sanity
		
		var json = this.get_settings_form_json();
		if (json.language != user.language) return true;
		if (json.region != user.region) return true;
		if (json.timezone != user.timezone) return true;
		if (json.num_format != user.num_format) return true;
		if (json.hour_cycle != user.hour_cycle) return true;
		if (json.volume != user.volume) return true;
		if (json.motion != user.motion) return true;
		if (json.contrast != user.contrast) return true;
		if (json.color_blind != user.color_blind) return true;
		if (json.page_info != user.page_info) return true;
		if (json.notifications != user.notifications) return true;
		if (json.effects != user.effects) return true;
		
		return false;
	}
	
	saveChanges() {
		// save changes to user info
		var self = this;
		app.clearError();
		Dialog.showProgress( 1.0, "Saving preferences..." );
		
		var json = this.get_settings_form_json();
		
		app.api.post( 'app/user_settings', json, function(resp) {
			// save complete
			Dialog.hideProgress();
			app.showMessage('success', "Your settings were saved successfully.");
			
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
		
		// auto-save in background if user made changes
		if (this.is_dirty()) {
			var json = this.get_settings_form_json();
			merge_hash_into( app.user, json );
			// app.prepUser();
			app.initSidebarTabs();
			app.updateHeaderInfo();
			app.updateAccessibility();
			
			app.api.post( 'app/user_settings', json, function(resp) {
				app.showMessage('success', "Your settings were saved successfully.");
			}); // api.post
		}
		
		this.div.html( '' );
		return true;
	}
	
};
