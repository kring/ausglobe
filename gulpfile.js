var gulp = require('gulp');  
var browserify = require('gulp-browserify');  
var concat = require('gulp-concat');  
var jshint = require('gulp-jshint');
var jsdoc = require('gulp-jsdoc');
var uglify = require('gulp-uglify');
var jasmine = require('gulp-jasmine');
var exec = require('child_process').exec;
var rjs = require('gulp-requirejs');

//TODO: figure out if there's any value to this
//var refresh = require('gulp-livereload');  
//var lr = require('tiny-lr');  
//var server = lr();

gulp.task('scripts', function() {  
    gulp.src(['src/index.js'])
        .pipe(browserify({ standalone:'ausglobe' }))
        .pipe(concat('ausglobe.js'))
        .pipe(gulp.dest('src/build'));
        
    gulp.src(['src/build/ausglobe.js'])
        .pipe(uglify())
        .pipe(concat('ausglobe.min.js'))
        .pipe(gulp.dest('src/build'));

    gulp.src(['src/copyrightHeader.js', 'src/build/ausglobe.js'])
        .pipe(concat('ausglobe.js'))
        .pipe(gulp.dest('public'));
        
    gulp.src(['src/copyrightHeader.js', 'src/build/ausglobe.min.js'])
        .pipe(concat('ausglobe.min.js'))
        .pipe(gulp.dest('public'));
        
//        .pipe(refresh(server))
})

gulp.task('lint', function(){
    gulp.src('src/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('docs', function(){
    gulp.src('src/*.js')
        .pipe(jsdoc('./public/doc'));
});

gulp.task('test', function () {
    return gulp.src('public/specs/*.js')
        .pipe(jasmine());
});

/*
gulp.task('lr-server', function() {  
    server.listen(35729, function(err) {
        if(err) return console.log(err);
    });
})
*/

gulp.task('build-cesium', function(cb) {
    return exec('"Tools/apache-ant-1.8.2/bin/ant" build', {
        cwd : 'public/cesium'
    }, function(err, stdout, stderr) {
        if (stderr) {
            console.log('Error while building Cesium: ');
            console.log(stderr);
        }
        cb(err);
    });
});

gulp.task('default', function() {  
    gulp.run('build-cesium', 'scripts', 'docs');

    gulp.watch(['public/cesium/Source/**', 'public/cesium/Specs/**'], ['build-cesium']);
    gulp.watch('src/*.js', ['scripts']);
})

gulp.task('combine', function() {
    rjs({
        name: 'ui/main',
        out: 'ui.js',
        baseUrl: 'public',
        paths: {
            'Cesium': './cesium/Source',
            'ui': './viewer',
            'domReady': './cesium/ThirdParty/requirejs-2.1.9/domReady',
            'knockout.mapping': './third_party/knockout.mapping',
            'requireLib': './cesium/ThirdParty/requirejs-2.1.9/require'
        },
        map: {
            '*': {
                'knockout': 'Cesium/ThirdParty/knockout'
            }
        },
        shim: {
            'ausglobe': {
                deps: ['ui/GlobalCesium'],
                exports: 'ausglobe'
            }
        },
        include: ['requireLib']
    }).pipe(gulp.dest('./public/build/'));
});