/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var moment = require( 'moment' );
var fs = require( 'fs' );
var tmp = require( 'tmp' );
var spawn = require( 'child_process' ).spawn;
var request = require( 'request' );

/**
 * Render certificate
 *
 * Takes given information and generates the SVG for a certificate
 * using that and some template files, either provided or default.
 *
 * @param  {String} recipient Name of the certificate recipient
 * @param  {String} [issuer]  Path to issuer signature file (SVG)
 * @param  {String} [date]    Human readable date the certificate was issued
 * @param  {String} [tmplt]   Path to certificate template file
 * @return {String}           Rendered SVG for the cert' as a string
 */
function render( recipient, issuer, date, tmplt ) {
  // allow tmplt to be optional
  tmplt = tmplt || __dirname + '/assets/defaultTemplate.svg';
  // allow issuer to be optional
  issuer = issuer || __dirname + '/assets/defaultIssuer.svg';
  // allow date to be optional
  date = date || moment().format('MMMM Do, YYYY');

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

/**
 * Local convert of SVG to PNG/PDF (requires librsvg)
 *
 * @param  {String}   svg          SVG to covnert
 * @param  {String}   outputFormat Either 'png' OR 'pdf' OR `undefined`
 * @param  {Function} callback     Called once complete w/ the converted file-blob
 */
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

/**
 * Remotely convert an SVG into PNG/PDF using Svable
 *
 * @param  {String}   svg          SVG to convert
 * @param  {String}   outputFormat Either 'png' OR 'pdf' OR `undefined`
 * @param  {String}   svableKey    API Key for Svable conversion
 * @param  {Function} callback     Called once conversion complete w/ the converted file-blob
 */
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

/**
 * Convert an SVG into a PNG/PDF
 *
 * Takes an SVG as a string, and converts it either locally or remotely
 * depending on if an API key for svable is provided
 *
 * @param  {String}   svg          SVG to convert (as a string)
 * @param  {String}   outputFormat Either 'png' OR 'pdf' OR `undefined`
 * @param  {String}   [svableKey]  API Key for Svable (remote) conversion
 * @param  {Function} callback     Called once conversion is complete w/ the converted file-blob
 */
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
  render: render
};
