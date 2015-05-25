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
RATIO_REGEXP = /\D(\d(?:\.\d)?)x\.[^.]+$/

coordinates = global._gulpImgCssSpriteCoordinates = global._gulpImgCssSpriteCoordinates || {}
sprites = global._gulpImgCssSpriteSprites = global._gulpImgCssSpriteSprites || {}

inherit = (proto) ->
	F = ->
	F.prototype = proto
	new F()

imgStream = (opt = {}) ->
	all = []
	paths = {}
	dir = ''
	through.obj (file, enc, next) ->
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
			m = file.path.match RATIO_REGEXP
			if m and m[1] > 1
				ps = paths[extName + m[1] + 'x'] = paths[extName + m[1] + 'x'] || []
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
				m = fileName.match RATIO_REGEXP
				if m and m[1] > 1
					sprite = dirName + '/sprite-' + m[1] + 'x' + extName
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
					sprites[sprite] = res.properties
					for p, c of res.coordinates
						c.sprite = sprite
						coordinates[p] = c
					cb()
			(err) =>
				return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', err) if err
				next()
		)

cssDeclarations = (filePath, declarations, opt = {}) ->
	Q.Promise (resolve, reject) ->
		decs = []
		ratio = 1
		coordinate = null
		width = ''
		height = ''
		async.eachSeries(
			declarations
			(declaration, cb) =>
				if not coordinate and declaration.property in ['background-image', 'background']
					m = declaration.value.match URL_REGEXP
					if m?[2]
						imgPath = path.resolve path.dirname(filePath), m[2]
						coordinate = coordinates[imgPath]
						if coordinate
							declaration.value = declaration.value.replace URL_REGEXP, (full, url) ->
								if opt.base
									baseUrl = opt.base.url.replace /\/+$/, ''
									baseDir = path.resolve process.cwd(), (opt.base.dir || './')
									'url("' +  baseUrl + '/' + path.relative(baseDir, coordinate.sprite) + '")'
								else
									'url("' + path.relative(path.dirname(filePath), coordinate.sprite) + '")'
							m = coordinate.sprite.match RATIO_REGEXP
							if m
								ratio = parseFloat m[1]
								if not (ratio > 1)
									ratio = 1
							x = if coordinate.x is 0 then '0' else (-coordinate.x / ratio) + 'px'
							y = if coordinate.y is 0 then '0' else (-coordinate.y / ratio) + 'px'
							decs.push
								type: 'declaration'
								property: 'background-position'
								value: "#{x} #{y}"
							if ratio > 1
								sp = sprites[coordinate.sprite]
								decs.push
									type: 'declaration'
									property: 'background-size'
									value: "#{sp.width / ratio}px #{sp.height / ratio}px"
							cb()
						else
							cb()
					else
						cb()
				else
					if declaration.property is 'width'
						width = declaration.value
					else if declaration.property is 'height'
						height = declaration.value
					cb()
			(err) =>
				if err
					reject err
				else
					if coordinate
						if not width
							decs.push
								type: 'declaration'
								property: 'width'
								value: "#{coordinate.width / ratio}px"
						if not height
							decs.push
								type: 'declaration'
								property: 'height'
								value: "#{coordinate.height / ratio}px"
					resolve decs
		)

cssRules = (filePath, rules, opt = {}) ->
	Q.Promise (resolve, reject) ->
		async.eachSeries(
			rules
			(rule, cb) =>
				if rule.rules
					cssRules(filePath, rule.rules, opt).then(
						=>
							cb()
						(err) =>
							reject err
					).done()
				if rule.declarations
					cssDeclarations(filePath, rule.declarations, opt).then(
						(decs) =>
							if decs?.length
								for dec in decs
									rule.declarations.push dec
							cb()
						(err) =>
							reject err
					).done()
				else if not rule.rules
					cb()
			(err) =>
				if err
					reject err
				else
					resolve()
		)

cssContent = (content, filePath, opt = {}) ->
	throw new gutil.PluginError('gulp-img-css-sprite', 'filePath is needed') if not filePath
	Q.Promise (resolve, reject) ->
		if URL_REGEXP.test content
			ast = cssParser.parse content, opt
			cssRules(filePath, ast.stylesheet.rules || [], opt).then(
				=>
					content = cssParser.stringify(ast, opt)
					resolve content
				(err) =>
					reject err
			).done()
		else
			resolve content

cssStream = (opt = {}) ->
	through.obj (file, enc, next) ->
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null') if file.isNull()
		return @emit 'error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported') if file.isStream()
		cssContent(file.contents.toString(), file.path, opt).then(
			(content) =>
				file.contents = new Buffer content
				@push file
				next()
			(err) =>
				@emit 'error', new gutil.PluginError('gulp-img-css-sprite', err) if err
		).done()

module.exports =
	imgStream: imgStream
	cssStream: cssStream
	cssContent: cssContent
