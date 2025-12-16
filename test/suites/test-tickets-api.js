const assert = require('node:assert/strict');
const Tools = require('pixl-tools');
const async = require('async');

exports.tests = [

    async function test_api_search_tickets_empty(test) {
        // search with a unique token expecting zero results
        const token = 'NO-TICKETS-TOKEN-' + Date.now();
        let { data } = await this.request.json( this.api_url + '/app/search_tickets/v1', {
            query: token,
            offset: 0,
            limit: 1,
            compact: true
        });
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( Array.isArray(data.rows) && data.rows.length === 0, 'expected zero rows' );
        assert.ok( data.list && (data.list.length === 0), 'expected list length = 0' );
    },

    async function test_api_get_ticket_missing_params(test) {
        // missing id and num should error
        let { data } = await this.request.json( this.api_url + '/app/get_ticket/v1', {} );
        assert.ok( !!data.code, 'expected error for missing id/num' );
    },

    async function test_api_get_tickets_missing_ids(test) {
        // get_tickets requires ids array
        let { data } = await this.request.json( this.api_url + '/app/get_tickets/v1', {} );
        assert.ok( !!data.code, 'expected error for missing ids' );
    },

    async function test_api_create_ticket_missing_subject(test) {
        // missing required subject
        let { data } = await this.request.json( this.api_url + '/app/create_ticket/v1', {
            type: 'issue',
            status: 'open'
        });
        assert.ok( !!data.code, 'expected error for missing subject' );
    },

    async function test_api_create_ticket(test) {
        // create a new ticket
        this.ticket_search_token = 'TICKET-SEARCH-' + Date.now();
        let { data } = await this.request.json( this.api_url + '/app/create_ticket/v1', {
            subject: 'Unit Test Ticket',
            type: 'issue',
            status: 'open',
            assignees: ['admin'],
            tags: ['important'],
            body: 'Body includes unique token: ' + this.ticket_search_token
        });
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( data.ticket && data.ticket.id, 'expected ticket in response' );
        assert.ok( typeof data.ticket.num === 'number', 'expected ticket number' );
        
        // save for later
        this.ticket_id = data.ticket.id;
        this.ticket_num = data.ticket.num;
    },

    async function test_api_get_ticket_by_id(test) {
        // fetch the new ticket by id
        let { data } = await this.request.json( this.api_url + '/app/get_ticket/v1', { id: this.ticket_id } );
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( data.ticket && data.ticket.id === this.ticket_id, 'ticket id unexpected' );
    },

    async function test_api_get_ticket_by_num(test) {
        // fetch the new ticket by number (requires background index of num)
        const self = this;
        const result = await new Promise((resolve, reject) => {
            async.retry({ times: 10, interval: 300 }, function(cb) {
                self.request.json( self.api_url + '/app/get_ticket/v1', { num: self.ticket_num } )
                    .then(({ data }) => {
                        if (data && data.code === 0 && data.ticket && data.ticket.id === self.ticket_id) return cb(null, data);
                        return cb(new Error('Ticket number not indexed yet'));
                    })
                    .catch(cb);
            }, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
        assert.ok( result.code === 0, 'successful api response' );
        assert.ok( result.ticket && result.ticket.id === this.ticket_id, 'ticket id unexpected from number fetch' );
    },

    async function test_api_update_ticket_missing_id(test) {
        // update without id should error
        let { data } = await this.request.json( this.api_url + '/app/update_ticket/v1', { status: 'closed' } );
        assert.ok( !!data.code, 'expected error for missing id' );
    },

    async function test_api_update_ticket(test) {
        // update the ticket (shallow merge)
        let { data } = await this.request.json( this.api_url + '/app/update_ticket/v1', {
            id: this.ticket_id,
            status: 'closed',
            tags: ['important', 'flag']
        });
        assert.ok( data.code === 0, 'successful api response' );
    },

    async function test_api_get_updated_ticket(test) {
        // verify update took
        let { data } = await this.request.json( this.api_url + '/app/get_ticket/v1', { id: this.ticket_id } );
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( data.ticket && data.ticket.status === 'closed', 'unexpected ticket status' );
        assert.ok( Array.isArray(data.ticket.tags) && data.ticket.tags.includes('flag'), 'unexpected ticket tags' );
    },

    async function test_api_add_ticket_change_missing_change(test) {
        // add_ticket_change missing change should error
        let { data } = await this.request.json( this.api_url + '/app/add_ticket_change/v1', {
            id: this.ticket_id
        });
        assert.ok( !!data.code, 'expected error for missing change' );
    },

    async function test_api_add_ticket_comment(test) {
        // add a comment change
        const comment = 'Investigating issue now.';
        let { data } = await this.request.json( this.api_url + '/app/add_ticket_change/v1', {
            id: this.ticket_id,
            change: { type: 'comment', body: comment }
        });
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( data.ticket && Array.isArray(data.ticket.changes), 'expected changes array' );
        const change = Tools.findObject( data.ticket.changes, { type: 'comment', body: comment } );
        assert.ok( change && change.id, 'expected new comment change with id' );
        
        // save change id for later
        this.ticket_change_id = change.id;
    },

    async function test_api_update_ticket_change_missing_change_id(test) {
        // missing change_id should error
        let { data } = await this.request.json( this.api_url + '/app/update_ticket_change/v1', {
            id: this.ticket_id,
            change: { body: 'oops' }
        });
        assert.ok( !!data.code, 'expected error for missing change_id' );
    },

    async function test_api_update_ticket_comment(test) {
        // edit existing comment
        const newBody = 'Updated findings after deeper analysis.';
        let { data } = await this.request.json( this.api_url + '/app/update_ticket_change/v1', {
            id: this.ticket_id,
            change_id: this.ticket_change_id,
            change: { body: newBody }
        });
        assert.ok( data.code === 0, 'successful api response' );
        const change = Tools.findObject( data.ticket.changes, { id: this.ticket_change_id } );
        assert.ok( change && change.body === newBody, 'expected updated comment body' );
        assert.ok( !!change.edited, 'expected edited timestamp' );
    },

    async function test_api_upload_user_ticket_files_missing_files(test) {
        // upload with no files should error
        let { data: raw } = await this.request.post( this.api_url + '/app/upload_user_ticket_files/v1', {
            data: { json: JSON.stringify({ ticket: this.ticket_id, save: true }) }
        });
        let body = (typeof raw === 'string') ? raw : raw.toString();
        let data = {};
        try { data = JSON.parse(body); }
        catch (err) { assert.ok(false, 'invalid JSON response for upload_user_ticket_files (neg)'); }
        assert.ok( !!data.code, 'expected error for missing files' );
    },

    async function test_api_upload_user_ticket_files(test) {
        // upload file and attach to ticket
        let { data: raw } = await this.request.post( this.api_url + '/app/upload_user_ticket_files/v1', {
            data: { json: JSON.stringify({ ticket: this.ticket_id, save: true }) },
            files: { file1: 'test/fixtures/rgb-ramp.png' }
        });
        let body = (typeof raw === 'string') ? raw : raw.toString();
        let data = {};
        try { data = JSON.parse(body); }
        catch (err) { assert.ok(false, 'invalid JSON response for upload_user_ticket_files'); }
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( Array.isArray(data.files) && data.files.length >= 1, 'expected files array with an item' );
        const file = Tools.findObject( data.files, { filename: 'rgb-ramp.png' } );
        assert.ok( file && file.path, 'expected uploaded rgb-ramp.png file with path' );
        this.ticket_file_path = file.path;
    },

    async function test_api_delete_ticket_file_missing_path(test) {
        // delete without path should error
        let { data } = await this.request.json( this.api_url + '/app/delete_ticket_file/v1', {
            id: this.ticket_id
        });
        assert.ok( !!data.code, 'expected error for missing path' );
    },

    async function test_api_delete_ticket_file(test) {
        // delete uploaded file
        let { data } = await this.request.json( this.api_url + '/app/delete_ticket_file/v1', {
            id: this.ticket_id,
            path: this.ticket_file_path
        });
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( !Tools.findObject(data.files, { path: this.ticket_file_path }), 'uploaded file should be deleted' );
    },

    async function test_api_search_tickets_retry(test) {
        // search for our created ticket using background indexing retry
        const token = this.ticket_search_token;
        const self = this;
        const result = await new Promise((resolve, reject) => {
            async.retry({ times: 10, interval: 300 }, function(cb) {
                self.request.json( self.api_url + '/app/search_tickets/v1', {
                    query: token,
                    offset: 0,
                    limit: 50,
                    compact: true
                }).then(({ data }) => {
                    if (data && data.code === 0 && Array.isArray(data.rows) && Tools.findObject(data.rows, { id: self.ticket_id })) {
                        return cb(null, data);
                    }
                    return cb(new Error('Ticket not indexed yet'));
                }).catch(cb);
            }, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
        assert.ok( result && result.code === 0, 'successful api response' );
        assert.ok( Tools.findObject(result.rows, { id: this.ticket_id }), 'expected ticket in search results' );
        assert.ok( result.list && (result.list.length >= 1), 'expected list length >= 1' );
    },

    async function test_api_get_tickets_mixed(test) {
        // get_tickets with one valid and one missing id
        let { data } = await this.request.json( this.api_url + '/app/get_tickets/v1', {
            ids: [ this.ticket_id, 'nope' ],
            verbose: false
        });
        assert.ok( data.code === 0, 'successful api response' );
        assert.ok( Array.isArray(data.tickets) && data.tickets.length === 2, 'expected two entries' );
        assert.ok( data.tickets[0] && data.tickets[0].id === this.ticket_id, 'first entry should be our ticket' );
        assert.ok( data.tickets[1] && data.tickets[1].err, 'second entry should contain err' );
    },

    async function test_api_delete_ticket_missing_id(test) {
        // delete without id should error
        let { data } = await this.request.json( this.api_url + '/app/delete_ticket/v1', {} );
        assert.ok( !!data.code, 'expected error for missing id' );
    },

    async function test_api_delete_ticket(test) {
        // delete our ticket
        let { data } = await this.request.json( this.api_url + '/app/delete_ticket/v1', { id: this.ticket_id } );
        assert.ok( data.code === 0, 'successful api response' );
    },

    async function test_api_get_ticket_deleted(test) {
        // ensure ticket is gone
        let { data } = await this.request.json( this.api_url + '/app/get_ticket/v1', { id: this.ticket_id } );
        assert.ok( !!data.code, 'expected error for missing ticket' );
        delete this.ticket_id;
        delete this.ticket_num;
        delete this.ticket_change_id;
        delete this.ticket_file_path;
        delete this.ticket_search_token;
    }

];
