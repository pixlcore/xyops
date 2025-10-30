// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Document = class Document extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('View Document');
		
		if (args.standalone) {
			// standalone mode, no login, no prefs, no header, no footer
			app.setHeaderTitle( '' );
			app.showSidebar(false);
			$('body').addClass('relative');
			app.setTheme('light');
			$('.header').hide();
			$('#d_footer').hide();
		}
		else if (app.user) {
			// user is logged in
			app.setHeaderTitle( '<i class="mdi mdi-file-document-outline">&nbsp;</i>View Document' );
			app.showSidebar(true);
			
			// highlight our pseudo-tab
			app.highlightTab( 'Document_' + args.id );
		}
		else if (app.getPref('username')) {
			// user has cookie
			this.requireLogin(args);
			return true;
		}
		else {
			// user is NOT logged in
			app.setHeaderTitle( '' );
			app.showSidebar(false);
			$('body').addClass('relative');
			
			// add create / login buttons to header
			var html = '';
			html += '<div id="d_theme_ctrl" class="header_widget icon" onClick="app.toggleTheme()" title="Toggle Light/Dark Theme"></div>';
			if (config.free_accounts) {
				html += '<div class="header_widget button" onClick="$P().doCreateAccount()"><i class="mdi mdi-account-plus">&nbsp;</i><span>Sign Up...</span></div>';
			}
			html += '<div class="header_widget button" onClick="$P().doLogin()"><i class="mdi mdi-key">&nbsp;</i><span>Login...</span></div>';
			
			$('#d_header_user_container').html( html );
			app.initTheme();
		}
		
		this.loading();
		app.api.get( 'app/doc', args, this.receiveDoc.bind(this), this.fullPageError.bind(this) );
		
		return true;
	}
	
	receiveDoc(resp) {
		// receive markdown from server, render it
		var html = '';
		var text = resp.data;
		var args = this.args;
		
		if (!this.active) return; // sanity
		
		if ((typeof(text) == 'object') && text.subject && text.body) {
			// viewing DB record as document
			var record = resp.data;
			text = "";
			if (args.subject) text += "# " + record.subject + "\n\n";
			text += record.body;
		}
		
		// promote first heading into title, if user is logged in and it's a level 1 or 2 header
		if (app.user && !args.standalone && text.match(/^\#{1,2}\s+([^\n]+)\n\n/)) {
			var title = RegExp.$1;
			app.setWindowTitle( title );
			app.setHeaderTitle( '<i class="mdi mdi-file-document-outline">&nbsp;</i>' + title );
			text = text.replace(/^\#{1,2}\s+([^\n]+)\n\n/, '');
		}
		
		var extra_classes = 'code';
		if (args.standalone) extra_classes = '';
		
		html += '<div class="box">';
		html += '<div class="box_content">';
		html += '<div class="markdown-body ' + extra_classes + '" style="' + (app.user ? this.getUserFontStyle() : 'font-size:16px') + '">';
		// html += '<div class="markdown-body code" style="font-size:16px">';
		
		html += marked.parse(text, {
			gfm: true,
			tables: true,
			breaks: false,
			pedantic: false,
			sanitize: false,
			smartLists: true,
			smartypants: false,
			silent: true,
			headerIds: false,
			mangle: false
		});
		
		html += '</div>'; // markdown-body
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html(html);
		this.expandInlineImages();
	}
	
	doCreateAccount() {
		Nav.go('Login?create=1');
	}
	
	doLogin() {
		Nav.go('Login');
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		if (!app.user) {
			$('body').removeClass('relative');
			$('#d_header_user_container').html('');
			$('.header').show();
			$('#d_footer').show();
			app.initTheme();
		}
		return true;
	}
	
};
