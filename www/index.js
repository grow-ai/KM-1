var albumBucketName = "grow-ai-pictures";
var bucketRegion = "us-west-2";

AWS.config.region = 'us-west-2'; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-west-2:996ebb70-f10b-497d-bbb8-27a0eba47609',
});

var s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    params: { Bucket: albumBucketName }
});

function listAlbums() {
    s3.listObjects({ Delimiter: "/" }, function (err, data) {
        if (err) {
            return console.log("There was an error listing your albums: " + err.message);
        } else {
            var albums = data.CommonPrefixes.map(function (commonPrefix) {
                var prefix = commonPrefix.Prefix;
                var albumName = decodeURIComponent(prefix.replace("/", ""));
                return getHtml([
                    "<li>",
                    "<span onclick=\"deleteAlbum('" + albumName + "')\">X</span>",
                    "<span onclick=\"viewAlbum('" + albumName + "')\">",
                    albumName,
                    "</span>",
                    "</li>"
                ]);
            });
            var message = albums.length
                ? getHtml([
                    "<p>Click on an album name to view it.</p>",
                    "<p>Click on the X to delete the album.</p>"
                ])
                : "<p>You do not have any albums. Please Create album.";
            var htmlTemplate = [
                "<h2>Albums</h2>",
                message,
                "<ul>",
                getHtml(albums),
                "</ul>",
                "<button onclick=\"createAlbum('album1')\">",
                "Create New Album",
                "</button>"
            ];
            document.getElementById("app").innerHTML = getHtml(htmlTemplate);
        }
    });
}

function createAlbum(albumName) {
    albumName = albumName.trim();
    if (!albumName) {
        return console.log("Album names must contain at least one non-space character.");
    }
    if (albumName.indexOf("/") !== -1) {
        return console.log("Album names cannot contain slashes.");
    }
    var albumKey = encodeURIComponent(albumName);
    s3.headObject({ Key: albumKey }, function (err, data) {
        if (!err) {
            return console.log("Album already exists.");
        }
        if (err.code !== "NotFound") {
            return console.log("There was an error creating your album: " + err.message);
        }
        s3.putObject({ Key: albumKey }, function (err, data) {
            if (err) {
                return console.log("There was an error creating your album: " + err.message);
            }
            console.log("Successfully created album.");
            viewAlbum(albumName);
        });
    });
}

function viewAlbum(albumName) {
    var albumPhotosKey = encodeURIComponent(albumName) + "/";
    s3.listObjects({ Prefix: albumPhotosKey }, function (err, data) {
        if (err) {
            return console.log("There was an error viewing your album: " + err.message);
        }
        // 'this' references the AWS.Response instance that represents the response
        var href = this.request.httpRequest.endpoint.href;
        var bucketUrl = href + albumBucketName + "/";

        var photos = data.Contents.map(function (photo) {
            var photoKey = photo.Key;
            var photoUrl = bucketUrl + encodeURIComponent(photoKey);
            return getHtml([
                "<span>",
                "<div>",
                '<img style="width:128px;height:128px;" src="' + photoUrl + '"/>',
                "</div>",
                "<div>",
                "<span onclick=\"deletePhoto('" +
                albumName +
                "','" +
                photoKey +
                "')\">",
                "X",
                "</span>",
                "<span>",
                photoKey.replace(albumPhotosKey, ""),
                "</span>",
                "</div>",
                "</span>"
            ]);
        });
        var message = photos.length
            ? "<p>Click on the X to delete the photo</p>"
            : "<p>You do not have any photos in this album. Please add photos.</p>";
        var htmlTemplate = [
            "<h2>",
            "Album: " + albumName,
            "</h2>",
            message,
            "<div>",
            getHtml(photos),
            "</div>",
            '<input id="photoupload" type="file" accept="image/*">',
            '<button id="addphoto" onclick="addPhoto(\'' + albumName + "')\">",
            "Add Photo",
            "</button>",
            '<button onclick="listAlbums()">',
            "Back To Albums",
            "</button>"
        ];
        document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    });
}

function addPhoto(albumName) {
    var files = document.getElementById("photoupload").files;
    if (!files.length) {
        return console.log("Please choose a file to upload first.");
    }
    var file = files[0];
    var fileName = file.name;
    var albumPhotosKey = encodeURIComponent(albumName) + "/";

    var photoKey = albumPhotosKey + fileName;

    // Use S3 ManagedUpload class as it supports multipart uploads
    var upload = new AWS.S3.ManagedUpload({
        params: {
            Bucket: albumBucketName,
            Key: photoKey,
            Body: file
        }
    });

    var promise = upload.promise();

    promise.then(
        function (data) {
            console.log("Successfully uploaded photo.");
            viewAlbum(albumName);
        },
        function (err) {
            return console.log("There was an error uploading your photo: ", err.message);
        }
    );
}

function deletePhoto(albumName, photoKey) {
    s3.deleteObject({ Key: photoKey }, function (err, data) {
        if (err) {
            return console.log("There was an error deleting your photo: ", err.message);
        }
        console.log("Successfully deleted photo.");
        viewAlbum(albumName);
    });
}

function deleteAlbum(albumName) {
    var albumKey = encodeURIComponent(albumName) + "/";
    s3.listObjects({ Prefix: albumKey }, function (err, data) {
        if (err) {
            return console.log("There was an error deleting your album: ", err.message);
        }
        var objects = data.Contents.map(function (object) {
            return { Key: object.Key };
        });
        s3.deleteObjects(
            {
                Delete: { Objects: objects, Quiet: true }
            },
            function (err, data) {
                if (err) {
                    return console.log("There was an error deleting your album: ", err.message);
                }
                console.log("Successfully deleted album.");
                listAlbums();
            }
        );
    });
}

var app = {
    // Application Constructor
    initialize: function () {
        console.log('start');
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function () {
        if (this.hasGetUserMedia()) {
            console.log('You are all set!');
            this.takePicture();
        } else {
            console.log('getUserMedia() is not supported by your browser :/');
        }
    },

    hasGetUserMedia: function () {
        return !!(navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia);
    },


    takePicture: function () {
        const captureVideoButton = document.querySelector('#open-camera1');
        const screenshotButton = document.querySelector('#camera-capture1');
        const img = document.querySelector('#profile-image1');

        const video = document.querySelector('#video-container');

        const canvas = document.createElement('canvas');

        const constraints = {
            video: { width: { max: 480 }, height: { max: 640 } }
        };

        captureVideoButton.onclick = function () {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(handleSuccess)
                .catch(handleError);
        };


        screenshotButton.onclick = function () {
            console.log('image 1');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            // Other browsers will fall back to image/png
            img.src = canvas.toDataURL('image/png');
            // TODO: process image:
            app.ProcessImage();
            // If the video source Object is set, stop all tracks
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(function (track) {
                    track.stop();
                });
            }
        };


        function handleSuccess(stream) {
            screenshotButton.disabled = false;
            video.srcObject = stream;
        }

        function handleError(error) {
            console.error('Error: ', error);
        }
    },

    DetectFaces: function (imageData) {
        AWS.region = "us-east-2";
        var rekognition = new AWS.Rekognition();
        var params = {
            Image: {
                Bytes: imageData
            },
            // ProjectVersionArn: 'arn:aws:rekognition:us-east-2:053765585733:project/grow-ai/version/grow-ai.2021-04-15T03.01.50/1618480910563',
            ProjectVersionArn: 'arn:aws:rekognition:us-east-2:053765585733:project/grow-ai/version/grow-ai.2021-04-29T01.47.57/1619686077450'
        };
        rekognition.detectCustomLabels(params, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
                console.log(data);
                var plant_label = document.getElementById("plant-label1");
                plant_label.innerHTML = data["CustomLabels"][0]["Name"];
                var certainty = document.getElementById("certainty1");
                certainty.innerHTML = data["CustomLabels"][0]["Confidence"]
            }
        });
    },
    //Loads selected image and unencodes image bytes for Rekognition DetectFaces API
    ProcessImage: function () {
        console.log('processing image');
        app.AnonLog();
        var control = document.getElementById("profile-image1");
        console.log('control');
        console.log(control);
        var file;// = control.files[0];

        fetch(control.src)
            .then(res => res.blob())
            .then(blob => {
                file = new File([blob], 'dot.png', blob)
                console.log(file)
            })
            .then(() => {
                var reader = new FileReader();
                reader.onload = (function (theFile) {
                    return function (e) {
                        var img = document.createElement('img');
                        var image = null;
                        img.src = e.target.result;
                        var jpg = true;
                        try {
                            image = atob(e.target.result.split("data:image/jpeg;base64,")[1]);

                        } catch (e) {
                            jpg = false;
                        }
                        if (jpg == false) {
                            try {
                                image = atob(e.target.result.split("data:image/png;base64,")[1]);
                            } catch (e) {
                                console.log("Not an image file Rekognition can process");
                                return;
                            }
                        }
                        //unencode image bytes for Rekognition DetectFaces API
                        var length = image.length;
                        imageBytes = new ArrayBuffer(length);
                        var ua = new Uint8Array(imageBytes);
                        for (var i = 0; i < length; i++) {
                            ua[i] = image.charCodeAt(i);
                        }
                        //Call Rekognition
                        app.DetectFaces(imageBytes);
                    };
                })(file);
                reader.readAsDataURL(file);
            })

        // Load base64 encoded image

    },
    //Provides anonymous log on to AWS services
    AnonLog: function () {

        // Configure the credentials provider to use your identity pool
        AWS.config.region = 'us-east-2'; // Region
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-east-2:e3012882-17ac-4646-8f71-2e6064c02c6a',
        });
        // Make the call to obtain credentials
        AWS.config.credentials.get(function () {
            // Credentials will be available when this function is called.
            var accessKeyId = AWS.config.credentials.accessKeyId;
            var secretAccessKey = AWS.config.credentials.secretAccessKey;
            var sessionToken = AWS.config.credentials.sessionToken;
        });
    }
};

// document.getElementById("profile-image").addEventListener("change", function (event) {
//     ProcessImage();
// }, false);

//Calls DetectFaces API and shows estimated ages of detected faces



app.initialize();
function getHtml(template) {
    return template.join('\n');
}
listAlbums();
