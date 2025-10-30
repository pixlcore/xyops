// xyOps Secret Utilities
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

const cp = require('child_process');
const assert = require("assert");
const crypto = require('crypto');
const async = require("async");
const Tools = require("pixl-tools");

// AES-256-GCM is the AES block cipher with a 256-bit key, used in Galois/Counter Mode 
// (an AEAD mode providing confidentiality and integrity).
const SEC_ALGO = 'aes-256-gcm';
const SEC_SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

class SecretUtils {
	
	logSecret(level, msg, data) {
		// log debug msg with pseudo-component
		if (this.debugLevel(level)) {
			this.logger.set( 'component', 'Secret' );
			this.logger.print({ category: 'debug', code: level, msg: msg, data: data });
		}
	}
	
	getSecretsForJob(job) {
		// decrypt all applicable secrets for running job
		var env = {};
		
		// first the event
		Tools.mergeHashInto( env, this.getSecretsForType('events', job.event) );
		
		// if job is a workflow, grab secrets for the workflow event too
		if (job.workflow && job.workflow.job && this.activeJobs[ job.workflow.job ]) {
			var wf_job = this.activeJobs[ job.workflow.job ];
			if (wf_job.event != job.event) {
				// for adhoc, these will be the same, so avoid double-decrypting
				Tools.mergeHashInto( env, this.getSecretsForType('events', wf_job.event) );
			}
		}
		
		// now the category
		Tools.mergeHashInto( env, this.getSecretsForType('categories', job.category) );
		
		// and finally the plugin
		Tools.mergeHashInto( env, this.getSecretsForType('plugins', job.plugin) );
		
		// return final merged env
		return env;
	}
	
	getSecretsForType(type, id) {
		// find and decrypt secrets for events, categories or plugins
		var self = this;
		var env = {};
		
		this.secrets.forEach( function(secret) {
			if (!secret.enabled) return;
			if (!secret[type] || !secret[type].includes(id)) return;
			if (!self.secretCache[secret.id]) return;
			
			// always log secret access (use log file for routine use)
			self.logSecret(1, `Using secret ${secret.id} (${secret.title}) for ${type}: ${id}`, { secret, type, id });
			
			// decrypt
			var record = self.secretCache[secret.id];
			var fields = null;
			try {
				fields = self.decryptSecret( record, self.config.get('secret_key'), secret.id );
			}
			catch (err) {
				self.logError('secret', "Failed to decrypt secret: " + err);
				return;
			}
			
			fields.forEach( function(field) { env[ field.name ] = field.value; } );
		} ); // foreach secret
		
		return env;
	}
	
	encryptSecret(secret, passphrase, aad) {
		// encrypt secret object using strong cipher
		const plaintext = JSON.stringify(secret);
		const salt = crypto.randomBytes(16); // per-record KDF salt
		const key = crypto.scryptSync(passphrase, salt, 32, SEC_SCRYPT_OPTS);
		const iv = crypto.randomBytes(12); // 96-bit GCM nonce
		
		const cipher = crypto.createCipheriv(SEC_ALGO, key, iv);
		if (aad) cipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad)));
		
		const ptBuf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
		const ct = Buffer.concat([cipher.update(ptBuf), cipher.final()]);
		const tag = cipher.getAuthTag();
		
		return {
			v: 1,
			alg: SEC_ALGO,
			salt: salt.toString('base64'),
			iv: iv.toString('base64'),
			tag: tag.toString('base64'),
			ct: ct.toString('base64')
		};
	}
	
	decryptSecret(record, passphrase, aad) {
		// decrypt secret previously encrypted with encryptSecret
		// this will throw on error, so wrap in try/catch
		const salt = Buffer.from(record.salt, 'base64');
		const iv = Buffer.from(record.iv, 'base64');
		const tag = Buffer.from(record.tag, 'base64');
		const ct = Buffer.from(record.ct, 'base64');
		
		const key = crypto.scryptSync(passphrase, salt, 32, SEC_SCRYPT_OPTS);
		const decipher = crypto.createDecipheriv(record.alg, key, iv);
		if (aad) decipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad)));
		decipher.setAuthTag(tag);
		
		const buf = Buffer.concat([decipher.update(ct), decipher.final()]);
		return JSON.parse( buf.toString('utf8') );
	}
	
}; // class SecretUtils

module.exports = SecretUtils;
