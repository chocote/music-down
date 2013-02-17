// Autor Oscar Sobrevilla 
// require install node package
// $ npm install cheerio


var http = require('http'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  stdin = process.stdin,
  stdout = process.stdout;


(function () {
  var _siteUrl = 'http://www.perupoprock.com/album.php?idsc=2',
    _downloadUrl = 'http://www.perupoprock.com/media/archivo/audio/',
    _read = function (onData) {
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.once('data', onData);
    },
    _getAllAlbumes = function (callback) {
      var html = '',
        albumes = [];
      http.get(_siteUrl, function (res) {
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
        tracks = [];
      http.get(album.link, function (res) {
        res.on('data', function (data) {
          html += data;
        }).on('end', function () {
          var $ = cheerio.load(html);
          $('.transparent_class-2').each(function () {
            var _this = $(this),
              link = _this.find('#sound-div a'),
              url = String(link.attr('onclick')),
              splits = /mp3=(.*)\.mp3/.exec(url);
            if(splits != null && url != "undefined") {
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
      if(this.albumes) {
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
      if(album.tracks && album.tracks.length) {
        this._writeTracks(album);
        this._readTrackSelection();
      } else {
        this._getTracks(album, function (tracks) {
          if (tracks.length == 0) {
            console.log('=> Este album no tiene canciones disponibles para descarga, \n intenta seleccionando otro album.\n');
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
      console.log('=> Descargando track: ' + track.title + '.mp3');
      var trackStream;
      
      if(!fs.existsSync('descargas')) 
        fs.mkdirSync(__dirname+'/descargas/');
      
      if(!fs.existsSync(__dirname+'/descargas/'+this.currentAlbum.band+'/')) 
        fs.mkdirSync(__dirname+'/descargas/'+this.currentAlbum.band+'/');
      
      if(!fs.existsSync(__dirname+'/descargas/'+this.currentAlbum.band+'/'+this.currentAlbum.name+'/')) 
        fs.mkdirSync(__dirname+'/descargas/'+this.currentAlbum.band+'/'+this.currentAlbum.name+'/');
      
      trackStream = fs.createWriteStream(__dirname+'/descargas/'+this.currentAlbum.band + '/' + this.currentAlbum.name + '/' + track.title + '.mp3');
      trackStream.once('close', function () {
        console.log('Hecho!');
        callback && callback();
      });
      http.get(_downloadUrl + track.id + '.mp3', function (res) {
        res.pipe(trackStream);
      });
    },
    _downloadAlbum: function (album, callback) {
      console.log('=> Descargando album: "' + album.name + '" de ' + album.band);
      var index = 0;
      this._downloadTrack(album.tracks[index], function () {
        if(album.tracks[++index]) {
          this._downloadTrack(album.tracks[index]);
        } else {
          console.log('\nSe ha descargado todo el album ' + album.name + '" de ' + album.band);
          callback && callback();
        }
      }.bind(this));
    },
    _readAlbumSelection: function () {
      stdout.write(' \033[39mIngresa el número de album que deseas ver:\033[39m');
      _read(function (data) {
        stdin.pause();
        if(isNaN(data)) {
          console.log('\n=> Ingreso invalido, intente nuevamente!');
          this._readAlbumSelection();
          return;
        }
        var index = parseInt(data, 10),
          album = this.albumes[index];
        console.log('\nHaz Seleccionado el album "' + album.name + '" de ' + album.band);
        this.listAlbumTracks(album);
      }.bind(this));
    },
    _readTrackSelection: function () {
       stdout.write(' \033[39mIngresa el número de pista o "n" para descargar todo:\033[39m');
      _read(function (data) {
        // stdin.pause();
        
        data = data.toString().trim();

        if(data == 'n') {
          console.log('\nHaz escogido descargar todo el album!');
          this._downloadAlbum(this.currentAlbum, function () {
            process.exit();
          });
        } else {
          if(isNaN(data)) {
            console.log('\n=> Ingreso invalido, intente nuevamente!');
            this._readTrackSelection();
            return;
          }
          var index = parseInt(data, 10),
            track = this.currentAlbum.tracks[index];
          console.log('\nHaz Seleccionado: ' + track.title + ' - ' + this.currentAlbum.band);
          this._downloadTrack(track, function () {
            process.exit();
          });
        }
      }.bind(this));
    },
    _writeAlbumes: function () {
      this.albumes.forEach(function (album, ind) {
        console.log('    ' + ind + '. ' + album.name + ' - ' + album.band);
      });
      console.log('');
    },
    _writeTracks: function (album) {
      album.tracks.forEach(function (track, ind) {
        console.log('    ' + ind + '. ' + track.title);
      });
      console.log('');
    },
    _getAlbumes: function (callback) {
      console.log('\nObteniendo lista de albumes disponibles..');
      _getAllAlbumes(callback);
    },
    _getTracks: function (album, callback) {
      console.log('\nObteniendo el album "' + album.name + '" de ' + album.band + '..\n');
      _getAllTracks(album, callback);
    }
  };
}());

new PeruPopRockFreeMusic().init();