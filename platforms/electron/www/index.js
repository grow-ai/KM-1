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
            alert('getUserMedia() is not supported by your browser :/');
        }
    },

    hasGetUserMedia: function () {
        return !!(navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia);
    },

    takePicture: function () {
        const captureVideoButton = document.querySelector('#open-camera');
        const screenshotButton = document.querySelector('#camera-capture');
        const img = document.querySelector('#profile-image');
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
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            // Other browsers will fall back to image/png
            img.src = canvas.toDataURL('image/png');
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
        AWS.region = "us-west-2";
        var rekognition = new AWS.Rekognition();
        var params = {
            Image: {
                Bytes: imageData
            },
            Attributes: [
                'ALL',
            ]
        };
        rekognition.detectFaces(params, function (err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
                var table = "<table><tr><th>Low</th><th>High</th></tr>";
                // show each face and build out estimated age table
                console.log(data);
                for (var i = 0; i < data.FaceDetails.length; i++) {
                    table += '<tr><td>' + data.FaceDetails[i].AgeRange.Low +
                        '</td><td>' + data.FaceDetails[i].AgeRange.High + '</td></tr>';
                }
                table += "</table>";
                document.getElementById("opResult").innerHTML = table;
            }
        });
    },
    //Loads selected image and unencodes image bytes for Rekognition DetectFaces API
    ProcessImage: function () {
        console.log('start');
        app.AnonLog();
        var control = document.getElementById("profile-image");
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
                                alert("Not an image file Rekognition can process");
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
        AWS.config.region = 'us-west-2'; // Region
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-west-2:705b1756-662c-4d6b-8f85-c6201a6a150e',
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
