Q = require 'q'
fs = require 'fs'
path = require 'path'
async = require 'async'
gutil = require 'gulp-util'
through = require 'through2'
spritesmith = require 'spritesmith'
cssParser = require 'css'

URL_REGEXP = /url\s*\(\s*(['"])?([^\)'"]+?)\1?\s*\)/
ALGORITHM_REGEXP = /\b(top-down|left-right|diagonal|alt-diagonal)\b/
X2_REGEXP = /-2x\.[^.]+$/

coordinates = {}

inherit = (proto) ->
	F = ->
	F.prototype = proto
	new F()

img = (opt = {}) ->
	all = []
	paths = {}
	dir = ''
	stream = through.obj (file, enc, next) ->
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null') if file.isNull()
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported') if file.isStream()
		fileName = path.basename file.path
		if fileName.indexOf('sprite-') is 0
			fileDir = path.dirname file.path
			if fileDir isnt dir
				for type, ps of paths
					all.push ps if ps?.length
				paths = {}
				dir = fileDir
			extName = path.extname fileName
			if X2_REGEXP.test file.path
				ps = paths[extName + '2x'] = paths[extName + '2x'] || []
			else
				ps = paths[extName] = paths[extName] || []
			ps.push file if not ps.length
			ps.push file.path
		next()
	, (next) ->
		for type, ps of paths
			all.push ps if ps?.length
		async.eachSeries(
			all
			(paths, cb) =>
				file = paths.shift()
				filePath = file.path
				fileName = path.basename filePath
				dirName = path.dirname filePath
				extName = path.extname filePath
				if X2_REGEXP.test fileName
					sprite = dirName + '/sprite-2x' + extName
				else
					sprite = dirName + '/sprite' + extName
				param = inherit opt
				param.src = paths
				m = fileName.match ALGORITHM_REGEXP
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

cssDeclarations = (file, declarations, complete, opt = {}) ->
	dec = null
	async.eachSeries(
		declarations
		(declaration, cb) =>
			if declaration.property in ['background-image', 'background']
				m = declaration.value.match URL_REGEXP
				if m?[2]
					imgPath = path.resolve path.dirname(file.path), m[2]
					coordinate = coordinates[imgPath]
					if coordinate
						declaration.value = declaration.value.replace URL_REGEXP, (full, url) ->
							if opt.base
								baseUrl = opt.base.url.replace /\/+$/, ''
								baseDir = path.resolve file.cwd, (opt.base.dir || './')
								'url("' +  baseUrl + '/' + path.relative(baseDir, coordinate.sprite) + '")'
							else
								'url("' + path.relative(path.dirname(file.path), coordinate.sprite) + '")'
						if X2_REGEXP.test coordinate.sprite
							zoom = 2
						else
							zoom = 1
						x = if coordinate.x is 0 then '0' else (coordinate.x / zoom) + 'px'
						y = if coordinate.y is 0 then '0' else (coordinate.y / zoom) + 'px'
						dec =
							type: 'declaration'
							property: 'background-position'
							value: "#{x} #{y}"
						cb()
					else
						cb()
				else
					cb()
			else
				cb()
		(err) =>
			throw new gutil.PluginError('gulp-img-css-sprite', err) if err
			complete dec
	)

cssRules = (file, rules, complete, opt = {}) ->
	async.eachSeries(
		rules
		(rule, cb) =>
			if rule.rules
				cssRules file, rule.rules, cb, opt
			if rule.declarations
				cssDeclarations file, rule.declarations, (dec) ->
					if dec
						rule.declarations.push dec
					cb()
				, opt
			else
				cb()
		(err) =>
			throw new gutil.PluginError('gulp-img-css-sprite', err) if err
			complete()
	)

cssFile = (file, opt = {}) ->
	Q.Promise (resolve, reject) ->
		content = file.contents.toString()
		if URL_REGEXP.test content
			ast = cssParser.parse content, opt
			cssRules file, ast.stylesheet.rules || [], ->
				file.contents = new Buffer cssParser.stringify(ast, opt)
				resolve file
			, opt
		else
			resolve file

css = (opt = {}) ->
	stream = through.obj (file, enc, next) ->
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null') if file.isNull()
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported') if file.isStream()
		cssFile(file, opt).then(
			(file) =>
				@push file
				next()
			(err) =>
				@emit 'error', new gutil.PluginError('gulp-img-css-sprite', err) if err
		).done()

module.exports =
	img: img
	css: css
	cssFile: cssFile
