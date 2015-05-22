(function() {
  var ALGORITHM_REGEXP, Q, URL_REGEXP, async, coordinates, css, cssDeclarations, cssFile, cssParser, cssRules, fs, gutil, img, inherit, path, spritesmith, through;

  Q = require('q');

  fs = require('fs');

  path = require('path');

  async = require('async');

  gutil = require('gulp-util');

  through = require('through2');

  spritesmith = require('spritesmith');

  cssParser = require('css');

  URL_REGEXP = /url\s*\(['"]?([^\)'"]+)['"]?\)/;

  ALGORITHM_REGEXP = /\b(top-down|left-right|diagonal|alt-diagonal)\b/;

  coordinates = {};

  inherit = function(proto) {
    var F;
    F = function() {};
    F.prototype = proto;
    return new F();
  };

  img = function(opt) {
    var all, dir, paths, stream;
    if (opt == null) {
      opt = {};
    }
    all = [];
    paths = {
      png: null,
      jpg: null
    };
    dir = '';
    return stream = through.obj(function(file, enc, next) {
      var extName, fileDir, fileName, ps, ref, ref1;
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
          if ((ref = paths.png) != null ? ref.length : void 0) {
            all.push(paths.png);
          }
          if ((ref1 = paths.jpg) != null ? ref1.length : void 0) {
            all.push(paths.jpg);
          }
          paths.png = [];
          paths.jpg = [];
          dir = fileDir;
        }
        extName = path.extname(fileName);
        if (extName === '.png') {
          ps = paths.png = paths.png || [];
        } else if (extName === '.jpg' || extName === '.jpeg') {
          ps = paths.jpg = paths.jpg || [];
        } else {
          ps = null;
        }
        if (ps) {
          if (!ps.length) {
            ps.push(file);
          }
          ps.push(file.path);
        }
      }
      return next();
    }, function(next) {
      var ref, ref1;
      if ((ref = paths.png) != null ? ref.length : void 0) {
        all.push(paths.png);
      }
      if ((ref1 = paths.jpg) != null ? ref1.length : void 0) {
        all.push(paths.jpg);
      }
      return async.eachSeries(all, (function(_this) {
        return function(paths, cb) {
          var dirName, extName, file, fileName, filePath, m, param, sprite;
          file = paths.shift();
          filePath = file.path;
          fileName = path.basename(filePath);
          dirName = path.dirname(filePath);
          extName = path.extname(filePath);
          sprite = dirName + '/sprite' + extName;
          param = inherit(opt);
          param.src = paths;
          m = fileName.match(ALGORITHM_REGEXP);
          param.algorithm = (m != null ? m[1] : void 0) || param.algorithm;
          return spritesmith(param, function(err, res) {
            var c, p, ref2;
            if (err) {
              return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
            }
            _this.push(new gutil.File({
              base: file.base,
              cwd: file.cwd,
              path: sprite,
              contents: new Buffer(res.image, 'binary')
            }));
            ref2 = res.coordinates;
            for (p in ref2) {
              c = ref2[p];
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

  cssDeclarations = function(file, declarations, complete) {
    var dec;
    dec = null;
    return async.eachSeries(declarations, (function(_this) {
      return function(declaration, cb) {
        var coordinate, imgPath, m, ref, x, y;
        if ((ref = declaration.property) === 'background-image' || ref === 'background') {
          m = declaration.value.match(URL_REGEXP);
          if (m[1]) {
            imgPath = path.resolve(path.dirname(file.path), m[1]);
            coordinate = coordinates[imgPath];
            if (coordinate) {
              declaration.value = declaration.value.replace(URL_REGEXP, function(full, url) {
                return 'url(' + path.relative(path.dirname(file.path), coordinate.sprite) + ')';
              });
              x = coordinate.x === 0 ? '0' : coordinate.x + 'px';
              y = coordinate.y === 0 ? '0' : coordinate.y + 'px';
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
          return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
        }
        return complete(dec);
      };
    })(this));
  };

  cssRules = function(file, rules, complete) {
    return async.eachSeries(rules, (function(_this) {
      return function(rule, cb) {
        if (rule.rules) {
          cssRules(file, rule.rules, cb);
        }
        if (rule.declarations) {
          return cssDeclarations(file, rule.declarations, function(dec) {
            if (dec) {
              rule.declarations.push(dec);
            }
            return cb();
          });
        } else {
          return cb();
        }
      };
    })(this), (function(_this) {
      return function(err) {
        if (err) {
          return _this.emit('error', new gutil.PluginError('gulp-img-css-sprite', err));
        }
        return complete();
      };
    })(this));
  };

  cssFile = function(file, opt) {
    if (opt == null) {
      opt = {};
    }
    return Q.Promise(function(resolve, reject) {
      var ast, content;
      content = file.contents.toString();
      if (URL_REGEXP.test(content)) {
        ast = cssParser.parse(content, opt);
        return cssRules(file, ast.stylesheet.rules || [], function() {
          file.contents = new Buffer(cssParser.stringify(ast, opt));
          return resolve(file);
        });
      } else {
        return resolve(file);
      }
    });
  };

  css = function(opt) {
    var stream;
    if (opt == null) {
      opt = {};
    }
    return stream = through.obj(function(file, enc, next) {
      if (file.isNull()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null'));
      }
      if (file.isStream()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported'));
      }
      return cssFile(file, opt).then((function(_this) {
        return function(file) {
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
    img: img,
    css: css,
    cssFile: cssFile
  };

}).call(this);
