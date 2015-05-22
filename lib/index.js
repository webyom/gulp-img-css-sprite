(function() {
  var ALGORITHM_REGEXP, Q, URL_REGEXP, X2_REGEXP, async, coordinates, cssContent, cssDeclarations, cssParser, cssRules, cssStream, fs, gutil, imgStream, inherit, path, spritesmith, through;

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

  X2_REGEXP = /-2x\.[^.]+$/;

  coordinates = {};

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
      var extName, fileDir, fileName, ps, type;
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
        if (X2_REGEXP.test(file.path)) {
          ps = paths[extName + '2x'] = paths[extName + '2x'] || [];
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
          if (X2_REGEXP.test(fileName)) {
            sprite = dirName + '/sprite-2x' + extName;
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
      var dec;
      dec = null;
      return async.eachSeries(declarations, (function(_this) {
        return function(declaration, cb) {
          var coordinate, imgPath, m, ref, x, y, zoom;
          if ((ref = declaration.property) === 'background-image' || ref === 'background') {
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
                if (X2_REGEXP.test(coordinate.sprite)) {
                  zoom = 2;
                } else {
                  zoom = 1;
                }
                x = coordinate.x === 0 ? '0' : (coordinate.x / zoom) + 'px';
                y = coordinate.y === 0 ? '0' : (coordinate.y / zoom) + 'px';
                dec = {
                  type: 'declaration',
                  property: 'background-position',
                  value: x + " " + y
                };
                return cb();
              } else {
                return cb();
              }
            } else {
              return cb();
            }
          } else {
            return cb();
          }
        };
      })(this), (function(_this) {
        return function(err) {
          if (err) {
            return reject(err);
          } else {
            return resolve(dec);
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
            return cssDeclarations(filePath, rule.declarations, opt).then(function(dec) {
              if (dec) {
                rule.declarations.push(dec);
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
            content = new Buffer(cssParser.stringify(ast, opt));
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
