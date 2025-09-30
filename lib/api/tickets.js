// xyOps API Layer - Tickets
// Copyright (c) 2019 - 2025 PixlCore LLC
// Released under the PixlCore Sustainable Use License.
// See the LICENSE.md file in this repository.

var fs = require('fs');
var assert = require("assert");
var Path = require('path');
var async = require('async');
var Tools = require("pixl-tools");

class Tickets {
	
	api_get_ticket(args, callback) {
		// load single ticket using id or number
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!params.id && !params.num) {
			return this.doError('ticket', "No ticket ID or number specified.", callback);
		}
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (params.id) {
				self.unbase.get( 'tickets', params.id, function(err, record) {
					if (err) return self.doError('ticket', "Failed to load ticket: " + params.id + ": " + (err.message || err), callback );
					callback({ code: 0, ticket: record });
				}); // unbase.get
			}
			else if (params.num) {
				self.unbase.search( 'tickets', 'num:' + params.num, { offset:0, limit:1 }, function(err, results) {
					if (err) return self.doError('ticket', "Failed to load ticket: #" + params.num + ": " + (err.message || err), callback );
					if (!results || !results.records || !results.records[0] || !results.records[0].num) {
						return self.doError( 'ticket', "Ticket not found: " + params.num, callback );
					}
					callback({ code: 0, ticket:  results.records[0] });
				}); // unbase.search
			}
		}); // loadSession
	}
	
	api_search_tickets(args, callback) {
		// search for tickets
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			query: /\S/
		}, callback)) return;
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		var compact = !!(params.compact == 1);
		delete params.compact;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'tickets', params.query, params, function(err, results) {
				if (err) return self.doError('ticket', "Failed DB search: " + err, callback);
				
				if (!results.total && params.query.match(/^\d+$/)) {
					// if no results and simple number query, recurse and try 'num' index
					args.query.query = 'num:' + params.query;
					return self.api_search(args, callback);
				}
				else if (!results.total && !params.query.match(/(\:|\*|\()/)) {
					// if no results and simple query with no field specified, recurse and try 'changes' index
					args.query.query = 'changes:' + params.query;
					return self.api_search(args, callback);
				}
				
				if (compact && results.total) {
					// scrub verbose params
					results.records.forEach( function(record) {
						delete record.body;
						record.changes = record.changes ? record.changes.length : 0;
					});
				}
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// make response compatible with UI pagination tools
				callback({
					code: 0,
					rows: results.records,
					list: { length: results.total || 0 }
				});
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_create_ticket(args, callback) {
		// add new ticket
		var self = this;
		var params = args.params;
		
		// auto-generate unique ID if not specified
		if (!params.id) params.id = Tools.generateShortID('t');
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			subject: /\S/,
			// body: /\S/
		}, callback)) return;
		
		if (!this.requireValidTicketParams(params, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'create_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			if (!('num' in params)) {
				params.num = self.getState('next_ticket_num') || 1;
				self.putState('next_ticket_num', params.num + 1);
			}
			params.created = params.modified = Tools.timeNow(true);
			
			// create first change
			params.changes = [{
				type: 'change',
				username: user.username || user.id,
				date: params.created,
				key: 'created'
			}];
			
			// massage params
			if (!params.username) params.username = user.username || user.id;
			params.assignee = params.assignee || '';
			
			if (!params.body) params.body = '';
			if (!params.status) params.status = 'open';
			if (!params.due) params.due = 0;
			if (!params.cc) params.cc = [];
			if (!params.notify) params.notify = [];
			if (!params.tags) params.tags = [];
			
			params.subject = params.subject.toString().replace(/<.+>/g, '');
			params.body = self.sanitizeMarkdown( params.body );
			
			self.logDebug(6, "Creating new ticket: " + params.id, params);
			
			self.unbase.insert( 'tickets', params.id, params, function(err) {
				// record is fully indexed
				if (err) return self.doError('ticket', "Failed to create ticket: " + err, callback);
				
				callback({ code: 0, ticket: params });
				
				self.logDebug(6, "Successfully created ticket: " + params.id, params);
				self.logTransaction('ticket_create', params.id, self.getClientInfo(args, { 
					ticket: Tools.copyHashRemoveKeys(params, { changes: 1 }), 
					keywords: [ params.id ] 
				}));
				
				// scan for user triggers (search alerts)
				if (params.status != 'draft') self.processTicketChange(params.id, params.changes);
				
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_ticket(args, callback) {
		// update existing ticket
		// allow for sparse updates
		var self = this;
		var params = args.params;
		
		if (!this.requireValidTicketParams(params, callback)) return;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Updating ticket: " + params.id, params);
			
			var ticket = null;
			var lock_key = 'cpt_' + params.id;
			
			async.series([
				function(callback) {
					// acquire ex lock for ticket
					self.storage.lock( lock_key, true, callback );
				},
				function(callback) {
					// load ticket
					self.unbase.get( 'tickets', params.id, function(err, record) {
						if (err) return callback(err);
						ticket = record;
						callback();
					}); // unbase.get
				}
			], 
			function(err) {
				if (err) {
					self.storage.unlock( lock_key );
					return self.doError('ticket', "Failed to load ticket: " + params.id + ": " + err, callback);
				}
				
				var now = Tools.timeNow(true);
				params.modified = now;
				
				if (params.subject) {
					params.subject = params.subject.toString().replace(/<.+>/g, '');
				}
				if (params.body) {
					params.body = self.sanitizeMarkdown( params.body );
				}
				
				// detect changes here, create list, pass down to trigger system
				var changes = self.detectTicketChanges(args, ticket, params);
				if (changes.length) {
					params.changes = self.pruneRedundantChanges( (ticket.changes || []).concat( changes ) );
				}
				
				// perform database update
				self.unbase.update( 'tickets', params.id, params, function(err) {
					self.storage.unlock( lock_key );
					if (err) {
						return self.doError('ticket', "Failed to update ticket: " + params.id + ": " + err, callback);
					}
					
					callback({ 
						code: 0, 
						ticket: Tools.mergeHashes(ticket, params) 
					});
					
					self.logDebug(6, "Successfully updated ticket: " + params.id, params);
					self.logTransaction('ticket_update', params.id, self.getClientInfo(args, { 
						ticket: Tools.copyHashRemoveKeys( Tools.mergeHashes(ticket, params), { changes: 1 } ), 
						keywords: [ params.id ] 
					}));
					
					// scan for user triggers (search alerts)
					self.processTicketChange(params.id, changes);
				}); // unbase.update
			}); // async.series
		} ); // loadSession
	}
	
	api_add_ticket_change(args, callback) {
		// add change to ticket (e.g. comment)
		// change: { type, body? }
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		if (!params.change) {
			return self.doError('ticket', "Missing required 'change' parameter.", callback);
		}
		if (!params.change.type) {
			return self.doError('ticket', "Change requires a 'type' parameter.", callback);
		}
		
		var change = params.change;
		delete params.change;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			change.id = Tools.generateShortID('c');
			change.username = user.username || user.id;
			change.date = Tools.timeNow(true);
			
			if (change.body) {
				change.body = self.sanitizeMarkdown( change.body );
			}
			
			self.logDebug(6, "Updating ticket: " + params.id, params);
			
			var ticket = null;
			var lock_key = 'cpt_' + params.id;
			
			async.series([
				function(callback) {
					// acquire ex lock for ticket
					self.storage.lock( lock_key, true, callback );
				},
				function(callback) {
					// load ticket
					self.unbase.get( 'tickets', params.id, function(err, record) {
						if (err) return callback(err);
						ticket = record;
						callback();
					}); // unbase.get
				}
			], 
			function(err) {
				if (err) {
					self.storage.unlock( lock_key );
					return self.doError('ticket', "Failed to load ticket: " + params.id + ": " + err, callback);
				}
				
				var now = Tools.timeNow(true);
				params.modified = now;
				
				params.changes = ticket.changes || [];
				params.changes.push( change );
				
				// perform database update
				self.unbase.update( 'tickets', params.id, params, function(err) {
					self.storage.unlock( lock_key );
					if (err) {
						return self.doError('ticket', "Failed to update ticket: " + params.id + ": " + err, callback);
					}
					
					callback({ 
						code: 0, 
						ticket: Tools.mergeHashes(ticket, params) 
					});
					
					self.logDebug(6, "Successfully updated ticket: " + params.id, params);
					self.logTransaction('ticket_add_change', params.id, self.getClientInfo(args, { 
						ticket: { id: ticket.id, num: ticket.num, subject: ticket.subject },
						change: change, 
						keywords: [ params.id ] 
					}));
					
					// scan for user triggers (search alerts)
					self.processTicketChange(params.id, [change]);
				}); // unbase.update
			}); // async.series
			
		} ); // loadSession
	}
	
	api_update_ticket_change(args, callback) {
		// update or delete change in ticket (e.g. comment)
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			change_id: /^\w+$/
		}, callback)) return;
		
		var change_id = params.change_id;
		delete params.change_id;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Updating ticket: " + params.id, params);
			
			var ticket = null;
			var lock_key = 'cpt_' + params.id;
			
			async.series([
				function(callback) {
					// acquire ex lock for ticket
					self.storage.lock( lock_key, true, callback );
				},
				function(callback) {
					// load ticket
					self.unbase.get( 'tickets', params.id, function(err, record) {
						if (err) return callback(err);
						ticket = record;
						callback();
					}); // unbase.get
				}
			], 
			function(err) {
				if (err) {
					self.storage.unlock( lock_key );
					return self.doError('ticket', "Failed to load ticket: " + params.id + ": " + err, callback);
				}
				
				var old_change = Tools.findObject( ticket.changes, { id: change_id } );
				if (!old_change) {
					self.storage.unlock( lock_key );
					return self.doError('ticket', "Change not found in ticket: " + params.id + '/' + change_id, callback);
				}
				// check username or ensure admin
				var username = user.username || user.id;
				var privs = self.getComputedPrivileges(user);
				if ((old_change.username != username) && !privs.admin) {
					self.storage.unlock( lock_key );
					return self.doError('ticket', "You do not have the required privileges to update comments posted by others.", callback);
				}
				
				var changes = [];
				var now = Tools.timeNow(true);
				params.modified = now;
				
				if (params.delete) {
					// delete change
					Tools.deleteObject( ticket.changes, { id: change_id } );
					params.changes = ticket.changes;
					delete params.delete;
					
					// add change for deletion (if not a draft)
					if (ticket.status != 'draft') {
						params.changes.push({
							type: 'change',
							username: username,
							date: now,
							key: 'delete'
							// description: "deleted comment."
						});
						changes = params.changes.slice(-1);
					}
					
					old_change.delete = true; // for activity
				}
				else {
					// update change
					if (!params.change) {
						self.storage.unlock( lock_key );
						return self.doError('ticket', "Missing required 'change' parameter.", callback);
					}
					if (params.change.body) {
						params.change.body = self.sanitizeMarkdown( params.change.body );
					}
					params.change.edited = now;
					Tools.mergeHashInto( old_change, params.change );
					params.changes = ticket.changes;
					delete params.change;
				}
				
				// perform database update
				self.unbase.update( 'tickets', params.id, params, function(err) {
					self.storage.unlock( lock_key );
					if (err) {
						return self.doError('ticket', "Failed to update ticket: " + params.id + ": " + err, callback);
					}
					
					callback({ 
						code: 0, 
						ticket: Tools.mergeHashes(ticket, params) 
					});
					
					self.logDebug(6, "Successfully updated ticket: " + params.id, params);
					self.logTransaction('ticket_update_change', params.id, self.getClientInfo(args, { 
						ticket: { id: ticket.id, num: ticket.num, subject: ticket.subject },
						change: old_change, 
						keywords: [ params.id ] 
					}));
					
					// scan for user triggers (search alerts)
					self.processTicketChange(params.id, changes);
					
				}); // unbase.update
			}); // async.series
		} ); // loadSession
	}
	
	api_upload_user_ticket_files(args, callback) {
		// upload files for ticket, used inside of codemirror editor
		// add `save` param to add to the ticket
		var self = this;
		var params = args.params;
		var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( this.config.get('file_expiration') );
		if (!this.requireMaster(args, callback)) return;
		
		if (!args.files || !Tools.firstKey(args.files)) {
			return this.doError('file', "No file upload data found in request.", callback);
		}
		
		if (!this.requireParams(params, {
			ticket: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			var storage_key_prefix = 'files/' + params.ticket + '/' + (user.username || user.id) + '/' + Tools.generateUniqueBase64(16);
			var files = [];
			
			async.eachSeries( Object.values(args.files),
				function(file, callback) {
					// process single file upload
					var temp_file = file.path;
					var filename = self.cleanFilename( Path.basename(file.name) );
					var url_filename = self.cleanURLFilename( Path.basename(file.name) );
					var storage_key = storage_key_prefix + '/' + url_filename;
					
					// storage key must have a file extension to be considered binary
					if (!self.storage.isBinaryKey(storage_key)) storage_key += '.bin';
					
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						if (err) return callback(err);
						
						files.push({
							id: Tools.generateShortID('f'),
							date: Tools.timeNow(true),
							filename: filename, 
							path: storage_key, 
							size: file.size,
							username: user.username || user.id,
							ticket: params.ticket
						});
						
						// set expiration date for file (fires off background task)
						self.storage.expire( storage_key, exp_epoch );
						
						callback();
					} ); // putStream
				},
				function(err) {
					if (err) return self.doError('file', "Failed to process uploaded files: " + err, callback);
					if (!params.save) return callback({ code: 0, files: files });
					
					// save files to ticket
					self.unbase.update( 'tickets', params.ticket, function(ticket) {
						// perform updates here or bail out (inside unbase lock block)
						self.logDebug(5, "Adding files to ticket: " + params.ticket, files);
						
						if (!ticket.files) ticket.files = [];
						ticket.files = ticket.files.concat( files );
						
						return { files: ticket.files };
					}, 
					function(err, ticket) {
						// done with update (and unlocked)
						if (err && (err === "ABORT")) return; // update was aborted and callback was handled
						if (err) return self.doError('job', "Failed to update ticket: " + params.ticket + ": " + err, callback);
						
						callback({ code: 0, files: ticket.files });
					} ); // unbase.update
				}
			); // async.eachSeries
		} ); // loaded session
	}
	
	api_delete_ticket_file(args, callback) {
		// delete file from ticket
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			path: /^\S+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'edit_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting ticket file: " + params.path, params);
			
			self.unbase.update( 'tickets', params.id, function(ticket) {
				// perform updates here or bail out (inside unbase lock block)
				if (!ticket.files) ticket.files = [];
				if (!Tools.deleteObject(ticket.files, { path: params.path })) {
					return self.doError('ticket', "Ticket file not found: " + params.path, callback);
				}
				
				return { files: ticket.files };
			}, 
			function(err, ticket) {
				// done with update (and unlocked)
				if (err && (err === "ABORT")) return; // update was aborted and callback was handled
				if (err) return self.doError('job', "Failed to update ticket: " + params.id + ": " + err, callback);
				
				// now delete actual file
				self.storage.delete( params.path, function(err) {
					if (err) return self.doError('ticket', "Failed to delete file: " + params.path + ": " + err, callback);
					callback({ code: 0, files: ticket.files });
				}); // storage.delete
			} ); // unbase.update
		}); // loadSession
	}
	
	api_delete_ticket(args, callback) {
		// delete existing ticket
		// (this API waits for the full unbase unindex)
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'delete_tickets', callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting ticket: " + params.id, params);
			
			// first get existing ticket
			self.unbase.get( 'tickets', params.id, function(err, old) {
				if (err) return self.doError('ticket', "Failed to delete ticket: " + params.id + ": " + err, callback);
				
				self.unbase.delete( 'tickets', params.id, function(err) {
					if (err) return self.doError('ticket', "Failed to delete ticket: " + params.id + ": " + err, callback);
					callback({ code: 0 });
					
					self.logTransaction('ticket_delete', params.id, self.getClientInfo(args, { 
						params: params, 
						ticket: Tools.copyHashRemoveKeys(old, { changes: 1 }), 
						keywords: [ params.id ]
					}));
				} ); // unbase.delete
			} ); // unbase.get
		} ); // loadSession
	}
	
	requireValidTicketParams(params, callback) {
		// validate all ticket params
		if (params.cc && !Array.isArray(params.cc)) return this.doError('ticket', "Malformed ticket parameter: cc", callback);
		if (params.notify && !Array.isArray(params.notify)) return this.doError('ticket', "Malformed ticket parameter: notify", callback);
		if (params.changes && !Array.isArray(params.changes)) return this.doError('ticket', "Malformed ticket parameter: changes", callback);
		if (params.tags && !Array.isArray(params.tags)) return this.doError('ticket', "Malformed ticket parameter: tags", callback);
		
		if (params.type && !Tools.findObject( this.config.getPath('ui.ticket_types'), { id: params.type } )) {
			return this.doError('ticket', "Unknown ticket type: " + params.type, callback);
		}
		if (params.status && !Tools.findObject( this.config.getPath('ui.ticket_statuses'), { id: params.status } )) {
			return this.doError('ticket', "Unknown ticket status: " + params.status, callback);
		}
		if (params.due && (typeof(params.due) != 'number')) {
			return this.doError('ticket', "Malformed ticket parameter: due", callback);
		}
		
		if (params.tags && params.tags.length) {
			for (var idx = 0, len = params.tags.length; idx < len; idx++) {
				var tag = params.tags[idx];
				if (!Tools.findObject(this.tags, { id: tag })) {
					return this.doError('ticket', "Unknown tag: " + tag, callback);
				}
			}
		}
		
		return true;
	}

	
}; // class Tickets

module.exports = Tickets;
