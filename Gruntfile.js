module.exports = function( grunt ) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON( 'package.json' ),

    // hint the js
    jshint: {
      // Options set based on http://mozweb.readthedocs.org/en/latest/js-style.html
      options: {
        strict: true,
        curly: true,
        newcap: true,
        quotmark: 'single',
        camelcase: true,
        undef: true,
        eqeqeq: true,
        node: true,
        browser: true
      },
      files: [
        'Gruntfile.js',
        'index.js'
      ]
    },

    // bump version numbers
    bump: {
      options: {
       commitMessage: 'version bump to v%VERSION%',
       push: false
      }
    },

    // validate svg files
    validation: {
      options: {
        // always run all tests when this is called
        reset: true,
        // we don't 100% need the xml content type for our SVGs
        relaxerror: [ 'Non-XML Content-Type: .' ],
        // fail the task if other errors found
        failhard: true,
        // prevent report file generation
        reportpath: false
      },
      files: {
        src: [ 'assets/*.svg' ]
      }
    }
  });

  grunt.loadNpmTasks( 'grunt-contrib-jshint' );
  grunt.loadNpmTasks( 'grunt-html-validation' );
  grunt.loadNpmTasks( 'grunt-bump' );

  // default task is to run tests, all we need
  grunt.registerTask( 'default', [ 'jshint', 'validation' ] );
};
