(function() {
  var ALGORITHM_REGEXP, Q, RATIO_REGEXP, URL_REGEXP, async, coordinates, cssContent, cssDeclarations, cssParser, cssRules, cssStream, fs, gutil, imgStream, inherit, path, sprites, spritesmith, through;

  Q = require('q');

  fs = require('fs');

  path = require('path');

  async = require('async');

  gutil = require('gulp-util');

  through = require('through2');

  spritesmith = require('spritesmith');

  cssParser = require('css');

  URL_REGEXP = /url\s*\(\s*(['"])?([^\)'"]+?)\1?\s*\)/;

  ALGORITHM_REGEXP = /\b(top-down|left-right|diagonal|alt-diagonal)\b/;

  RATIO_REGEXP = /\D(\d(?:\.\d)?)x\.[^.]+$/;

  coordinates = global._gulpImgCssSpriteCoordinates = global._gulpImgCssSpriteCoordinates || {};

  sprites = global._gulpImgCssSpriteSprites = global._gulpImgCssSpriteSprites || {};

  inherit = function(proto) {
    var F;
    F = function() {};
    F.prototype = proto;
    return new F();
  };

  imgStream = function(opt) {
    var all, dir, paths;
    if (opt == null) {
      opt = {};
    }
    all = [];
    paths = {};
    dir = '';
    return through.obj(function(file, enc, next) {
      var extName, fileDir, fileName, m, ps, type;
      if (file.isNull()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null'));
      }
      if (file.isStream()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported'));
      }
      fileName = path.basename(file.path);
      if (fileName.indexOf('sprite-') === 0) {
        fileDir = path.dirname(file.path);
        if (fileDir !== dir) {
          for (type in paths) {
            ps = paths[type];
            if (ps != null ? ps.length : void 0) {
              all.push(ps);
            }
          }
          paths = {};
          dir = fileDir;
        }
        extName = path.extname(fileName);
        m = file.path.match(RATIO_REGEXP);
        if (m && m[1] > 1) {
          ps = paths[extName + m[1] + 'x'] = paths[extName + m[1] + 'x'] || [];
        } else {
          ps = paths[extName] = paths[extName] || [];
        }
        if (!ps.length) {
          ps.push(file);
        }
        ps.push(file.path);
      }
      return next();
    }, function(next) {
      var ps, type;
      for (type in paths) {
        ps = paths[type];
        if (ps != null ? ps.length : void 0) {
          all.push(ps);
        }
      }
      return async.eachSeries(all, (function(_this) {
        return function(paths, cb) {
          var dirName, extName, file, fileName, filePath, m, param, sprite;
          file = paths.shift();
          filePath = file.path;
          fileName = path.basename(filePath);
          dirName = path.dirname(filePath);
          extName = path.extname(filePath);
          m = fileName.match(RATIO_REGEXP);
          if (m && m[1] > 1) {
            sprite = dirName + '/sprite-' + m[1] + 'x' + extName;
          } else {
            sprite = dirName + '/sprite' + extName;
          }
          param = inherit(opt);
          param.src = paths;
          m = fileName.match(ALGORITHM_REGEXP);
          param.algorithm = (m != null ? m[1] : void 0) || param.algorithm;
          return spritesmith(param, function(err, res) {
            var c, p, ref;
            if (err) {
              return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
            }
            _this.push(new gutil.File({
              base: file.base,
              cwd: file.cwd,
              path: sprite,
              contents: new Buffer(res.image, 'binary')
            }));
            sprites[sprite] = res.properties;
            ref = res.coordinates;
            for (p in ref) {
              c = ref[p];
              c.sprite = sprite;
              coordinates[p] = c;
            }
            return cb();
          });
        };
      })(this), (function(_this) {
        return function(err) {
          if (err) {
            return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
          }
          return next();
        };
      })(this));
    });
  };

  cssDeclarations = function(filePath, declarations, opt) {
    if (opt == null) {
      opt = {};
    }
    return Q.Promise(function(resolve, reject) {
      var coordinate, decs, height, ratio, width;
      decs = [];
      ratio = 1;
      coordinate = null;
      width = '';
      height = '';
      return async.eachSeries(declarations, (function(_this) {
        return function(declaration, cb) {
          var imgPath, m, ref, sp, x, y;
          if (!coordinate && ((ref = declaration.property) === 'background-image' || ref === 'background')) {
            m = declaration.value.match(URL_REGEXP);
            if (m != null ? m[2] : void 0) {
              imgPath = path.resolve(path.dirname(filePath), m[2]);
              coordinate = coordinates[imgPath];
              if (coordinate) {
                declaration.value = declaration.value.replace(URL_REGEXP, function(full, url) {
                  var baseDir, baseUrl;
                  if (opt.base) {
                    baseUrl = opt.base.url.replace(/\/+$/, '');
                    baseDir = path.resolve(process.cwd(), opt.base.dir || './');
                    return 'url("' + baseUrl + '/' + path.relative(baseDir, coordinate.sprite) + '")';
                  } else {
                    return 'url("' + path.relative(path.dirname(filePath), coordinate.sprite) + '")';
                  }
                });
                m = coordinate.sprite.match(RATIO_REGEXP);
                if (m) {
                  ratio = parseFloat(m[1]);
                  if (!(ratio > 1)) {
                    ratio = 1;
                  }
                }
                x = coordinate.x === 0 ? '0' : (-coordinate.x / ratio) + 'px';
                y = coordinate.y === 0 ? '0' : (-coordinate.y / ratio) + 'px';
                decs.push({
                  type: 'declaration',
                  property: 'background-position',
                  value: x + " " + y
                });
                if (ratio > 1) {
                  sp = sprites[coordinate.sprite];
                  decs.push({
                    type: 'declaration',
                    property: 'background-size',
                    value: (sp.width / ratio) + "px " + (sp.height / ratio) + "px"
                  });
                }
                return cb();
              } else {
                return cb();
              }
            } else {
              return cb();
            }
          } else {
            if (declaration.property === 'width') {
              width = declaration.value;
            } else if (declaration.property === 'height') {
              height = declaration.value;
            }
            return cb();
          }
        };
      })(this), (function(_this) {
        return function(err) {
          if (err) {
            return reject(err);
          } else {
            if (coordinate) {
              if (!width) {
                decs.push({
                  type: 'declaration',
                  property: 'width',
                  value: (coordinate.width / ratio) + "px"
                });
              }
              if (!height) {
                decs.push({
                  type: 'declaration',
                  property: 'height',
                  value: (coordinate.height / ratio) + "px"
                });
              }
            }
            return resolve(decs);
          }
        };
      })(this));
    });
  };

  cssRules = function(filePath, rules, opt) {
    if (opt == null) {
      opt = {};
    }
    return Q.Promise(function(resolve, reject) {
      return async.eachSeries(rules, (function(_this) {
        return function(rule, cb) {
          if (rule.rules) {
            cssRules(filePath, rule.rules, opt).then(function() {
              return cb();
            }, function(err) {
              return reject(err);
            }).done();
          }
          if (rule.declarations) {
            return cssDeclarations(filePath, rule.declarations, opt).then(function(decs) {
              var dec, i, len;
              if (decs != null ? decs.length : void 0) {
                for (i = 0, len = decs.length; i < len; i++) {
                  dec = decs[i];
                  rule.declarations.push(dec);
                }
              }
              return cb();
            }, function(err) {
              return reject(err);
            }).done();
          } else if (!rule.rules) {
            return cb();
          }
        };
      })(this), (function(_this) {
        return function(err) {
          if (err) {
            return reject(err);
          } else {
            return resolve();
          }
        };
      })(this));
    });
  };

  cssContent = function(content, filePath, opt) {
    if (opt == null) {
      opt = {};
    }
    if (!filePath) {
      throw new gutil.PluginError('gulp-img-css-sprite', 'filePath is needed');
    }
    return Q.Promise(function(resolve, reject) {
      var ast;
      if (URL_REGEXP.test(content)) {
        ast = cssParser.parse(content, opt);
        return cssRules(filePath, ast.stylesheet.rules || [], opt).then((function(_this) {
          return function() {
            content = cssParser.stringify(ast, opt);
            return resolve(content);
          };
        })(this), (function(_this) {
          return function(err) {
            return reject(err);
          };
        })(this)).done();
      } else {
        return resolve(content);
      }
    });
  };

  cssStream = function(opt) {
    if (opt == null) {
      opt = {};
    }
    return through.obj(function(file, enc, next) {
      if (file.isNull()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null'));
      }
      if (file.isStream()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported'));
      }
      return cssContent(file.contents.toString(), file.path, opt).then((function(_this) {
        return function(content) {
          file.contents = new Buffer(content);
          _this.push(file);
          return next();
        };
      })(this), (function(_this) {
        return function(err) {
          if (err) {
            return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
          }
        };
      })(this)).done();
    });
  };

  module.exports = {
    imgStream: imgStream,
    cssStream: cssStream,
    cssContent: cssContent
  };

}).call(this);
