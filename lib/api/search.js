// Orchestra API Layer - Search
// Copyright (c) 2022 - 2024 Joseph Huckaby
// Released under the MIT License

const fs = require('fs');
const Path = require('path');
const assert = require("assert");
const async = require('async');
const Tools = require("pixl-tools");

class Search {

	api_search_jobs(args, callback) {
		// search unbase for completed jobs
		// { query, offset, limit, sort_by, sort_dir, verbose }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		// if (!this.requireParams(params, {
		// 	query: /\S/
		// }, callback)) return;
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = 'completed';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'jobs', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// prune verbose props unless requested
				if (!params.verbose) results.records.forEach( function(job) {
					delete job.actions;
					delete job.activity;
					delete job.html;
					delete job.limits;
					delete job.procs;
					delete job.conns;
					delete job.table;
					delete job.timelines;
				} );
				
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
	
	api_search_servers(args, callback) {
		// search unbase for historical servers
		// { query, offset, limit, sort_by, sort_dir, verbose }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = 'hostname';
		if (!params.sort_dir) params.sort_dir = 1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'servers', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
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
	
	api_get_server_summaries(args, callback) {
		// get all server field summaries and labels (OSes, CPUs, etc.)
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var index = self.unbase.getIndex('servers');
			var fields = ['os_platform', 'os_distro', 'os_release', 'os_arch', 'cpu_virt', 'cpu_brand', 'cpu_cores'];
			var keys = fields.map( function(field_id) { return index.base_path + '/' + field_id + '/summary'; } );
			
			self.storage.getMulti( keys, function(err, records) {
				if (err) {
					self.logError('db', "Failed to get server summaries: " + err + " (no servers added yet?)", { keys });
					records = [];
				}
				
				// convert array to hash
				var summaries = {};
				fields.forEach( function(field_id, idx) {
					summaries[field_id] = records[idx] || {};
				} );
				
				callback({ code: 0, summaries });
			} ); // getMulti
		}); // loadSession
	}
	
	api_search_alerts(args, callback) {
		// search unbase for historical or active alerts
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'alerts', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
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
	
	api_search_snapshots(args, callback) {
		// search unbase for snapshots
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		if (!this.requireMaster(args, callback)) return;
		var params = Tools.mergeHashes( args.params, args.query );
		if (!params.query) params.query = '*';
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.search( 'snapshots', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				if (!results.records) results.records = [];
				
				self.setCacheResponse(args, self.config.get('ttl'));
				
				// prune verbose props unless requested
				if (!params.verbose) results.records.forEach( function(snapshot) {
					if (!snapshot.data) snapshot.data = {};
					delete snapshot.data.conns;
					delete snapshot.data.processes;
					delete snapshot.data.mounts;
					delete snapshot.data.commands;
				} );
				
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
	
}; // class Search

module.exports = Search;
