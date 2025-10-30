// Send pretty HTML formatted emails on xyOps stationary, 
// using markdown source with {{mustache}} macros.
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const fs = require('fs');
const marked = require('marked');
const juice = require('juice');
const Tools = require('pixl-tools');
const PixlMail = require('pixl-mail');

class FancyMailer {
	
	mailerSetup() {
		// preload our html wrapper
		this.fancyMailTemplate = fs.readFileSync('conf/emails/template.html', 'utf8');
		
		// hijack sendMail from user manager to use fancy one instead
		this.usermgr.sendEmail = this.sendFancyMail.bind(this);
	}
	
	sendFancyMail(name, args, callback) {
		// send markdown as email
		let self = this;
		if (!callback) callback = function() {};
		
		// add universal args
		if (!args.config) args.config = {};
		if (!args.config.email_from) args.config.email_from = this.config.get('email_from');
		if (!args.config.client) args.config.client = this.config.get('client');
		
		// set some defaults
		let opts = {};
		opts.template = `conf/emails/${name}.txt`;
		opts.version = this.config.getPath('client.name') + ' v' + this.server.__version;
		opts.copyright = '&copy; ' + (new Date()).getFullYear() + ' PixlCore LLC.';
		opts.marked = this.config.getPath('ui.marked_config');
		opts.from = this.config.get('email_from');
		opts.logo_url = this.config.get('base_app_url') + '/' + this.config.getPath('client.logo_url');
		
		// load template
		fs.readFile( opts.template, 'utf8', function(err, template) {
			if (err) return callback(err);
			
			// substitute {{macros}} in text using supplied args with 'n/a' fallback
			let text = self.messageSub( template, args, 'n/a', function(value) {
				if ((typeof(value) == 'string') && (value.length == 0)) return 'n/a';
				else return value;
			} );
			
			// extract html comment variables from template body (e.g. to, subject)
			text = text.replace( /<\!--\s*(\w+)\:\s*(.*?)\s*-->\s*/g, function(m_all, m_g1, m_g2) {
				opts[ m_g1.toLowerCase() ] = m_g2.trim();
				return '';
			} ).trim();
			
			// required fields
			if (!opts.to) return callback( new Error("Missing required 'to' mail parameter.") );
			if (!opts.subject) return callback( new Error("Missing required 'subject' mail parameter.") );
			
			if (self.config.get('email_format') == 'html') {
				// parse button shorthand syntax
				// <!-- Button: View Alert | {{links.alert_url}} -->
				if (opts.button && opts.button.match(/^(.+)\s+\|\s+(https?\:\/\/\S+)$/i)) {
					opts.buttons = [ { class: "primary", title: RegExp.$1, url: RegExp.$2 } ];
					delete opts.button;
				}
				else if (typeof(opts.buttons) == 'string') {
					try { opts.buttons = JSON.parse(opts.buttons); }
					catch (e) {;}
				}
				
				// compose button html
				opts.buttons_html = '';
				
				if (opts.buttons) opts.buttons.forEach( function(button) {
					if (!button.class) button.class = '';
					opts.buttons_html += '<div class="right"><a class="button ' + button.class + '" href="' + button.url + '" style="margin-left:15px;">' + button.title + '</a></div>';
				} );
				
				// promote first h1 to title if not set
				if (!opts.title && text.trim().match(/^\#\s+(.+)\n/)) {
					opts.title = RegExp.$1;
					text = text.trim().replace(/^\#\s+(.+)\n/, '');
				}
				
				// markdown conversion to html
				opts.markdown = marked.parse(text, opts.marked);
				
				// placeholder substitution in html template
				let html = self.messageSub( self.fancyMailTemplate, opts );
				
				// call juice to inline all css
				opts.body = juice(html, {});
				
				// juice does not remove the original style tags, sigh
				// (yes, I know about `removeStyleTags`, it doesn't WORK)
				opts.body = opts.body.replace(/<style>[\s\S]+<\/style>/, '');
			}
			else {
				// plain text email (markdown source)
				opts.body = text.trim() + "\n\n" + opts.version + " (c) " + (new Date()).getFullYear() + ' PixlCore LLC.' + "\n";
			}
			
			let message = '';
			message += "To: " + opts.to + "\n";
			message += "From: " + opts.from + "\n";
			
			// cc and bcc
			if (opts.cc) message += "Cc: " + opts.cc + "\n";
			if (opts.bcc) message += "Bcc: " + opts.bcc + "\n";
			
			// custom mime headers
			for (let key in opts.headers) {
				message += `${key}: ${opts.headers[key]}\n`;
			}
			
			message += "Subject: " + opts.subject + "\n\n";
			message += opts.body + "\n";
			
			// send it
			self.sendEmail( message, null, callback );
		}); // fs.readFile
	}
	
	sendEmail(text, args, callback) {
		// send email with rate limiting
		if (!callback) {
			callback = args;
			args = {};
		}
		
		// rate limiting
		let max_emails_per_day = this.config.get('max_emails_per_day') || 0;
		if (max_emails_per_day && (this.getDailyStat('email_sent') >= max_emails_per_day)) {
			return callback( new Error(`Maximum email daily limit has been reached (${max_emails_per_day}/day)`) );
		}
		this.updateDailyStat( 'email_sent', 1 );
		
		// construct mailer
		let mail = new PixlMail();
		mail.setOptions( this.config.get('mail_settings') || {} );
		mail.attachLogAgent( this.logger );
		
		var perf_start = performance.now();
		
		// send it
		mail.send( text, args, function(err, body, log) {
			// include elapsed time in debug log
			var elapsed_ms = Math.floor( performance.now() - perf_start ); // this is milliseconds
			if (!log) log = [];
			log.push([ ``, {} ]);
			log.push([ `Mailer elapsed time: ${elapsed_ms} ms`, {} ]);
			
			// waiting a tick because nodemailer's callback is wrapped
			process.nextTick( function() { callback( err, body, log ); } );
		});
	}
	
}; // class FancyMailer

module.exports = FancyMailer;
