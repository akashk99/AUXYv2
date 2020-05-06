// FILE DEPENDENCIES
const express = require("express"); // Express web server framework
const request = require("request"); // "Request" library
const Spotify = require("node-spotify-api");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const MessagingResponse = require("twilio").twiml.MessagingResponse;
const socket = require("socket.io");

//EXPRESS CONFIG
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());
const server = app.listen(8888, function(){
  console.log("Listening on Port 8888")
});

//TWILLIO CONFIG
var twilioNum = "+12058578995";
const accountSid = "ACa6b963bba043f265d7733ed42e07482f";
const authToken = "2493da6b3701b04bbcd4a53af6e7932f";
const client = require("twilio")(accountSid, authToken);

// SOCKET CONFIG
const io = socket(server);
var socketIDS = [];

//SPOTIFY API CONFIG
var client_id = "ac3cff527a5c463c8646e274b6d62f36"; // Your client id
var client_secret = "9f15ef31a34a4828bed71bb535b61576"; // Your secret
var redirect_uri = "http://auxy.ngrok.io/callback";
var stateKey = "spotify_auth_state";
var spotify = new Spotify({ id: client_id, secret: client_secret });
var authCode = undefined;

var generateRandomString = function (length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// keeps track of requestedSongs for each client
var numOfRequests = 0;

io.on("connection", function (user) {
  socketIDS.push(user.id);

  for (let i = 0; i < socketIDS.length - 1; i++) {
    io.to(socketIDS[i]).emit("newUser", true);
  }

  user.on("disconnect", function () {
    for (i = 0; i < socketIDS.length; i++) {
      if (socketIDS[i] == user.id) {
        socketIDS.splice(i, 1);
      }
    }
  });

  app.get("/login", function (req, res) {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);
    requestedSongs = {};
    numOfRequests = 0;

    // your application requests authorization
    var scope =
      "playlist-read-private user-modify-playback-state user-read-playback-state playlist-modify-public playlist-modify-private";
    res.redirect(
      "https://accounts.spotify.com/authorize?" +
        querystring.stringify({
          response_type: "code",
          client_id: client_id,
          scope: scope,
          redirect_uri: redirect_uri,
          state: state,
        })
    );
  });

  // this code only gets called on login
  app.get("/callback", function (req, res) {
    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
      res.redirect(
        "/#" +
          querystring.stringify({
            error: "state_mismatch",
          })
      );
    } else {
      res.clearCookie(stateKey);
      var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        form: {
          code: code,
          redirect_uri: redirect_uri,
          grant_type: "authorization_code",
        },
        headers: {
          Authorization:
            "Basic " +
            new Buffer(client_id + ":" + client_secret).toString("base64"),
        },
        json: true,
      };

      request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          var access_token = body.access_token,
            refresh_token = body.refresh_token;

          // we can also pass the token to the browser to make requests from there
          res.redirect(
            "/#" +
              querystring.stringify({
                access_token: access_token,
                refresh_token: refresh_token,
              })
          );
        } else {
          res.redirect(
            "/#" +
              querystring.stringify({
                error: "invalid_token",
              })
          );
        }
      });
    }
  });

  app.get("/refresh_token", function (req, res) {
    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64"),
      },
      form: {
        grant_type: "refresh_token",
        refresh_token: refresh_token,
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token;
        res.send({
          access_token: access_token,
        });
      }
    });
  });

  // CODE STARTS HERE
  var lastSenderNum = 0;
  var requestedSong = "";

  app.post("/sms", (req, res) => {
    // get and store the auth
    requestedSong = req.body.Body;
    lastSenderNum = req.body.From;

    if (
      requestedSong == "Join now" ||
      requestedSong == "Join Now" ||
      requestedSong == "join now" ||
      requestedSong == "join Now"
    ) {
      client.messages.create({
        to: lastSenderNum,
        from: twilioNum,
        body:
          "Welcome to AUXY. Please text a song title to send a request to the DJ. Be sure to include the artist for common song names",
      });
      return;
    } else if (
      requestedSong == "Respond With 'Join Now' to Begin Queueing"
    ) {
      return;
    }

    spotify.search(
      { type: "track", query: requestedSong, limit: 3 },
      (err, data) => {
        if (err || data.tracks.items[0] == undefined) {
          client.messages.create({
            to: lastSenderNum,
            from: twilioNum,
            body:
              "Sorry, could not find the song you are looking for. Please try again.",
          });
          return console.log("Error occurred: " + err);
        }

        // Requested Track Info
        songObject = data.tracks.items[0];
        songUri = songObject.uri;
        songName = songObject.name;
        songArtist = songObject.artists[0].name;
        songAlbumCover = songObject.album.images[2].url;

        // add to requested songs hash

        numOfRequests++;

        requestedSong = {
          name: songName,
          artist: songArtist,
          uri: songUri,
          number: lastSenderNum,
          id: numOfRequests,
          albumArtwork: songAlbumCover,
        };

        // currently sends to the last person to login to the app but instead I want it to pair together socket ids and auth tokens and send to
        // socket id with the corrs. auth tokens
        io.to(socketIDS[socketIDS.length - 1]).emit("requested", requestedSong);

        client.messages.create({
          to: lastSenderNum,
          from: twilioNum,
          body:
            "Request for " +
            songName +
            " by " +
            songArtist +
            " has been sent to the DJ",
        });
      }
    );
  });
});
