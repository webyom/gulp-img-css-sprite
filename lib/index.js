(function() {
  var async, coordinates, css, fs, gutil, img, inherit, path, spritesmith, through;

  fs = require('fs');

  path = require('path');

  async = require('async');

  gutil = require('gulp-util');

  through = require('through2');

  spritesmith = require('spritesmith');

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
          m = fileName.match(/\b(top-down|left-right|diagonal|alt-diagonal)\b/);
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

  css = function(opt) {
    var stream;
    if (opt == null) {
      opt = {};
    }
    console.log(coordinates);
    return stream = through.obj(function(file, enc, next) {
      if (file.isNull()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'File can\'t be null'));
      }
      if (file.isStream()) {
        return this.emit('error', new gutil.PluginError('gulp-img-css-sprite', 'Streams not supported'));
      }
      return next();
    });
  };

  module.exports = {
    img: img,
    css: css
  };

}).call(this);
