// link to camera example code weritten in java and used in this sample
// https://github.com/googlesamples/android-Camera2Basic/blob/master/Application/src/main/java/com/example/android/camera2basic/Camera2BasicFragment.java#L323

// link to example iOS native camera in Nativescript code used in this sample
// https://github.com/NativeScript/sample-iOS-CameraApp


var permissions = require("nativescript-permissions");
var app = require('application');
var page;

// for iOS output
var output;

// for android camera2
if (app.android) {
    var mCameraId;
    var mCaptureSession;
    var mCameraDevice;
    var mStateCallBack;
    var mBackgroundHandler = null;
    var mCameraOpenCloseLock = new java.util.concurrent.Semaphore(1);
    var mTextureView;
    var mSurfaceTexture;
    var mPreviewRequestBuilder;
    var mPreviewRequest;
    var mImageReader;
    var mCaptureCallback;
    var mFlashSupported;
    var mFile;
    var ORIENTATIONS = new android.util.SparseIntArray();
    
    ORIENTATIONS.append(android.view.Surface.ROTATION_0, 90);
    ORIENTATIONS.append(android.view.Surface.ROTATION_90, 0);
    ORIENTATIONS.append(android.view.Surface.ROTATION_180, 270);
    ORIENTATIONS.append(android.view.Surface.ROTATION_270, 180);
}

var STATE_PREVIEW = 0;
var STATE_WAITING_LOCK = 1;
var STATE_WAITING_PRECAPTURE = 2;
var STATE_WAITING_NON_PRECAPTURE = 3;
var STATE_PICTURE_TAKEN = 4;
var mState = STATE_PREVIEW;

function onLoaded(args) {
    page = args.object;


}
exports.onLoaded = onLoaded;

function onTakeShot(args) {
    if (app.ios) {
        var videoConnection = output.connections[0];
        output.captureStillImageAsynchronouslyFromConnectionCompletionHandler(videoConnection, function (buffer, error) {
            var imageData = AVCaptureStillImageOutput.jpegStillImageNSDataRepresentation(buffer);
            var image = UIImage.imageWithData(imageData);
            UIImageWriteToSavedPhotosAlbum(image, null, null, null);
            AudioServicesPlaySystemSound(144);
        });
    } else if (app.android) {
        console.log("onTakeShot");
        lockFocus();
    }
}
exports.onTakeShot = onTakeShot;

function lockFocus() {
    console.log("lockFocus");
    mPreviewRequestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AF_TRIGGER, new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_AF_TRIGGER_START));
    mPreviewRequestBuilder.set(android.hardware.camera2.CaptureRequest.FLASH_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.FLASH_MODE_TORCH));
    mState = STATE_WAITING_LOCK;
    mCaptureSession.capture(mPreviewRequestBuilder.build(), mCaptureCallback, mBackgroundHandler);
}

function runPrecaptureSequence() {
    // This is how to tell the camera to trigger.
    mPreviewRequestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER, android.hardware.camera2.CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER_START);
    // Tell #mCaptureCallback to wait for the precapture sequence to be set.
    mState = STATE_WAITING_PRECAPTURE;
    mCaptureSession.capture(mPreviewRequestBuilder.build(), mCaptureCallback, mBackgroundHandler);
}

function captureStillPicture() {
    // This is the CaptureRequest.Builder that we use to take a picture.
    var captureBuilder = mCameraDevice.createCaptureRequest(android.hardware.camera2.CameraDevice.TEMPLATE_STILL_CAPTURE);
    captureBuilder.addTarget(mImageReader.getSurface());

    // Use the same AE and AF modes as the preview.
    captureBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE, new java.lang.Integer(android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE));
    setAutoFlash(captureBuilder);

    // Orientation
    var rotation = app.android.context.getSystemService(android.content.Context.WINDOW_SERVICE).getDefaultDisplay().getRotation();
    captureBuilder.set(android.hardware.camera2.CaptureRequest.JPEG_ORIENTATION, new java.lang.Integer(ORIENTATIONS.get(rotation))); 


    var captureListener = android.hardware.camera2.CameraCaptureSession.CaptureCallback.extend({
        onCaptureProgressed: function (session, request, partialResult) {
            console.log("onCaptureProgressed");
        },
        onCaptureCompleted: function (session, request, result) {
            console.log("onCaptureCompleted");
            console.log("Saved at :"+ mFile);
            unlockFocus();
            if (callback && typeof(callback) === "function") {
                console.log("Sending path at callback :"+ file.getAbsolutePath());
                callback(mFile.getAbsolutePath());
            }
        },
        onCaptureFailed: function (session, request, failure) {
            console.log("onCaptureFailed");
            console.log(failure);
            if (callback && typeof(callback) === "function") {
                console.log("Sending path at callback :"+ null);
                callback(null);
            }
        }
    });

    mCaptureSession.stopRepeating();
    mCaptureSession.abortCaptures();
    mCaptureSession.capture(captureBuilder.build(), new captureListener(), null);
}

function unlockFocus(){
    try {
        // Reset the auto-focus trigger
        mPreviewRequestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AF_TRIGGER,
            new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_AF_TRIGGER_CANCEL));
        setAutoFlash(mPreviewRequestBuilder);
        mCaptureSession.capture(mPreviewRequestBuilder.build(), mCaptureCallback,
                mBackgroundHandler);
        // After this, the camera will go back to the normal state of preview.
        mState = STATE_PREVIEW;
        mCaptureSession.setRepeatingRequest(mPreviewRequest, mCaptureCallback,
                mBackgroundHandler);
    } catch (e) {
        console.log(e);
    }
}

function setAutoFlash(requestBuilder) {
    console.log("mFlashSupported in setAutoFlash:" + mFlashSupported);
    if (mFlashSupported) {
        requestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AE_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_AE_MODE_ON_AUTO_FLASH));
    }
}

function createCameraPreviewSession() {
    console.log("createCameraPreviewSession");

    if (!mSurfaceTexture || !mCameraDevice) {
        return;
    }

    var texture = mTextureView.getSurfaceTexture();

    // We configure the size of default buffer to be the size of camera preview we want.
    texture.setDefaultBufferSize(800, 480);

    // This is the output Surface we need to start preview.
    var surface = new android.view.Surface(texture);

    // // We set up a CaptureRequest.Builder with the output Surface.
    mPreviewRequestBuilder = mCameraDevice.createCaptureRequest(android.hardware.camera2.CameraDevice.TEMPLATE_PREVIEW);
    mPreviewRequestBuilder.addTarget(surface);

    var surfaceList = new java.util.ArrayList();
    surfaceList.add(surface);
    mCameraDevice.createCaptureSession(surfaceList, new MyCameraCaptureSessionStateCallback(), null);
}

function onCreatingView(args) {

    if (app.ios) {
        var session = new AVCaptureSession();
        session.sessionPreset = AVCaptureSessionPreset1280x720;

        // Adding capture device
        var device = AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo);
        var input = AVCaptureDeviceInput.deviceInputWithDeviceError(device, null);
        if (!input) {
            throw new Error("Error trying to open camera.");
        }
        session.addInput(input);

        output = new AVCaptureStillImageOutput();
        session.addOutput(output);

        session.startRunning();

        var videoLayer = AVCaptureVideoPreviewLayer.layerWithSession(session);

        var view = UIView.alloc().initWithFrame({ origin: { x: 0, y: 0 }, size: { width: 400, height: 600 } });
        videoLayer.frame = view.bounds;
        view.layer.addSublayer(videoLayer);
        args.view = view;

    } else if (app.android) {
        var appContext = app.android.context;

        var cameraManager = appContext.getSystemService(android.content.Context.CAMERA_SERVICE);
        var cameras = cameraManager.getCameraIdList();

        for (var index = 0; index < cameras.length; index++) {
            var currentCamera = cameras[index];
            var currentCameraSpecs = cameraManager.getCameraCharacteristics(currentCamera);

            var available = currentCameraSpecs.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE);
            mFlashSupported = available == null ? false : true;

            // get available lenses and set the camera-type (front or back)
            var facing = currentCameraSpecs.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);

            if (facing !== null && facing == android.hardware.camera2.CameraCharacteristics.LENS_FACING_BACK) {
                console.log("BACK camera");
                mCameraId = currentCamera;
            }

            // get all available sizes ad set the format
            var map = currentCameraSpecs.get(android.hardware.camera2.CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            var format = map.getOutputSizes(android.graphics.ImageFormat.JPEG);
            // console.log("Format: " + format + " " + format.length + " " + format[4]);

            // we are taking not the largest possible but some of the 5th in the list of resolutions
            if (format && format !== null) {
                var dimensions = format[0].toString().split('x');
                var largestWidth = +dimensions[0];
                var largestHeight = +dimensions[1];

                // set the output image characteristics
                mImageReader = new android.media.ImageReader.newInstance(largestWidth, largestHeight, android.graphics.ImageFormat.JPEG, /*maxImages*/2);
                mImageReader.setOnImageAvailableListener(mOnImageAvailableListener, mBackgroundHandler);
            }

        }

        mStateCallBack = new MyStateCallback();

        //API 23 runtime permission check
        if (android.os.Build.VERSION.SDK_INT > android.os.Build.VERSION_CODES.LOLLIPOP) {
            console.log("checking presmisions ....");

            if (android.support.v4.content.ContextCompat.checkSelfPermission(appContext, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {

                console.log("Permison already granted!!!!!");
                cameraManager.openCamera(mCameraId, mStateCallBack /*mCameraDeviceStateCallback*/, mBackgroundHandler);

            } else if (android.support.v4.content.ContextCompat.checkSelfPermission(appContext, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_DENIED) {
                console.log("NO PERMISIONS - about to try get them!!!"); // I am crashing here - wrong reference for shouldShowRequestPermissionRationale !?
                permissions.requestPermission(android.Manifest.permission.CAMERA, "I need these permissions to use Android Camera")
                    .then(function () {
                        console.log("Woo Hoo, I have the power!");
                        cameraManager.openCamera(mCameraId, mStateCallBack, mBackgroundHandler);
                    })
                    .catch(function () {
                        console.log("Uh oh, no permissions - plan B time!");
                    });
            }
        } else {
            cameraManager.openCamera(mCameraId, mStateCallBack, mBackgroundHandler);
        }

        // cameraManager.openCamera(mCameraId, mStateCallBack, mBackgroundHandler);

        mTextureView = new android.view.TextureView(app.android.context);
        mTextureView.setSurfaceTextureListener(mSurfaceTextureListener);
        args.view = mTextureView;
    }

}
exports.onCreatingView = onCreatingView;

// from Java ; public static abstract class
var MyCameraCaptureSessionStateCallback = android.hardware.camera2.CameraCaptureSession.StateCallback.extend({
    onConfigured: function (cameraCaptureSession) {
        console.log("onConfigured " + cameraCaptureSession);

        if (mCameraDevice === null) {
            return;
        }

        mCaptureSession = cameraCaptureSession;

        mPreviewRequestBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE,new java.lang.Integer(android.hardware.camera2.CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE));
        // // Flash is automatically enabled when necessary.
        // setAutoFlash(mPreviewRequestBuilder);

        // Finally, we start displaying the camera preview.
        mPreviewRequest = mPreviewRequestBuilder.build();
        mCaptureSession.setRepeatingRequest(mPreviewRequest, new MyCaptureSessionCaptureCallback(), null);

    },
    onConfigureFailed: function (cameraCaptureSession) {
        console.log("onConfigureFailed " + cameraCaptureSession);
    }
});

// from Java : public static abstract class
var MyCaptureSessionCaptureCallback = android.hardware.camera2.CameraCaptureSession.CaptureCallback.extend({
    process: function (result) {
        switch (mState) {
            case STATE_PREVIEW: {
                // We have nothing to do when the camera preview is working normally.
                break;
            }
            case STATE_WAITING_LOCK: {
                var afState = result.get(android.hardware.camera2.CaptureResult.CONTROL_AF_STATE);
                if (afState === null) {
                    captureStillPicture();
                } else if (android.hardware.camera2.CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED == afState ||
                    android.hardware.camera2.CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED == afState) {
                    // CONTROL_AE_STATE can be null on some devices
                    var aeState = result.get(android.hardware.camera2.CaptureResult.CONTROL_AE_STATE);
                    if (aeState === null ||
                        aeState == android.hardware.camera2.CaptureResult.CONTROL_AE_STATE_CONVERGED) {
                        mState = STATE_PICTURE_TAKEN;
                        captureStillPicture();
                    } else {
                        runPrecaptureSequence();
                    }
                }
                break;
            }
            case STATE_WAITING_PRECAPTURE: {
                // CONTROL_AE_STATE can be null on some devices
                var aeStatee = result.get(android.hardware.camera2.CaptureResult.CONTROL_AE_STATE);
                if (aeStatee === null ||
                    aeStatee == android.hardware.camera2.CaptureResult.CONTROL_AE_STATE_PRECAPTURE ||
                    aeStatee == android.hardware.camera2.CaptureRequest.CONTROL_AE_STATE_FLASH_REQUIRED) {
                    mState = STATE_WAITING_NON_PRECAPTURE;
                }
                break;
            }
            case STATE_WAITING_NON_PRECAPTURE: {
                // CONTROL_AE_STATE can be null on some devices
                var aeStateee = result.get(android.hardware.camera2.CaptureResult.CONTROL_AE_STATE);
                if (aeStateee === null || aeStateee != android.hardware.camera2.CaptureResult.CONTROL_AE_STATE_PRECAPTURE) {
                    mState = STATE_PICTURE_TAKEN;
                    captureStillPicture();
                }
                break;
            }
        }
    },
    onCaptureProgressed: function (session, request, partialResult) {
        // console.log("onCaptureProgressed");
        this.process(partialResult);
    },
    onCaptureCompleted: function (session, request, result) {
        // console.log("onCaptureCompleted");
        this.process(result);
    },
    onCaptureFailed: function (session, request, failure) {
        // console.log("onCaptureFailed");
        console.log(failure);
    }
});

// (example for: java static interface to javaScript )
// from Java : public static interface    
var mOnImageAvailableListener = new android.media.ImageReader.OnImageAvailableListener({
    onImageAvailable: function (reader) {

        // here we should save our image to file when image is available
        console.log("onImageAvailable");
        console.log(reader);
    }
});

// from Java : public static interface    
var mSurfaceTextureListener = new android.view.TextureView.SurfaceTextureListener({

    onSurfaceTextureAvailable: function (texture, width, height) {
        console.log('onSurfaceTextureAvailable');
        mSurfaceTexture = texture;
        createCameraPreviewSession();
        // openCamera(width, height);
    },

    onSurfaceTextureSizeChanged: function (texture, width, height) {
        console.log('onSurfaceTextureSizeChanged');
        // configureTransform(width, height);
    },

    onSurfaceTextureDestroyed: function (texture) {
        // console.log("onSurfaceTextureDestroyed");
        return true;
    },

    onSurfaceTextureUpdated: function (texture) {
        // console.log("onSurfaceTexturUpdated");
    },

});

// from Java : public static abstract class
var MyStateCallback = android.hardware.camera2.CameraDevice.StateCallback.extend({
    onOpened: function (cameraDevice) {
        console.log("onOpened " + cameraDevice);

        mCameraOpenCloseLock.release();
        mCameraDevice = cameraDevice;
        createCameraPreviewSession();
    },
    onDisconnected: function (cameraDevice) {
        console.log("onDisconnected");

        mCameraOpenCloseLock.release();
        cameraDevice.close();
        mCameraDevice = null;
    },
    onError: function (cameraDevice, error) {
        console.log("onError");
        console.log("onError: device = " + cameraDevice);
        console.log("onError: error =  " + error);

        mCameraOpenCloseLock.release();
        cameraDevice.close();
        mCameraDevice = null;
    },
    onClosed: function (cameraDevice) {
        console.log("onClosed");
    }
});
takePicture = function(callback) {
    console.log("takePicture");
    if(mCameraDevice == null){
        console.log("cameraDevice is null");
        return;
    }
    cameraManager = app.android.context.getSystemService(android.content.Context.CAMERA_SERVICE);
    try{
        var characteristics = cameraManager.getCameraCharacteristics(mCameraDevice.getId());
        var jpegSizes;
        if(characteristics != null){
            jpegSizes = characteristics.get(android.hardware.camera2.CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP).getOutputSizes(android.graphics.ImageFormat.JPEG);
        }
        var width = 480;
        var height = 640;
        if(jpegSizes != null && 0 < jpegSizes.length){
            width = jpegSizes[0].getWidth();
            height = jpegSizes[0].getHeight();
        }
        var reader = new android.media.ImageReader.newInstance(width,height,android.graphics.ImageFormat.JPEG,1);
        var outputSurfaces = new java.util.ArrayList(2);
        console.log("#### outputSurfaces "+outputSurfaces);
        console.log("#### outputSurfaces "+typeof(outputSurfaces));
        outputSurfaces.add(reader.getSurface());
        outputSurfaces.add(new android.view.Surface(mTextureView.getSurfaceTexture()));
        console.log("#### "+outputSurfaces);
        var captureBuilder = mCameraDevice.createCaptureRequest(android.hardware.camera2.CameraDevice.TEMPLATE_STILL_CAPTURE);
        captureBuilder.addTarget(reader.getSurface());
        captureBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_MODE_AUTO));
        var rotation = app.android.context.getSystemService(android.content.Context.WINDOW_SERVICE).getDefaultDisplay().getRotation();
        captureBuilder.set(android.hardware.camera2.CaptureRequest.JPEG_ORIENTATION, new java.lang.Integer(ORIENTATIONS.get(rotation)));
        if(flashMode){
        //Flash On
        if(mFlashSupported){
                captureBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AE_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_AE_MODE_ON_ALWAYS_FLASH));
                captureBuilder.set(android.hardware.camera2.CaptureRequest.FLASH_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.FLASH_MODE_TORCH));
                console.log("Flash Mode ON");
            }
        } else {
        //Flash Off
            captureBuilder.set(android.hardware.camera2.CaptureRequest.CONTROL_AE_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.CONTROL_AE_MODE_ON));
            captureBuilder.set(android.hardware.camera2.CaptureRequest.FLASH_MODE, new java.lang.Integer(android.hardware.camera2.CameraMetadata.FLASH_MODE_OFF));
            console.log("Flash Mode OFF");
        }
        var file = new java.io.File(utils.ad.getApplicationContext().getExternalFilesDir(null).getAbsolutePath() + "/AIMG_" + createDateTimeStamp() + ".jpg");
        if (android.support.v4.content.ContextCompat.checkSelfPermission(app.android.context, android.Manifest.permission.WRITE_EXTERNAL_STORAGE) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            var dir = new java.io.File(android.os.Environment.getExternalStorageDirectory(),"POC");
            if(!(dir.exists() && dir.isDirectory())){
                dir.mkdir();
            }
            file = new java.io.File(android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/POC/AIMG_" + createDateTimeStamp() + ".jpg");
        }
        path = file;
        save = function (bytes) {
            console.log("save");
            var output;
            try{
                output = new java.io.FileOutputStream(file);
                output.write(bytes);
                console.log("output.write(bytes)");
                output.close();
                console.log("output.write(bytes)");
            } catch(e){
                console.log(e);
                if (callback && typeof(callback) === "function") {
                    console.log("Sending path at callback :"+ null);
                    callback(null);
                }
            } finally {
                
            }
        };
        var readerListener = new android.media.ImageReader.OnImageAvailableListener({
            onImageAvailable: function (reader) {
                console.log("onImageAvailable");
                try{
                    image = reader.acquireLatestImage();
                    buffer = image.getPlanes()[0].getBuffer();
                    bytes = Array.create("byte", buffer.capacity());
                    buffer.get(bytes);
                    save(bytes);
                    console.log("save(bytes)");
                } catch(e){
                    console.log(e);
                    if (callback && typeof(callback) === "function") {
                        console.log("Sending path at callback :"+ null);
                        callback(null);
                    }
                } finally {
                    if (image != null){
                        image.close();
                        console.log("image.close()");
                    }
                }
            }
        });  
        reader.setOnImageAvailableListener(readerListener, mBackgroundHandler);
        var captureListener = android.hardware.camera2.CameraCaptureSession.CaptureCallback.extend({
            onCaptureProgressed: function (session, request, partialResult) {
                console.log("onCaptureProgressed");
            },
            onCaptureCompleted: function (session, request, result) {
                console.log("onCaptureCompleted");
                console.log("Saved at :"+ file);
                if (callback && typeof(callback) === "function") {
                    console.log("Sending path at callback :"+ file.getAbsolutePath());
                    callback(file.getAbsolutePath());
                }
            },
            onCaptureFailed: function (session, request, failure) {
                console.log("onCaptureFailed");
                console.log(failure);
                if (callback && typeof(callback) === "function") {
                    console.log("Sending path at callback :"+ null);
                    callback(null);
                }
            }
        });
        var cameraCaptureSessionStateCallback = android.hardware.camera2.CameraCaptureSession.StateCallback.extend({
            onConfigured: function (cameraCaptureSession) {
                console.log("onConfigured## " + cameraCaptureSession);
                try{
                    
                    console.log("onConfigured try ");
                    cameraCaptureSession.capture(captureBuilder.build(), new captureListener(), mBackgroundHandler);
                } catch(e){
                    console.log("onConfigured# " + e);
                    if (callback && typeof(callback) === "function") {
                        console.log("Sending path at callback :"+ null);
                        callback(null);
                    }
                }        
            },
            onConfigureFailed: function (cameraCaptureSession) {
                console.log("onConfigureFailed " + cameraCaptureSession);
                if (callback && typeof(callback) === "function") {
                    console.log("Sending path at callback :"+ null);
                    callback(null);
                }
            }
        });
        mCameraDevice.createCaptureSession(outputSurfaces,new cameraCaptureSessionStateCallback(), mBackgroundHandler);
    } catch(e){
        console.log(e);
        if (callback && typeof(callback) === "function") {
            console.log("Sending path at callback :"+ null);
            callback(null);
        }
    }
    return path;
};
createDateTimeStamp = function() {
    var result = "";
    var date = new Date();
    result = date.getFullYear().toString() +
        ((date.getMonth() + 1) < 10 ? "0" + (date.getMonth() + 1).toString() : (date.getMonth() + 1).toString()) +
        (date.getDate() < 10 ? "0" + date.getDate().toString() : date.getDate().toString()) + "_" +
        date.getHours().toString() +
        date.getMinutes().toString() +
        date.getSeconds().toString();

    return result;
};
