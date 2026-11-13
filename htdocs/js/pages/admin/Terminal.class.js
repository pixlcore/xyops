// Terminal Page

// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

Page.Terminal = class TermPage extends Page.PageUtils {
	
	onInit() {
		// called once at page load
		var self = this;
		
		app.doUserLogout = function() {
			if (self.term) self.term.write("Access denied.\r\n");
		};
		
		app.comm.handleStatusUpdate = function() {};
		app.comm.handleDataUpdate = function() {};
		app.comm.handleSingleDataUpdate = function() {};
		app.comm.handlePageUpdate = function() {};
		app.comm.handleActivity = function() {};
		
		// register an extension for custom socket comm
		// and so we can hook socket login (+reconnect)
		app.extensions.push({
			id: 'int-term',
			obj: {
				handleLogin: function() {
					// user has logged in or reconnected
					app.comm.sendCommand('termClientStart', { 
						id: self.termID,  
						server: self.server, 
						opts: {
							cols: self.term.cols,
							rows: self.term.rows
						}
					});
				},
				handleComm: function(socket, data) {
					// received ext message from server
					var func = 'comm_' + data.cmd;
					if (self[func]) self[func](socket, data);
				}
			}
		});
		
		this.div.addClass('fixed_page');
	}
	
	onActivate(args) {
		// page activation
		// title, icon, fields, limits, body
		var self = this;
		$('body').addClass('terminal');
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle( "Terminal" );
		app.setHeaderTitle( '<i class="mdi mdi-console">&nbsp;</i>Terminal' );
		app.showSidebar(false);
		app.setupDragDrop();
		
		this.render();
		
		app.comm.init();
		
		if (!app.getPref('username')) {
			this.term.write( "Access denied.\r\n" );
		}
		
		return true;
	}
	
	render() {
		// render and init terminal
		var self = this;
		var dark = $('body').hasClass('dark');
		
		this.div.html(`
			<div class="box">
				<div class="box_content">
					<div id="d_term" style="height:calc(100vh - 200px)"></div>
				</div>
			</div>
		`);
		
		var xterm_defaults = config.xterm_defaults || {};
		
		var term = this.term = new Terminal({
			minimumContrastRatio: 4.5,
			scrollOnEraseInDisplay: true,
			lineHeight: 1.2,
			scrollback: 10000,
			cursorStyle: 'block',
			cursorBlink: false,
			
			theme: {
				foreground: app.getCSSVar('--body-text-color'),
				background: app.getCSSVar('--box-background-color'),
				
				// cursor and selection
				cursor: app.getCSSVar('--body-text-color'),
				cursorAccent: dark ? '#181820' : '#FFFFFF',
				selectionBackground: dark ? '#365880' : '#B6D7FF',
				
				// Standard ANSI palette: colors 0 through 7.
				black: dark ? '#30303C' : '#202020',
				red: dark ? '#E06C75' : '#B42318',
				green: dark ? '#98C379' : '#1A7F37',
				yellow: dark ? '#E5C07B' : '#8A6500',
				blue: dark ? '#61AFEF' : '#005CC5',
				magenta: dark ? '#C678DD' : '#8250DF',
				cyan: dark ? '#56B6C2' : '#087C86',
				white: dark ? '#CCCCCC' : '#606060',
				
				// Bright ANSI palette: colors 8 through 15.
				brightBlack: dark ? '#808090' : '#777777',
				brightRed: dark ? '#FF808A' : '#D1242F',
				brightGreen: dark ? '#B3E88D' : '#22863A',
				brightYellow: dark ? '#FFD68A' : '#9A6700',
				brightBlue: dark ? '#80C7FF' : '#0969DA',
				brightMagenta: dark ? '#E0A0F0' : '#A32CC4',
				brightCyan: dark ? '#80D8E0' : '#00818A',
				brightWhite: dark ? '#FFFFFF' : '#333333'
			},
			
			...xterm_defaults
		});
		var fit = this.fit = new FitAddon.FitAddon();
		
		term.loadAddon(fit);
		term.open( document.getElementById('d_term') );
		fit.fit();
		
		term.onResize(function(size) {
			// Called whenever the terminal's columns or rows change.
			// Only send input after the remote terminal has started.
			if (!self.termID) return;
			
			// Forward the input exactly as received.
			app.comm.sendCommand('termClientResize', {
				id: self.termID,
				cols: term.cols,
				rows: term.rows
			});
		});
		
		term.onData(function(data) {
			// Only send input after the remote terminal has started.
			if (!self.termID) return;
			
			// Forward the input exactly as received.
			app.comm.sendCommand('termClientWrite', {
				id: self.termID,
				data: data
			});
		});
		
		term.focus();
	}
	
	comm_termStart(socket, data) {
		// terminal has started, save id
		this.termID = data.id;
		
		// Configure Windows compatibility using the remote server's OS version.
		var server = data.server;
		var info = this.serverInfo = server.info;
		
		if (info.platform === 'win32') {
			// Windows releases use major.minor.build, optionally followed by a revision.
			var buildNumber = parseInt((info.release || '').split('.')[2], 10);
			
			if (Number.isFinite(buildNumber) && (buildNumber > 0)) {
				this.term.options.windowsPty = {
					backend: 'conpty',
					buildNumber: buildNumber
				};
			}
		}
		
		// add server to header
		var icon = this.getNiceServerIcon(server);
		var title = data.server.title || app.formatHostname(server.hostname);
		$('div.header > div.header_title').append( `<div class="right mobile_hide"><i class="mdi mdi-${icon}">&nbsp;</i>${title}</div>` );
		
		// ansi utilities
		var ansiColor = function( rgb, text ) {
			return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[0m`;
		};
		var ansiBold = function(text) {
			return `\x1b[1m${text}\x1b[0m`;
		};
		
		// welcome message
		var os = info.os || { platform: 'Unknown', distro: '', release: '' };
		var cpu = info.cpu || { combo: 'Unknown', cores: 0 };
		var nice_cpu = cpu.combo + (info.virt?.vendor ? ` / ${info.virt.vendor}` : '');
		var nice_mem = get_text_from_bytes( info.memory?.total || 0 );
		var colors = { blue: [55, 145, 245], green: [40, 167, 69], orange: [253, 126, 20], gray: [138, 147, 155], purple: [140, 60, 220], cyan: [23, 162, 184], teal: [32, 201, 151] };
		var eol = "\r\n";
		
		var welcome = [
			// Blue product title, with a quieter version number.
			ansiColor( colors.blue, ansiBold('🚀  xyOps Terminal Emulator') ) +
				ansiColor( colors.gray, ' v' + app.version ),
			
			// Highlight the server name, with secondary connection details in gray.
			ansiColor( colors.gray, 'Server: ' ) +
				ansiColor( colors.green, ansiBold(server.title || server.hostname) ) +
				ansiColor( colors.gray, ' (' + (server.title ? `${server.hostname}, ${server.ip}` : server.ip) + ')' ),
			
			// Hardware values use the terminal's normal foreground color.
			ansiColor( colors.gray, 'Hardware: ' ) +
				ansiColor( colors.purple, ansiBold(nice_cpu) ) +
				ansiColor( colors.gray, ' (' + cpu.cores + ' CPU cores, ' + nice_mem + ' RAM)' ),
			
			// OS values also use the normal foreground, with architecture in gray.
			ansiColor( colors.gray, 'OS: ' ) +
				ansiColor( colors.cyan, ansiBold(os.platform + ' ' + os.distro + ' ' + os.release) ) + 
				ansiColor( colors.gray, ' (' + os.arch + ')' )
		].join(eol) + eol + eol;
		
		this.term.write(welcome);
	}
	
	comm_termWrite(socket, data) {
		// terminal has new data for us!
		this.term.write( data.data );
	}
	
	comm_termStats(socket, data) {
		// terminal has new stats for us!
		this.termStats = data.data;
	}
	
	comm_termClose(socket, data) {
		// terminal has closed remotely
		this.term.write( "\r\n\r\n(Terminal has closed on the remote side.)\r\n" );
		delete this.termID;
	}
	
	doUploadFiles(prefill) {
		// show dialog to upload files to server
		var self = this;
		var title = "Upload Files to Server";
		var btn = ['file-move', 'Transfer Now'];
		var html = '';
		
		app.clearError();
		
		html += `<div class="dialog_intro">Upload and transfer files directly to a specific directory on the server.</div>`;
		html += '<div class="dialog_box_content scroll maximize">';
		
		// files
		html += this.getFormRow({
			label: 'Upload Files:',
			content: this.getDialogFileUploader(),
			caption: 'Select one or more files to upload.'
		});
		
		// cwd
		html += this.getFormRow({
			label: 'Target Directory:',
			content: this.getFormText({
				id: 'fe_t_cwd',
				class: 'monospace',
				spellcheck: 'false',
				value: this.termStats?.cwd || ''
			}),
			caption: 'Enter the full path to the target directory, or leave blank to use the server\'s temp directory.'
		});
		
		// UID
		html += this.getFormRow({
			id: 'd_t_uid',
			label: 'Save as User:',
			content: this.getFormText({
				id: 'fe_t_uid',
				class: 'monospace',
				spellcheck: 'false',
				value: this.termStats?.uid ?? ''
			}),
			caption: "Optionally set the User ID (UID) to save the files as.  The UID may be either numerical or a string (`root`, `www`, etc.).  Linux/macOS only."
		});
		
		// GID
		html += this.getFormRow({
			id: 'd_t_gid',
			label: 'Save as Group:',
			content: this.getFormText({
				id: 'fe_t_gid',
				class: 'monospace',
				spellcheck: 'false',
				value: this.termStats?.gid ?? ''
			}),
			caption: "Optionally set the Group ID (GID) to save the files as.  The GID may be either numerical or a string (`wheel`, `admin`, etc.).  Linux/macOS only."
		});
		
		html += '</div>';
		
		Dialog.confirm( title, html, btn, function(result) {
			if (!result) return;
			app.clearError();
			
			var cwd = $('#fe_t_cwd').val();
			var uid = $('#fe_t_uid').val();
			var gid = $('#fe_t_gid').val();
			
			if (!self.dialogFiles || !self.dialogFiles.length) {
				return app.doError("Please upload one or more files to send to the server.");
			}
			
			app.comm.sendCommand('termClientFiles', {
				id: self.termID,
				files: self.dialogFiles,
				cwd: cwd,
				uid: uid,
				gid: gid
			});
			
			Dialog.hide();
			delete self.dialogFiles; // destructive
			app.showMessage('info', "Your files are being transferred in the background.");
		}); // Dialog.confirm
		
		Dialog.onDragDrop = function(files) {
			// files dropped on dialog
			ZeroUpload.upload( files, {}, app.csrf_token ? { csrf_token: app.csrf_token } : {} );
		};
		
		Dialog.onHide = function() {
			// cleanup
			// FUTURE: If self.dialogFiles still exists here, delete in background (user canceled job)
			delete self.dialogFiles;
		};
		
		if (prefill) Dialog.onDragDrop(prefill);
		
		Dialog.autoResize();
	}
	
	onDragDrop(files) {
		if (!this.termID) return;
		if (!this.serverInfo?.features?.termFiles) return app.doError("This server does not support file uploads.  Please upgrade to the latest xyOps Satellite.");
		this.doUploadFiles(files);
	}
	
	onResize() {
		// called when browser window resizes
		if (this.fit) this.fit.fit();
	}
	
	onBeforeUnload() {
		// Request confirmation while a terminal session is active.
		if (this.termID) return 'Close this terminal session?';
	}
	
	onDeactivate() {
		// do not allow page to deactivate (standalone)
		return false;
	}
	
};
