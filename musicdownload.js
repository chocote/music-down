// Autor Oscar Sobrevilla 
// require cheerio package
// $ npm install cheerio

var http = require('http'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  stdin = process.stdin,
  stdout = process.stdout,

  // Urls

  _siteUrl = 'http://www.perupoprock.com/album.php?idsc=2',
  _downloadUrl = 'http://www.perupoprock.com/media/archivo/audio/',

  // Set optional proxy settings
  _proxy = '',
  _port = '';


(function () {

  var _read = function (onData) {
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.once('data', onData);
  },
  _getAllAlbumes = function (callback) {
    var html = '',
      albumes = [],
      options = {
        host: _proxy,
        port: _port,
        path: _siteUrl
      };

    http.get(options, function (res) {
      res.on('data', function (data) {
        html += data;
      })
        .on('end', function () {
        var $ = cheerio.load(html);
        $('div.div_resize_min a').each(function () {
          var _this = $(this),
            title = _this.attr('title').split(/\-/);
          albumes.push({
            band: title[1].trim(),
            name: title[0].trim(),
            image: _this.find('img').attr('src'),
            link: 'http://www.perupoprock.com/' + _this.attr('href'),
            tracks: []
          });
        });
        callback && callback(albumes);
      });
    });
  },
  _getAllTracks = function (album, callback) {
    var html = '',
      tracks = [],
      options = {
        host: _proxy,
        port: _port,
        path: album.link
      };

    http.get(options, function (res) {
      res.on('data', function (data) {
        html += data;
      }).on('end', function () {
        var $ = cheerio.load(html);
        $('.transparent_class-2').each(function () {
          var _this = $(this),
            link = _this.find('#sound-div a'),
            url = String(link.attr('onclick')),
            splits = /mp3=(.*)\.mp3/.exec(url);
          if (splits != null && url != "undefined") {
            tracks.push({
              id: splits[1],
              title: _this.children().first().text().split('-')[1]
            });
          }
        });
        callback && callback(tracks);
      });
    });
  };
  /* ------------ CLASS ---------- */
  PeruPopRockFreeMusic = function () {
    this.albumes = null;
    this.currentAlbum = null;
  };
  PeruPopRockFreeMusic.prototype = {
    constructor: PeruPopRockFreeMusic,
    init: function () {
      this.listAlbumes(function () {
        this._readAlbumSelection();
      }.bind(this));
    },
    listAlbumes: function (callback) {
      if (this.albumes) {
        this._writeAlbumes();
        callback && callback();
      } else {
        this._getAlbumes(function (albumes) {
          this.albumes = albumes;
          this._writeAlbumes();
          callback && callback();
        }.bind(this));
      }
    },
    listAlbumTracks: function (album) {
      this.currentAlbum = album;
      if (album.tracks && album.tracks.length) {
        this._writeTracks(album);
        this._readTrackSelection();
      } else {
        this._getTracks(album, function (tracks) {
          if (tracks.length == 0) {
            stdout.write('\033[31m - Este album no tiene canciones disponibles para descarga =..(, intenta seleccionando otro album.\033[39m\n');
            this._readAlbumSelection();
            return;
          }
          album.tracks = tracks;
          this._writeTracks(album);
          this._readTrackSelection();
        }.bind(this));
      }
    },
    _downloadTrack: function (track, callback) {

      stdout.write('\033[39m * ' + track.title + '..\033[39m');

      var trackStream,
      options = {
        host: _proxy,
        port: _port,
        path: _downloadUrl + track.id + '.mp3'
      },
      dirs = ['downloads', this.currentAlbum.band, this.currentAlbum.name],
        dirPath = '';

      dirs.forEach(function (dir) {
        dirPath += '/' + dir;
        if (!fs.existsSync(__dirname + dirPath)) fs.mkdirSync(__dirname + dirPath);
      });

      trackStream = fs.createWriteStream(__dirname + '/' + dirPath + '/' + track.title + '.mp3');
      trackStream.once('close', function () {
        stdout.write('\033[33m Hecho!\033[39m\n');
        callback && callback();
      });
      http.get(options, function (res) {
        res.pipe(trackStream);
      });
    },
    _downloadAlbum: function (album, callback) {
      stdout.write('Descargando album: "' + album.name + '" de ' + album.band + '\n');
      var index = 0,
        _this = this;
      (function (i) {
        var args = arguments;
        _this._downloadTrack(album.tracks[i], function () {
          if (album.tracks[++i]) {
            args.callee(i);
          } else {
            stdout.write('\nSe ha descargado todo el album ' + album.name + '" de ' + album.band + ':D\n');
            callback && callback();
          }
        });
      }(index));
    },
    _readAlbumSelection: function () {
      stdout.write('\nIngresa el número de album que deseas ver:');
      _read(function (data) {
        stdin.pause();
        if (isNaN(data)) {
          stdout.write('\033[31mIngreso invalido, intente nuevamente!\033[39m\n');
          this._readAlbumSelection();
          return;
        }
        var index = parseInt(data, 10),
          album = this.albumes[index];
        stdout.write('\nHaz Seleccionado el album "' + album.name + '" de ' + album.band + '\n');
        this.listAlbumTracks(album);
      }.bind(this));
    },
    _readTrackSelection: function () {
      stdout.write('\nIngresa el número de pista o "n" para descargar todo:');
      _read(function (data) {
        stdin.pause();
        
        data = data.toString().trim();

        if (data == 'n') {
          stdout.write('\033[39mHaz escogido descargar todo el album!\033[39m\n');
          this._downloadAlbum(this.currentAlbum, function () {
            process.exit();
          });
        } else {
          if (isNaN(data)) {
            stdout.write('\033[31mIngreso invalido, intente nuevamente!\033[39m\n');
            this._readTrackSelection();
            return;
          }
          var index = parseInt(data, 10),
            track = this.currentAlbum.tracks[index];
          stdout.write('\n\033[39mHaz seleccionado'+ track.title + ' - ' + this.currentAlbum.band+'\033[39m\n');
          this._downloadTrack(track, function () {
            process.exit();
          });
        }
      }.bind(this));
    },
    _writeAlbumes: function () {
      this.albumes.forEach(function (album, ind) {
        stdout.write(' \033[36m' + ind + '. ' + album.name + ' - ' + album.band + '\033[39m\n');
      });
    },
    _writeTracks: function (album) {
      album.tracks.forEach(function (track, ind) {
        stdout.write(' \033[36m' + ind + '. ' + track.title + '\033[39m\n');
      });
    },
    _getAlbumes: function (callback) {
      stdout.write('Obteniendo lista de albumes disponibles..\n');
      _getAllAlbumes(callback);
    },
    _getTracks: function (album, callback) {
      stdout.write('Obteniendo el album "' + album.name + '" de ' + album.band + '..\n\n');
      _getAllTracks(album, callback);
    }
  };
}());

new PeruPopRockFreeMusic().init();
