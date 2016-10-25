var gulp = require('gulp');
var babel = require('gulp-babel');
var runSeq = require('run-sequence');
var plumber = require('gulp-plumber');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var eslint = require('gulp-eslint');
var livereload = require('gulp-livereload');
var ngAnnotate = require('gulp-ng-annotate');
var notify = require('gulp-notify');

gulp.task('reload', function () {
    livereload.reload();
});

gulp.task('lintJS', function () {

    return gulp.src(['./server/**/*.js'])
        .pipe(plumber({
            errorHandler: notify.onError('Linting FAILED! Check your gulp process.')
        }))
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());

});

// Composed tasks
// --------------------------------------------------------------

gulp.task('default', function () {

    //gulp.start('build');

    gulp.watch('server/**/*.js', ['lintJS']);

    livereload.listen();

});

