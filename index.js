'use strict';

var moment = require( 'moment' );
var fs = require( 'fs' );
var tmp = require( 'tmp' );
var spawn = require( 'child_process' ).spawn;
var request = require( 'request' );

// take missing details for cert and convert to svg string
function render( recipient, issuer, date, tmplt ) {
	// allow tmplt to be optional
	tmplt = tmplt || __dirname + '/assets/defaultTemplate.svg';
	// allow issuer to be optional
	issuer = issuer || __dirname + '/assets/defaultIssuer.svg';
	// allow date to be optional
	date = date || moment().format('MMMM do, YYYY');

	console.log( tmplt, issuer, date );

	// bad regex to determin if tmplt is a filepath or string
	var isSVGFilePathRegex = /\.svg$/i;

	// check if we need to turn a tmplt file to a string and do it
	if ( isSVGFilePathRegex.test( tmplt ) ) {
		tmplt = fs.readFileSync( tmplt, 'utf-8' );
	}

	// check if we need to turn an issuer file to a string
	if( isSVGFilePathRegex.test( issuer ) ) {
		issuer = fs.readFileSync( issuer, 'utf-8' );
	}

	// update the cert details
	tmplt = tmplt.replace( '{{ recipient }}', recipient );
	tmplt = tmplt.replace( '{{ date }}', date );
	tmplt = tmplt.replace( '{{ issuer }}', issuer );

	return tmplt;
}

// take svg as string and convert it to pdf/png
function localConvert( svg, outputFormat, callback ) {
	// we need a file for a local convert
	outputFormat = outputFormat || 'pdf';

	tmp.tmpName( function( err, tmpFileName ) {
		if( err ) {
			throw err;
		}

		// filenames
		var svgFileName = tmpFileName + '.svg';
		var convertedFileName = tmpFileName + '.' + outputFormat;

		// write an svg file to convert
		fs.writeFileSync( svgFileName, svg );

		// spawn the converter
		var convertor = spawn( 'rsvg-convert', [ '-o', convertedFileName, '-f', outputFormat, svgFileName ] );

		// detect end of convert and call callback w/ response
		convertor.on( 'close', function( code ) {
			if( code === 0 ) {
				callback( fs.readFileSync( convertedFileName ), outputFormat );
			}
		});
	});
}

// take svg as string and convert it remotely using svable to pdf/png
function remoteConvert( svg, outputFormat, svableKey, callback ) {
	outputFormat = outputFormat || 'pdf';

	// we need a tmpfile to stream the converted file response to
	tmp.tmpName( function( err, tmpFileName ) {
		if( err ) {
			throw err;
		}

		// create a file stream for response from remote convert
		var tmpFileStream = fs.createWriteStream( tmpFileName );

		// fire convert request
		var req = request.post({
			uri: 'https://svable.com/api/convert',
			headers: {
				'Authorization': 'Bearer ' + svableKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				content: svg,
				format: outputFormat
			})
		}).pipe( tmpFileStream );

		// handle convert stream errors
		tmpFileStream.on( 'error', function( err ) {
			throw err;
		});

		// handle finish of convert response
		req.on( 'finish', function() {
			callback( fs.readFileSync( tmpFileName ) );
		});
	});
}

// take svg as string, and convert it either locally or remotely
function convert( svg, outputFormat, svableKey, callback ) {
	// thrid param is a callback function, use local convert
	if( typeof svableKey === 'function' ) {
		return localConvert( svg, outputFormat, svableKey );
	}

	// fourth param is a string, assume its an apikey
	if( typeof svableKey === 'string') {
		return remoteConvert( svg, outputFormat, svableKey, callback );
	}

	// svableKey is not a key or a callback, error
	throw new Error( 'Third paramater to convert must be either a callback fucntion OR a svable api key' );
}

// exports
module.exports = {
	convert: convert,
	remoteConvert: remoteConvert,
	localConvert: localConvert,
	render: render,
	generate: function() {}
};
