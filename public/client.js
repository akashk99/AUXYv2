var requestedSongs = [];
var queuedSongs = [];
var socket = io.connect();
var autoAdd = false;
var access_token = getJsonFromUrl(document.URL)[
  "ttp://auxy.ngrok.io/#access_token"
];

checkIfCurrentlyPlaying(function (data) {
  if (data == undefined) {
    alert("Nothing Playing. Song Must Be Playing for Service to Work");
  }

  
  $(document).on("click", "#qrNum", function () {
    document
      .getElementById("qrCode")
      .setAttribute(
        "style",
        "display:block;position: fixed ;top: 50%;left: 50%; transform: translate(-50%, -50%);text-align: center; background-color: #222222; border-radius: 2%; padding: 50px;"
      );

    document.getElementById("closePopUp").onclick = function () {
      document.getElementById("qrCode").setAttribute("style", "display:none");
    };

    document.getElementById("share").onclick = function () {
      document.getElementById("qrCode").setAttribute("style", "display:none");
      window.location.href =
        "sms:open?addresses=2058578995,Replace-with-Friends-Names-then-Press-Send&body=Respond With 'Join Now' to Begin Queueing";
    };
  });

  $(document).mouseup(function (e) {
    var container = $("#qrCode");

    // if the target of the click isn't the container nor a descendant of the container
    if (!container.is(e.target) && container.has(e.target).length === 0) {
      container.hide();
    }
  });

  document.getElementById("next").onclick = function () {
    $.ajax({
      url: "https://api.spotify.com/v1/me/player/next",
      type: "POST",
      headers: {
        Authorization: "Bearer " + access_token,
      },
    });
  };

  var input = document.getElementById("clientInput");
  input.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
      document.getElementById("clientAdd").click();
    }
  });

  document.getElementById("clientAdd").onclick = function () {
    $.ajax({
      url:
        "https://api.spotify.com/v1/search?q=" +
        document.getElementById("clientInput").value +
        "&type=track,artist",
      type: "GET",
      headers: {
        Authorization: "Bearer " + access_token,
      },
      success: function (results) {
        // Requested Track Info
        songObject = results.tracks.items[0];
        requestedSong = {
          name: songObject.name,
          artist: songObject.artists[0].name,
          uri: songObject.uri,
          albumArtwork: songObject.album.images[2].url,
        };

        $.ajax({
          url:
            "https://api.spotify.com/v1/me/player/queue?uri=" + songObject.uri,
          type: "post",
          headers: {
            Authorization: "Bearer " + access_token,
          },
          dataType: "json",
          success: function (data) {},
        });

        queuedSongs.push(requestedSong);
        document.getElementById("clientInput").value = "";
        updateQueuedList();
      },
    });
  };
});

socket.on("newUser", (data) => {
  alert(
    "Someone new logged on, your account is no longer associated with the queue number. Refresh to gain access"
  );
});

socket.on("requested", (data) => {
  if (document.getElementById("autoAdd").checked == true) {
    // AUTO ADD FUNCTIONALITY
    url = "https://api.spotify.com/v1/me/player/queue?uri=" + data.uri;
    $.ajax({
      url: url,
      type: "post",
      data: {},
      headers: {
        Authorization: "Bearer " + access_token,
      },
      dataType: "json",
      success: function (data) {},
    });

    queuedSongs.push(data);
    updateQueuedList();
  } else {
    uniqueSong = true;
    for (let i = 0; i < requestedSongs.length; i++) {
      if (requestedSongs[i].uri == data.uri) {
        uniqueSong = false;
        requestedSongs[i].numRequest += 1;
      }
    }
    if (uniqueSong) {
      data.numRequest = 1;
      requestedSongs.push(data);
    }

    // Prints list to screen when new requests come in
    updateList();

    $(".delete-btn").on("click", function () {
      if (requestedSongs.length == 1) {
        div = document.getElementById("listOfSongs");
        p = document.createElement("p");
        p.innerHTML = "No Songs Waiting For Approval";
        p.setAttribute("style", "text-align: center");
        div.innerHTML = "";
        div.appendChild(p);
      } else {
        $(this).parent().parent().remove();
      }
      indexToDelete = findIndexFromURI($(this).attr("id"));
      requestedSongs.splice(indexToDelete, 1);
    });

    $(".add-btn").on("click", function () {
      // if currenty playing == true then do all of this stuff otherwise alert(something must be playing)
      if (requestedSongs.length == 1) {
        div = document.getElementById("listOfSongs");
        p = document.createElement("p");
        p.setAttribute("style", "text-align: center");
        p.innerHTML = "No Songs Waiting For Approval";
        div.innerHTML = "";
        div.appendChild(p);
      } else {
        $(this).parent().parent().remove();
      }
      index = findIndexFromURI($(this).attr("id"));
      uri = requestedSongs[index].uri;

      $.ajax({
        url: "https://api.spotify.com/v1/me/player/queue?uri=" + uri,
        type: "post",
        data: {},
        headers: {
          Authorization: "Bearer " + access_token,
        },
        dataType: "json",
        success: function (data) {},
        error: function () {},
      });
      indexToDelete = findIndexFromURI($(this).attr("id"));
      queuedSongs.push(requestedSongs[indexToDelete]);
      requestedSongs.splice(indexToDelete, 1);
      updateQueuedList();
    });
  }
});

function update_value(chk_bx) {
  if (chk_bx.checked) {
    autoAdd = true;
  } else {
    autoAdd = false;
  }
}

function findIndexFromURI(uri) {
  for (i = 0; i < requestedSongs.length; i++) {
    if (requestedSongs[i].uri == uri) {
      return i;
    }
  }
}

function getJsonFromUrl(url) {
  if (!url) url = location.search;
  var query = url.substr(1);
  var result = {};
  query.split("&").forEach(function (part) {
    var item = part.split("=");
    result[item[0]] = decodeURIComponent(item[1]);
  });
  return result;
}

function checkIfCurrentlyPlaying(callback) {
  $.ajax({
    url: "https://api.spotify.com/v1/me/player/currently-playing",
    type: "GET",
    headers: { Authorization: "Bearer " + access_token },
    success: callback,
  });
}

// REDO updateList() and updateQueuedList() so that it doesnt redraw the entire lists
function updateList() {
  document.getElementById("listOfSongs").innerHTML = "";
  let table = document.createElement("TABLE");
  table.setAttribute(
    "style",
    "table-layout: fixed ; width:100%;  text-align:center"
  );
  document.getElementById("listOfSongs").appendChild(table);

  let tr = document.createElement("TR");
  let thArt = document.createElement("TH");
  let thTitle = document.createElement("TH");
  let thReqs = document.createElement("TH");
  let thAdd = document.createElement("TH");
  let thDelete = document.createElement("TH");

  thTitle.setAttribute("style", "text-align:center");
  thReqs.setAttribute("style", "text-align:center");

  thArt.innerHTML = " ";
  thTitle.innerHTML = "Title and Artist";
  thReqs.innerHTML = "Times Requested";
  thAdd.innerHTML = " ";
  thDelete.innerHTML = "";

  tr.appendChild(thArt);
  tr.appendChild(thTitle);
  tr.appendChild(thReqs);
  tr.append(thAdd);
  tr.append(thDelete);
  table.appendChild(tr);

  for (let i = 0; i < requestedSongs.length; i++) {
    let tr = document.createElement("TR");

    let tdArt = document.createElement("TD");
    tdArt.setAttribute(
      "style",
      'width:64px; overflow: hidden; style="display:block; align-content: right'
    );

    let tdNum = document.createElement("TD");
    tdNum.setAttribute("style", "height: 50px;overflow: hidden;");
    tdNum.setAttribute("style", "text-align:center");
    let tdInfo = document.createElement("TD");
    tdInfo.setAttribute("style", "height: 50px;overflow: hidden;");
    tdInfo.setAttribute("style", "text-align:center");

    let nameSpan = document.createElement("span");
    nameSpan.setAttribute("style", "display:block;");
    let artistSpan = document.createElement("span");

    let tdAdd = document.createElement("TD");
    tdAdd.setAttribute("style", "height: 50px;overflow: hidden;");
    let tdDelete = document.createElement("TD");
    tdDelete.setAttribute("style", "height: 50px;overflow: hidden;");

    let buttonAdd = document.createElement("button");
    buttonAdd.setAttribute("class", "add-btn");
    

    buttonAdd.setAttribute("id", requestedSongs[i].uri);
    buttonAdd.innerHTML = "Add";

    let buttonDelete = document.createElement("button");
    buttonDelete.setAttribute("class", "button-primary delete-btn");
    buttonDelete.setAttribute("id", requestedSongs[i].uri);
    buttonDelete.innerHTML = "Delete";

    let artImg = document.createElement("img");
    artImg.setAttribute("src", requestedSongs[i].albumArtwork);

    tdArt.appendChild(artImg);

    tdNum.innerHTML = requestedSongs[i].numRequest;
    nameSpan.innerHTML = requestedSongs[i].name;
    artistSpan.innerHTML = "By " + requestedSongs[i].artist;
    tdAdd.appendChild(buttonAdd);
    tdDelete.appendChild(buttonDelete);

    tdInfo.appendChild(nameSpan);
    tdInfo.appendChild(artistSpan);

    tr.append(tdArt);
    tr.append(tdInfo);
    tr.append(tdNum);
    tr.append(tdAdd);
    tr.append(tdDelete);
    table.append(tr);
  }
}

function updateQueuedList() {


  if (queuedSongs.length == undefined) {
    div = document.getElementById("listOfQueuedSongs");
    p = document.createElement("p");
    p.innerHTML = "All Songs Have Been Added to Playlist";
    p.setAttribute("style", "text-align: center");
    div.innerHTML = "";
    div.appendChild(p);

    return;
  }
  document.getElementById("listOfQueuedSongs").innerHTML = "";
  let table = document.createElement("TABLE");
  table.setAttribute(
    "style",
    "table-layout: fixed ; width:100%;  text-align:center"
  );
  document.getElementById("listOfQueuedSongs").appendChild(table);

  for (let i = queuedSongs.length - 1; i >= 0; i--) {
    let tr = document.createElement("TR");

    let tdArt = document.createElement("TD");
    tdArt.setAttribute(
      "style",
      'width:64px; overflow: hidden; style="display:block; align-content: right'
    );

    let tdInfo = document.createElement("TD");
    tdInfo.setAttribute("style", "height: 50px;overflow: hidden;");

    let nameSpan = document.createElement("span");
    nameSpan.setAttribute("style", "display:block;");
    let artistSpan = document.createElement("span");

    let artImg = document.createElement("img");
    artImg.setAttribute("src", queuedSongs[i].albumArtwork);

    tdArt.appendChild(artImg);
    nameSpan.innerHTML = queuedSongs[i].name;
    artistSpan.innerHTML = "By " + queuedSongs[i].artist;

    tdInfo.appendChild(nameSpan);
    tdInfo.appendChild(artistSpan);

    tr.append(tdArt);
    tr.append(tdInfo);


    table.append(tr);
  }

  let makePlaylist = document.createElement("button");
  makePlaylist.innerHTML = "Create a Playlist with these Songs";
  makePlaylist.setAttribute("class", "make-playlist");
  makePlaylist.setAttribute("id", "makePlaylist");
  document.getElementById("listOfQueuedSongs").appendChild(makePlaylist);

  document.getElementById("makePlaylist").onclick = function () {
    userID = document.getElementById("userID").innerHTML;
    // call spotify api

    dateCreated = new Date();
    day = dateCreated.getDate();
    month = dateCreated.getMonth() + 1;
    year = dateCreated.getFullYear();

    playlistName = "AUXY " + month + "/" + day + "/" + year;

    var jsonData = {
      name: playlistName,
      public: false,
    };

    $.ajax({
      type: "POST",
      url: "https://api.spotify.com/v1/users/" + userID + "/playlists/",
      data: JSON.stringify(jsonData),
      headers: {
        Authorization: "Bearer " + access_token,
        "Content-Type": "application/json",
      },
      success: function (result) {
        playlistID = result.id;
        uriArray = [];

        for (i = 0; i < queuedSongs.length; i++) {
          uriArray.push(queuedSongs[i].uri);
        }

        jsonData = {
          uris: uriArray,
        };

        $.ajax({
          type: "POST",
          url: "https://api.spotify.com/v1/playlists/" + playlistID + "/tracks",
          data: JSON.stringify(jsonData),
          headers: {
            Authorization: "Bearer " + access_token,
            "Content-Type": "application/json",
          },
          success: function (result) {
            queuedSongs = {};
            updateQueuedList();
          },
          error: function () {},
        });
      },
      error: function () {},
    });
  };

}
