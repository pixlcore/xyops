#!/usr/bin/env node

// Build xyOps CHANGELOG.md file

var fs = require('fs');
var cp = require('child_process');
var Tools = require('pixl-tools');

// get list of tags
var tags = cp.execSync('git tag --list --sort=version:refname', { encoding: 'utf8' }).trim().split(/\n/).reverse();

var md = '';
md += "# xyOps Changelog\n";

var last_tag = tags.pop();

tags.forEach( function(tag, idx) {
	var prev_tag = tags[idx + 1] || last_tag;
	md += `\n## Version ${tag}\n\n`;
	
	var cmd = `git log ${prev_tag}..${tag} --no-merges --pretty=format:'%h %H %ad %s' --date=short`;
	var lines = cp.execSync(cmd, { encoding: 'utf8' }).trim().split(/\n/);
	var first = true;
	
	// 029a96a 029a96aebd721fe565b1b5c8f2b661564c9017f3 2025-12-30 Version 0.9.2
	lines.forEach( function(line) {
		var matches = line.trim().match(/^(\w+)\s+(\w+)\s+([\d\-]+)\s+(.+)$/);
		if (!matches) return;
		
		var url = 'https://github.com/pixlcore/xyops/commit/' + matches[2];
		
		if (first) {
			md += `> ` + Tools.formatDate( matches[3] + ' 00:00:00', '[mmmm] [mday], [yyyy]' ) + "\n\n";
			first = false;
		}
		
		md += `- [${matches[1]}](${url}): ` + matches[4] + "\n";
	} );
} );

md += `\n## Version ${last_tag}\n\n> December 29, 2025\n\n- Initial beta release!\n`;

fs.writeFileSync( 'CHANGELOG.md', md );
