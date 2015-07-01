var browserify = require('browserify');
var watchify = require('watchify');
var jadeify = require('jadeify');
var notifier = require('node-notifier');
var prettyTime = require('pretty-hrtime');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gulp = require('gulp');
var webserver = require('gulp-webserver');
var gutil = require('gulp-util');
var less = require('gulp-less');
var jade = require('gulp-jade');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var CleanCSS = require('less-plugin-clean-css');
var clui = require('clui');
var merge = require('merge-stream');
var jshint = require('gulp-jshint');
var jsfmt = require('gulp-jsfmt');
var pkg = require('./package.json');
var util = require('util');

gulp.task('default', ['develop', 'serve']);

/**
 * Helper for catching error events on vinyl-source-stream's and showing
 * a nice native notification and printing a cleaner error message to
 * the console.
 */
function notify(titlePrefix) {
  return function(err) {
    var title = titlePrefix + ' error',
      message = err.message;

    if (err.fileName) {
      var filename = err.fileName.replace(__dirname + '/', '');
      title = titlePrefix + ' error' + filename;
    }

    if (err.lineNumber) {
      message = err.lineNumber + ': ' + err.message.split(' in file ')[0].replace(/`/g, '"');
    }

    notifier.notify({
      title: title,
      message: message
    });
    console.log(err);
    gutil.log(gutil.colors.red.bold(title), message);
  };
}

gulp.task('serve', function() {
  return gulp.src('../scout-server/res')
    .pipe(webserver({
      host: 'localhost',
      port: 3000,
      open: true,
      directoryListing: false,
      livereload: true
    }));
});

gulp.task('testserver', function() {
  return gulp.src('../scout-server/res')
    .pipe(webserver({
      host: 'localhost',
      port: 3001
    }));
});

gulp.task('develop', ['pages', 'assets', 'less'], function() {
  gulp.watch(['src/{*,**/*}.less', '../scout-style/*.less'], ['less']);
  gulp.watch(['src/*.jade'], ['pages']);
  gulp.watch(['src/img/*', '../scout-style/images/*'], ['assets']);

  var spinner = new clui.Spinner('Watching for changes...');

  /**
   * Gulp's [fast browserify builds recipe](http://git.io/iiCk-A)
   */
  var bundler = watchify(browserify('./src/index.js', {
    cache: {},
    packageCache: {},
    fullPaths: true,
    debug: false
  }))
    .transform('jadeify')
    .on('update', rebundle);

  function rebundle(changed) {
    var start = process.hrtime();
    if (changed) {
      spinner.stop();
      gutil.log('Changed', '\'' + gutil.colors.cyan(changed[1]) + '\'');
    }

    gutil.log('Starting', '\'' + gutil.colors.cyan('rebundle') + '\'...');
    return bundler.bundle()
      .on('error', notify('js'))
      .pipe(source('index.js'))
      .pipe(gulp.dest('../scout-server/res/'))
      .on('end', function() {
        var time = prettyTime(process.hrtime(start));
        gutil.log('Finished', '\'' + gutil.colors.cyan('rebundle') + '\'',
          'after', gutil.colors.magenta(time));
        spinner.start();
        try {
          require('remote').getCurrentWindow().reload();
        } catch (e) {}
      });
  }
  return rebundle();
});

// Compile LESS to CSS.
gulp.task('less', function() {
  return gulp.src('src/*.less')
    .pipe(sourcemaps.init())
    .pipe(less(pkg.less))
    .on('error', notify('less'))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest('../scout-server/res'));
});

// Compile jade templates to HTML files.
gulp.task('pages', function() {
  return gulp.src('src/index.jade')
    .pipe(jade())
    .on('error', notify('jade'))
    .pipe(gulp.dest('../scout-server/res'));
});

// Copies all static asset files into dist
gulp.task('assets', function() {
  var subtasks = [];
  subtasks.push(gulp.src('src/img/{*,**/*}').pipe(gulp.dest('../scout-server/res/img')));

  subtasks.push.apply(subtasks, pkg.fonts.map(function(p) {
    return gulp.src(p).pipe(gulp.dest('../scout-server/res/fonts'));
  }));
  subtasks.push(gulp.src('../scout-style/fonts/*').pipe(gulp.dest('../scout-server/res/fonts')));
  subtasks.push(gulp.src('../scout-style/images/*').pipe(gulp.dest('../scout-server/res/images')));

  return merge.apply(null, subtasks);
});

// Build in production mode.
gulp.task('build', ['assets', 'pages'], function() {
  var js = browserify('./src/index.js')
    .transform(jadeify)
    .bundle()
    .pipe(source('index.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest('../scout-server/res/'));

  // Setup less plugin that will clean and compress.
  var cleaner = new CleanCSS({
    root: __dirname + '/src',
    keepSpecialComments: 0,
    advanced: true
  });

  var css = gulp.src('src/*.less')
    .pipe(less({
      plugins: [cleaner],
      paths: pkg.less.paths
    }))
    .pipe(gulp.dest('../scout-server/res'));

  return merge(js, css);
});
