// xyOps Ticket Subsystem
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const async = require("async");
const Tools = require("pixl-tools");

class TicketSystem {
	
	logTicket(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Ticket' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	ticketSetup() {
		// setup ticket subsystem
		this.ticketChanges = {};
		
		// ticket overdue notice
		this.server.on( this.config.getPath('tickets.overdue_schedule'), this.checkOverdueTickets.bind(this) );
	}
	
	processTicketChange(record_id, changes) {
		// setup notifications for ticket change (delayed email)
		var self = this;
		var now = Tools.timeNow(true);
		if (!this.config.getPath('tickets.email_enabled')) return;
		
		if (!changes || !changes.length) {
			this.logTicket(9, "No changes detected in ticket: " + record_id);
			return;
		}
		
		this.logTicket(9, "Processing ticket changes: " + record_id, changes);
		
		// accumulate ticket changes for e-mail (i.e. debounce)
		if (!this.ticketChanges[record_id]) {
			this.ticketChanges[record_id] = { id: record_id, changes: [] };
		}
		this.ticketChanges[record_id].modified = now;
		this.ticketChanges[record_id].changes = this.ticketChanges[record_id].changes.concat( changes );
	}
	
	detectTicketChanges(args, old_ticket, new_ticket) {
		// summarize ticket changes for DB and trigger system
		var self = this;
		var changes = [];
		var common = {
			type: 'change',
			username: args.username || args.user.username || args.user.id,
			date: new_ticket.modified
		};
		
		// special case: draft tickets don't track changes
		if (new_ticket.status == 'draft') return [];
		
		// subject
		if (('subject' in new_ticket) && (new_ticket.subject != old_ticket.subject)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'subject',
				value: new_ticket.subject
			}) );
		}
		
		// body
		if (('body' in new_ticket) && (new_ticket.body != old_ticket.body)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'body'
			}) );
		}
		
		// type
		if (('type' in new_ticket) && (new_ticket.type != old_ticket.type)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'type',
				value: new_ticket.type
			}) );
		}
		
		// category
		if (('category' in new_ticket) && (new_ticket.category != old_ticket.category)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'category',
				value: new_ticket.category
			}) );
		}
		
		// server
		if (('server' in new_ticket) && (new_ticket.server != old_ticket.server)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'server',
				value: new_ticket.server
			}) );
		}
		
		// status
		if (('status' in new_ticket) && (new_ticket.status != old_ticket.status)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'status',
				value: new_ticket.status
			}) );
			
			if (new_ticket.status == 'closed') {
				this.updateDailyStat( 'ticket_close', 1 );
			}
		}
		
		// assignees
		if (('assignees' in new_ticket) && this.isArrayDiff(new_ticket.assignees || [], old_ticket.assignees || [])) {
			changes.push( Tools.mergeHashes(common, {
				key: 'assignees',
				value: new_ticket.assignees
			}) );
		}
		
		// due date
		if (('due' in new_ticket) && (new_ticket.due != old_ticket.due)) {
			changes.push( Tools.mergeHashes(common, {
				key: 'due',
				value: new_ticket.due
			}) );
		}
		
		// cc (list)
		if (('cc' in new_ticket) && this.isArrayDiff(old_ticket.cc || [], new_ticket.cc || [])) {
			changes.push( Tools.mergeHashes(common, {
				key: 'cc',
				value: new_ticket.cc
			}) );
		}
		
		// notify (list)
		if (('notify' in new_ticket) && this.isArrayDiff(old_ticket.notify || [], new_ticket.notify || [])) {
			changes.push( Tools.mergeHashes(common, {
				key: 'notify',
				value: new_ticket.notify
			}) );
		}
		
		// tags (list)
		if (('tags' in new_ticket) && this.isArrayDiff(old_ticket.tags || [], new_ticket.tags || [])) {
			changes.push( Tools.mergeHashes(common, {
				key: 'tags',
				value: new_ticket.tags
			}) );
		}
		
		return changes;
	}
	
	pruneRedundantChanges(changes) {
		// remove dupe changes with same date code (i.e. minute)
		var code_map = {};
		
		changes.forEach( function(change) {
			if (!change.key) return;
			change._dc = change.key + '|' + Tools.formatDate( change.date, '[yyyy]/[mm]/[dd] [hh]:[mi]' );
			
			if (change._dc in code_map) {
				code_map[change._dc].discard = true;
			}
			
			code_map[change._dc] = change;
		} );
		
		var new_changes = [];
		changes.forEach( function(change) {
			delete change._dc;
			if (!change.discard) new_changes.push(change);
		});
		
		return new_changes;
	}
	
	checkTicketChanges() {
		// called every second via tick()
		// see if any ticket changes have "expired" (debounced)
		// so we can finally send e-mails for them
		var self = this;
		var ticket_config = this.config.get('tickets');
		
		if (!this.master) return;
		if (!ticket_config.email_enabled) return;
		
		var debounce_sec = ticket_config.email_debounce_sec || 30;
		var now = Tools.timeNow(true);
		
		Object.keys(this.ticketChanges).forEach( function(record_id) {
			var args = self.ticketChanges[record_id];
			if (now - args.modified >= debounce_sec) {
				self.processDelayedTicketChange(args);
				delete self.ticketChanges[record_id];
			}
		} );
	}
	
	processDelayedTicketChange(args) {
		// handle delayed (e-mail) ticket batch of changes after baking in debounce
		// (this is for one single ticket)
		var self = this;
		var record_id = args.id;
		
		args.changes = this.pruneRedundantChanges(args.changes);
		this.logTicket(9, "Processing delayed ticket change: " + record_id, args.changes);
		
		this.unbase.get( 'tickets', record_id, function(err, ticket) {
			if (err) {
				self.logError('trigger', "Ticket not found: " + record_id + " (skipping notifications)", args);
				return;
			}
			
			// special case: DO NOT notify for 'draft' status whatsoever
			if (ticket.status == 'draft') {
				self.logTicket(7, "Ticket is a draft: " + record_id + " (skipping notifications)", args);
				return;
			}
			
			// add ticket to args
			args.ticket = ticket;
			
			// create list of recipients
			args.recipients = [];
			if (ticket.notify) {
				args.recipients = args.recipients.concat( ticket.notify );
			}
			
			// load all the users we will need (for recipients and for full names)
			var usernames = {};
			if (ticket.assignees) ticket.assignees.forEach( function(username) { usernames[username] = 1; } );
			if (ticket.cc) ticket.cc.forEach( function(username) { usernames[username] = 1; } );
			
			args.changes.forEach( function(change) {
				// who dun it
				if (change.username) usernames[ change.username ] = 1;
				
				// what they did
				if (change.key == 'assignees') change.value.forEach( function(username) { usernames[username] = 1; } );
				else if (change.key == 'cc') change.value.forEach( function(username) { usernames[username] = 1; } );
			} );
			
			// load users for action
			self.loadMultipleUsers( Object.keys(usernames), function(err, users) {
				// get users into hash keyed by username, keep only what we need
				args.users = {};
				users.forEach( function(user) { args.users[ user.username ] = { username: user.username, full_name: user.full_name, email: user.email }; } );
				
				// prepare recipient list
				(ticket.assignees || []).forEach( function(username) {
					var user = args.users[username];
					if (!user || !user.email) return; // sanity
					args.recipients.push( user.full_name + ' <' + user.email + '>' );
				});
				(ticket.cc || []).forEach( function(username) {
					var user = args.users[username];
					if (!user || !user.email) return; // sanity
					args.recipients.push( user.full_name + ' <' + user.email + '>' );
				});
				
				// send it!
				if (args.recipients.length) {
					self.sendTicketEmailNotification(args);
				}
				
			}); // loadMultipleUsers
		}); // unbase.get
	}
	
	getTicketDisplayArgs(args) {
		// format strings for ticket attribute display
		var self = this;
		var ticket_config = this.config.get('tickets');
		var ticket = args.ticket;
		var display = {};
		
		// display.type
		var type = Tools.findObject( this.config.getPath('ui.ticket_types'), { id: ticket.type } );
		display.type = type ? type.title : `(${ticket.type})`;
		
		// display.category
		if (ticket.category) {
			var category = Tools.findObject( this.categories, { id: ticket.category } );
			display.category = category ? category.title : `(${ticket.category})`;
		}
		else display.category = '(None)';
		
		// display.status
		var status = Tools.findObject( this.config.getPath('ui.ticket_statuses'), { id: ticket.status } );
		display.status = status ? status.title : `(${ticket.status})`;
		
		// display.assignees
		if (ticket.assignees && ticket.assignees.length) {
			display.assignees = ticket.assignees.map( function(username) {
				var user = args.users[ username ];
				return user ? user.full_name : `(${username})`
			} ).join(', ');
		}
		else display.assignees = '(None)';
		
		// display.due
		if (ticket.due) {
			display.due = Tools.formatDate(ticket.due, ticket_config.due_date_format || "[dddd], [mmmm] [mday], [yyyy]")
		}
		else display.due = '(None)';
		
		// display.tags
		if (ticket.tags && ticket.tags.length) {
			display.tags = ticket.tags.map( function(tag) {
				var tag_def = Tools.findObject( self.tags, { id: tag } ) || { id: tag, title: '(' + tag + ')' };
				return tag_def.title;
			} ).join(', ');
		}
		else display.tags = '(None)';
		
		return display;
	}
	
	sendTicketEmailNotification(args) {
		// send e-mail notification for ticket change
		var self = this;
		var ticket_config = this.config.get('tickets');
		var ticket = args.ticket;
		var changes = args.changes;
		var is_new_ticket = !!Tools.findObject( changes, { key: 'created' } );
		
		var email_args = {
			ticket: ticket,
			email_to: args.recipients.join(', '),
			links: {
				ticket_url: this.config.get('base_app_url') + '/#' + ticket.num
			},
			display: this.getTicketDisplayArgs(args)
		};
		
		this.logTicket(9, "Sending ticket email notification: #" + ticket.num + ": " + email_args.email_to);
		
		if (!is_new_ticket) {
			// compose changes
			var md_changes = this.renderTicketChangesToMarkdown(args);
			
			// if body text was changed, include full ticket body in email
			if (Tools.findObject(changes, { type: 'change', key: 'body' })) {
				md_changes += `\n### Updated Ticket Content\n${ticket.body}\n`;
			}
			
			// show new comments
			changes.filter( function(change) { return change.type == 'comment'; } ).forEach( function(change) {
				var user = args.users[ change.username ] || { username: change.username, full_name: '(' + change.username + ')' };
				var nice_date = Tools.formatDate(change.edited || change.date, ticket_config.date_time_format || '[dddd], [mmmm] [mday], [yyyy] [hour12]:[mi] [ampm]');
				md_changes += `\n#### New comment by ${user.full_name} on ${nice_date}\n${change.body}\n`;
			});
			
			email_args.display.changes = md_changes;
		}
		
		this.sendFancyMail( is_new_ticket ? 'ticket_new' : 'ticket_updated', email_args, function(err, body, log) {
			if (err) self.logError('mail', "Failed to send email: " + email_args.email_to + ": " + err, { log } );
			else self.logTicket(7, "Email sent successfully to: " + email_args.email_to );
		} );
	}
	
	renderTicketChangesToMarkdown(args) {
		// convert change metadata into a markdown list
		var self = this;
		var ticket_config = this.config.get('tickets');
		var ticket = args.ticket;
		var changes = args.changes;
		var change_defs = this.config.getPath('ui.ticket_changes');
		var md = '';
		
		changes.filter( function(change) { return change.type == 'change'; } ).forEach( function(change) {
			var full_name = args.users[ change.username ] ? args.users[ change.username ].full_name : `(${change.username})`;
			var text = change_defs[ change.key ];
			if (!text) return; // sanity
			
			switch (change.key) {
				case 'subject':
					text = Tools.sub( text, { disp: `**${change.value}**` } );
				break;
				
				case 'type':
					var type = Tools.findObject( self.config.getPath('ui.ticket_types'), { id: change.value } );
					text = Tools.sub( text, { disp: type ? `**${type.title}**` : `(${change.value})` } );
				break;
				
				case 'category':
					var category = Tools.findObject( self.categories, { id: change.value } );
					text = Tools.sub( text, { disp: category ? `**${category.title}**` : `(${change.value})` } );
				break;
				
				case 'status':
					var status = Tools.findObject( self.config.getPath('ui.ticket_statuses'), { id: change.value } );
					text = Tools.sub( text, { disp: status ? `**${status.title}**` : `(${change.value})` } );
				break;
				
				case 'assignees':
					var user_list = change.value.map( function(username) {
						var user = args.users[ username ];
						return user ? `**${user.full_name}**` : `(${username})`;
					} ).join(', ') || '(None)';
					
					text = Tools.sub( text, { disp: user_list } );
				break;
				
				case 'due':
					var due_date = Tools.formatDate(change.value, ticket_config.due_date_format || "[dddd], [mmmm] [mday], [yyyy]");
					text = Tools.sub( text, { disp: `**${due_date}**` } );
				break;
				
				case 'cc':
					var cc_list = change.value.map( function(username) {
						var user = args.users[ username ];
						return user ? `**${user.full_name}**` : `(${username})`;
					} ).join(', ') || '(None)';
					
					text = Tools.sub( text, { disp: cc_list } );
				break;
				
				case 'notify':
					var notify_list = change.value.map( function(email) {
						return `**${email}**`;
					} ).join(', ') || '(None)';
					
					text = Tools.sub( text, { disp: notify_list } );
				break;
				
				case 'tags':
					var tag_list = change.value.map( function(tag) {
						var tag_def = Tools.findObject( self.tags, { id: tag } );
						return tag_def ? `**${tag_def.title}**` : `(${tag})`;
					} ).join(', ') || '(None)';
					
					text = Tools.sub( text, { disp: tag_list } );
				break;
			} // switch key
			
			md += `- ${full_name} ${text}\n`;
		} ); // foreach change
		
		return md;
	}
	
	checkOverdueTickets() {
		// check for overdue tickets and send out notices to assignees
		// (note: assignees only, NOT cc's or notify's)
		var self = this;
		var ticket_config = this.config.get('tickets');
		if (!ticket_config.email_enabled) return;
		
		this.logTicket(5, "Checking for overdue tickets: " + ticket_config.overdue_query);
		
		this.unbase.search( 'tickets', ticket_config.overdue_query, { offset:0, limit:1000, sort_by:'_id', sort_dir:1 }, function(err, results) {
			if (!results || !results.records || !results.records.length) {
				self.logTicket(5, "No overdue tickets found.");
				return;
			}
			
			async.eachSeries( results.records, function(ticket, callback) {
				// load assignees to get e-mail addresses
				if (!ticket.assignees || !ticket.assignees.length) {
					self.logTicket(9, "Ticket has no assignees, skipping overdue notice (#" + ticket.num + ")");
					return process.nextTick(callback);
				}
				
				self.loadMultipleUsers( ticket.assignees, function(err, users) {
					if (!users || !users.length) {
						self.logError('ticket', "All ticket assignees not found (skipping overdue ticket notice for #" + ticket.num + ")");
						return callback();
					}
					
					// send it
					var args = {
						ticket: ticket,
						users: users
					};
					self.sendOverdueTicketNotice( args, callback );
				}); // loadUser
			} ); // eachSeries
		}); // unbase.search
	}
	
	sendOverdueTicketNotice(args, callback) {
		// send e-mail notification for overdue ticket
		var self = this;
		var ticket = args.ticket;
		
		this.logTicket(6, "Sending overdue notice for ticket: #" + ticket.num, { 
			id: ticket.id, 
			due: ticket.due,
			assignees: ticket.assignees
		} );
		
		// create users hash for getTicketDisplayArgs (assignees)
		var user_list = args.users;
		var recips = [];
		
		args.users = {};
		user_list.forEach( function(user) {
			args.users[ user.username ] = { username: user.username, full_name: user.full_name, email: user.email };
			recips.push( `${user.full_name} <${user.email}>` );
		} );
		
		var email_args = {
			ticket: ticket,
			email_to: recips.join(', '),
			links: {
				ticket_url: this.config.get('base_app_url') + '/#' + ticket.num
			},
			display: this.getTicketDisplayArgs(args)
		};
		
		this.sendFancyMail( 'ticket_overdue', email_args, function(err, body, log) {
			if (err) self.logError('mail', "Failed to send email: " + email_args.email_to + ": " + err, { log } );
			else self.logTicket(7, "Email sent successfully to: " + email_args.email_to );
			callback();
		} );
	}
	
}; // class TicketSystem

module.exports = TicketSystem;
