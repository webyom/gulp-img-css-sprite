fs = require 'fs'
path = require 'path'
async = require 'async'
gutil = require 'gulp-util'
through = require 'through2'
spritesmith = require 'spritesmith'

coordinates = {}

inherit = (proto) ->
	F = ->
	F.prototype = proto
	new F()

img = (opt = {}) ->
	all = []
	paths =
		png: null
		jpg: null
	dir = ''
	stream = through.obj (file, enc, next) ->
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null') if file.isNull()
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported') if file.isStream()
		fileName = path.basename file.path
		if fileName.indexOf('sprite-') is 0
			fileDir = path.dirname file.path
			if fileDir isnt dir
				all.push paths.png if paths.png?.length
				all.push paths.jpg if paths.jpg?.length
				paths.png = []
				paths.jpg = []
				dir = fileDir
			extName = path.extname fileName
			if extName is '.png'
				ps = paths.png = paths.png || []
			else if extName in ['.jpg', '.jpeg']
				ps = paths.jpg = paths.jpg || []
			else
				ps = null
			if ps
				ps.push file if not ps.length
				ps.push file.path
		next()
	, (next) ->
		all.push paths.png if paths.png?.length
		all.push paths.jpg if paths.jpg?.length
		async.eachSeries(
			all
			(paths, cb) =>
				file = paths.shift()
				filePath = file.path
				fileName = path.basename filePath
				dirName = path.dirname filePath
				extName = path.extname filePath
				sprite = dirName + '/sprite' + extName
				param = inherit opt
				param.src = paths
				m = fileName.match /\b(top-down|left-right|diagonal|alt-diagonal)\b/
				param.algorithm = m?[1] || param.algorithm
				spritesmith param, (err, res) =>
					return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', err) if err
					@push new gutil.File
						base: file.base
						cwd: file.cwd
						path: sprite
						contents: new Buffer res.image, 'binary'
					for p, c of res.coordinates
						c.sprite = sprite
						coordinates[p] = c
					cb()
			(err) =>
				return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', err) if err
				next()
		)

css = (opt = {}) ->
	console.log coordinates
	stream = through.obj (file, enc, next) ->
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null') if file.isNull()
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported') if file.isStream()
		next()

module.exports =
	img: img
	css: css
