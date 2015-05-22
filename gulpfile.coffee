gulp = require 'gulp'
coffee = require 'gulp-coffee'
imgCssSprite = require './lib/index'

gulp.task 'compile', ->
	gulp.src('src/**/*.coffee')
		.pipe coffee()
		.pipe gulp.dest('lib')

gulp.task 'img', ->
	gulp.src('example/src/**/*.+(jpg|png)')
		.pipe imgCssSprite.img
			padding: 2
		.pipe gulp.dest('example/dest')

gulp.task 'example', ['img'], ->
	gulp.src('example/src/**/*.css')
		.pipe imgCssSprite.css
			base:
				url: '//webyom.org'
				dir: 'example/src'
		.pipe gulp.dest('example/dest')

gulp.task 'default', ['compile']