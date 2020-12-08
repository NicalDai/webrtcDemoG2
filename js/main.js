/**
 * Create By Nical @ 20190525
 * NetEase Crop.
 */

let targetAccid;
let currentUid;
let isLogined = false;      // is nim logined
let isCalling = false;      // is in netcall
let isLocalAudioMuted = false;
let isRemoteAudioMuted = false;

let containerRemote;        // Remote video container
let acceptDiv;              // accept div
let callerInfoDiv;          // show caller info

let callerIcon;
let callerID;               // to show the info of user
let currentCallType;        // current call type
let currentCid = 0;         // current channel id
let hasNotified = false;    // be call notified
let beCallingId;    // be call information

let calleeBtn;
let hangupBtnCall;          // hangup Button when calling
let hangupBtnBeCalled;      // hangup Button be called
let microMuteBtn;           // mute forward voice stream
let speakerMuteBtn;         // mute receiving voice stream

let netcall;                // WebRTC instance initialized
let remoteStream;           //

let app_key = '45c6af3c98409b18a84451215d0bdd6e';
let app_secret = '37db56012b60';
let nonce = '12345';
let curTime = Math.floor(new Date().getTime()/1000);
let checkSum = SHA1(app_secret + nonce + curTime);

let currentAccid;           // current Logined accid;

/**
 * Window UI Bridge
 */
window.onload = function () {

    let targetAccidEdt = document.getElementById('targetAccid');
    let startCallBtn = document.getElementById('startCall');
    let logoutBtn = document.getElementById('logoutBtn');
    //divs
    callerInfoDiv = document.getElementById('callerInfoDiv');
    containerRemote = document.getElementById('containerRemote');
    acceptDiv = document.getElementById('mainwrapper1');
    //UserInfo Toast
    callerIcon = document.getElementById('callerIcon');
    callerID = document.getElementById('callerID');
    //buttons
    calleeBtn = document.getElementById('calleeBtn');
    hangupBtnCall = document.getElementById('hangupbtnCall');
    hangupBtnBeCalled = document.getElementById('hangupbtnbeCalled');
    microMuteBtn = document.getElementById('microMute');
    speakerMuteBtn = document.getElementById('speakerMute');

    /***************************** Button Click Event *******************************/
    microMuteBtn.onclick = function() {                                         // mute Local audio Stream
        if (isCalling){
            if (isLocalAudioMuted){
                rtc.localStream.unmuteAudio().then(function (obj) {
                    console.log("本地取消静音成功",obj);
                    microMuteBtn.src = 'res/microMute1.png';
                    isLocalAudioMuted = false;
                }).catch(function (err) {
                    console.log("本地取消静音失败",err);
                })
            }else {
                rtc.localStream.muteAudio().then(function (obj) {
                    console.log("本地静音成功",obj);
                    microMuteBtn.src = 'res/microMute2.png';
                    isLocalAudioMuted = true;
                }).catch(function (err) {
                    console.log("本地静音失败",err);
                })
            }
        }

    };
    speakerMuteBtn.onclick = function() {                                       // mute remote audio Stream
        if (isCalling){
            if (isRemoteAudioMuted){
                remoteStream.unmuteAudio().then(function (obj) {
                    console.log("取消对端静音成功",obj);
                    speakerMuteBtn.src = 'res/speakerMute1.png';
                    isRemoteAudioMuted = false;
                }).catch(function (err) {
                    console.log("取消对端静音失败",err);
                })
            } else {
                remoteStream.muteAudio().then(function (obj) {
                    console.log("对端静音成功",obj);
                    speakerMuteBtn.src = 'res/speakerMute2.png';
                    isRemoteAudioMuted = true;
                }).catch(function (err) {
                    console.log("对端静音失败",err);
                })
            }
        }
    };
    startCallBtn.onclick = function () {                                        //Start calling button action
        targetAccid = targetAccidEdt.value;
        if (!targetAccid){
            alert('Please input target accid!');
        }else if (!isLogined){
            alert('Please Login first!');
        } else {
            forwardCall(targetAccid);                                           //Main Enterance of WebRTC
        }
    };
    logoutBtn.onclick = function () {                                           //Logout action
        jumpBack();
    };
    hangupBtnCall.onclick = function () {                                       //Calling hangup button at middle
        sendCallNotification(targetAccid,'hangup');
        hangupAndClear();
    };
    calleeBtn.onclick = function () {                                           //accept call request
        sendCallNotification(targetAccid,'accept');
        joinChannel(targetAccid,new Date().getTime(),true);
    };
    hangupBtnBeCalled.onclick = function () {                                   //reject call request
        sendCallNotification(targetAccid,'reject');
        hangupAndClear(true);
    };
};

/***************************** NIM *******************************/

var nim = SDK.NIM.getInstance({                                                 // NIM init, initial for calling signal service.
    debug: true,
    db:true,
    appKey: '45c6af3c98409b18a84451215d0bdd6e',
    account: readCookie('accid'),
    token: readCookie('token'),
    onconnect: onConnect,
    onwillreconnect: onWillReconnect,
    ondisconnect: onDisconnect,
    onerror: onError,
    oncustomsysmsg: onCustomSysMsg,
    onmsg:onMsg
});

// for test
function onMsg(msg) {
    docLogUtil("收到消息", msg.content);
}

function onConnect() {                                                          // After NIM connect , init the G2 webrtc instance.
    isLogined = true;
    docLogUtil('Connection Established');
    console.log(nim);
    document.getElementById('log').value += 'Login Success '+ readCookie('accid') +'\n';
    currentAccid = readCookie('accid');
    initWebRTC();
}
function onWillReconnect(obj) {
    docLogUtil('Will Reconnect ' + obj.retryCount +' ' + obj.duration );
}
function onDisconnect(error) {
    docLogUtil('Lost Connection');
    console.log(error);
    if (error) {
        switch (error.code) {

            case 302: alert('Invalid account or password');
                jumpBack();
                break;

            case 417: alert('Already login at other terminal');
                jumpBack();
                break;

            case 'kicked': alert('Kicked,Please relogin');
                jumpBack();
                break;
            default: alert('Unknown Reason for disconnection');
                jumpBack();
                break;
        }
    }
}
function onError(error) {
    alert(error);
    window.location.href = './index.html';
    console.log(error);
}

/***************************** WebRTC *******************************/

/**
 * init WebRTC by nim
 */


let rtc = {                                                 // rtc object definition
    client: null,
    localStream: null,
};

function initWebRTC() {                                     // init webrtc 2.0 instance
    rtc.client = WebRTC2.createClient({
        appkey: '45c6af3c98409b18a84451215d0bdd6e',         // Your appkey
        debug: true,                                        // Enable specific log print
    });
    registerObserver();                                     // After init webrtc 2.0 , register some event observer, like calling receiver.. hangup receiver
}
/**
 * Some Observer within calling
 */
function registerObserver() {
    //监听用户进入频道事件
    rtc.client.on('peer-online', (_event) => {
        console.log(_event);
        docLogUtil('有人加入'+_event.channelId+'房间,用户uid是'+_event.uid);
    });
    //监听用户离开频道事件
    rtc.client.on('peer-leave', (_event) => {
        console.log(_event);
        docLogUtil('有人离开'+_event.channelId+'房间,用户uid是'+_event.uid);
    });
    //监听频道里其他人发布音视频
    rtc.client.on('stream-added', evt => {                                  // play remote video and audio stream
        remoteStream = evt.stream;
        docLogUtil('收到别人的发布消息'+remoteStream.streamID);
        // 发起视频订阅
        remoteStream.setSubscribeConfig({
            audio: true,
            video: true
        });
        rtc.client.subscribe(remoteStream).then(()=>{
            docLogUtil('订阅'+remoteStream.streamID+'对端成功');
        })
    });
    //监听频道里其他人停止发布音视频
    rtc.client.on('stream-removed', evt => {
        remoteStream = evt.stream;
        docLogUtil('对方停止发布: ', remoteStream.getId());
        remoteStream.stop()
    });
    //播放订阅的对端的音视频流
    rtc.client.on('stream-subscribed', evt => {                             // terminate the remote stream
        console.warn('订阅别人的流成功的通知');
        remoteStream = evt.stream;
        let div = document.getElementById('containerRemote');
        //开始播放远端音视频流
        remoteStream.play(div).then(()=>{
            docLogUtil('播放对端的流成功');
            remoteStream.setRemoteRenderMode({
                width: 360,
                height: 640,
                cut: true
            })
        })
    })
}

/**
 * forward calling
 * @param targetAccid
 */
function forwardCall(targetAccid) {
    sendCallNotification(targetAccid,'call');                   // send custom notification to ask target user for join the channel.
    joinChannel(currentAccid,new Date().getTime(),false);       // join WebRTC 2.0 channel.
}

/**
 * Main Action of Calling
 * @param channelName
 * @param uid
 * @param isCallin
 */

function joinChannel(channelName,uid,isCallin) {
    // send a post to get rtc token
    $.ajax({
        url: 'https://api.netease.im/nimserver/user/getToken.action',
        type: 'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8','AppKey':app_key,"Nonce":nonce,"CurTime":curTime,"CheckSum":checkSum},
        data : {"uid":uid},
        success: function (data) {
            docLogUtil('获取token结果',data.token);
            if (data.code === 200) {
                docLogUtil('获取token成功 ',data.token);
                // rtc.client.setChannelProfile({ mode:'live'});
                // start joinChannel
                rtc.client.join({
                    channelName: channelName,
                    uid: uid,
                    token: data.token
                }).then((obj) => {
                   currentCid = rtc.client.getChannelInfo().channelId;
                    console.log('---------',currentCid);
                    docLogUtil('加入频道成功...',obj);
                    currentUid = uid;
                    isCalling = true;
                    //start Rtc logic
                    if (isCallin){
                        startRTCConnect(uid);
                    }else {
                        showCallingUI(targetAccid);
                    }
                });
            } else {
                docLogUtil('获取token异常',data);
                hangupAndClear(true);
            }
        }
    });
}

/**
 * 开始采集初始化，发布流
 * */
function startRTCConnect(uid) {                                                 // start webrtc 2.0 engine
    showCallEstablishedUI();                                                    // Established UI process
    //初始化本地流并且发布
    // 此处以同时启动麦克风与摄像头(或者屏幕共享)设备示例
    WebRTC2.getDevices().then((devices)=>{
        var audioDevices = devices.audioIn;                                     //get the Array of microphone list
        var videoDevices = devices.video;                                       //get the Array of camera list

        var selectedMicrophoneId = audioDevices[0];
        var selectedCameraId = videoDevices[0];
        rtc.localStream = WebRTC2.createStream({
            uid: uid,
            audio: true,
            microphoneId: selectedMicrophoneId,                                 // assign the microphone we need open
            video: true,
            cameraId: selectedCameraId,                                         // assign the camera we need open
            // screen: true                                                     // if you need Screen sharing, please assign this field true，and assign field 'video' false.
        });

        rtc.localStream.init().then(()=>{
            //用于播放视频的div元素
            let div = document.getElementById('containerLocal');
            rtc.localStream.play(div);
            //设置播放的视频容器大小
            rtc.localStream.setLocalRenderMode({                                // show local video Stream
                width: 90,
                height: 180,
                cut: true
            });
            // 将本地音视频流发布至云信服务器
            rtc.client.publish(rtc.localStream).then(()=>{                      // send local video to Webrtc server
                console.warn('本地 publish 成功');
            }).catch(function (err) {
                console.error('rtc.client.publish',err);
            });
        }).catch(function (err) {
            console.error('localStream.init',err);
        })
    }).catch(function (err) {
        console.error('WebRTC2.getDevices()',err);
    });
}
/**
 * depose WebRTC and Clear UI
 */
function hangupAndClear(force) {
    if (isCalling || force){
        docLogUtil('You have hang up ' + currentCid + '\n'+'------------Session End--------------' +'\n');
        rtc.client.leave();
        isCalling = false;
        currentCallType = null;
        currentCid = 0;
        currentUid = 0;
        targetAccid = null;
        beCallingId = null;
        hasNotified = false;
        isRemoteAudioMuted = false;
        isLocalAudioMuted = false;
        rtc.localStream = null;
        resetUI();
    }
}
/**
 * config of WebRTC
 */

/***************************** Call Signal Control *******************************/

/**
 * Calling signal Logic
 * @param targetAccid send toward this accid
 * @param type  'call' 'reject' 'busy' 'hangup'
 */
function sendCallNotification(targetAccid,type) {
    let content = {
        type: type,
        account: nim.account,
    };
    content = JSON.stringify(content);
    let msgId = nim.sendCustomSysMsg({
        scene: 'p2p',
        to: targetAccid,
        content: content,
        sendToOnlineUsersOnly: true,
        apnsText: content,
        done: sendCustomSysMsgDone
    });
    docLogUtil('正在发送' + type + '的p2p自定义系统通知');
    function sendCustomSysMsgDone(error, msg) {
        docLogUtil('发送' + msg.scene + '自定义系统通知' + (!error?'成功':'失败'));
        console.log(error);
        console.log(msg);
    }
}


function onCustomSysMsg(sysMsg) {
    docLogUtil('收到自定义系统通知', sysMsg);
    processNotification(sysMsg);
}

function processNotification(sysMsg) {
    var obj = JSON.parse(sysMsg.content);
    docLogUtil('收到'+sysMsg.from+'的自定义系统通知，类型为'+obj.type);
    switch (obj.type) {
        case 'call':
            if (isCalling){
                isCalling = true;
                docLogUtil('收到呼叫来自'+obj.account+'的通话，但是正忙');
                sendCallNotification(obj.account,'busy');
                break;
            }
            targetAccid = obj.account;
            docLogUtil('收到呼叫来自'+obj.account+'的通话');
            showbeCalledUI(obj.account);
            break;
        case 'accept':
            targetAccid = obj.account;
            docLogUtil('对方'+targetAccid+'已接听');
            startRTCConnect(currentUid);
            break;
        case 'reject':
            docLogUtil('对方'+targetAccid+'拒接');
            hangupAndClear();
            break;
        case 'busy':
            docLogUtil('对方'+targetAccid+'正忙！');
            hangupAndClear();
            break;
        case 'hangup':
            docLogUtil('对方'+targetAccid+'挂断');
            hangupAndClear();
            break;
    }
}

/***************************** UI Logic *******************************/
/**
 * Jump back to Login Page
 */
function jumpBack() {
    window.location.href = './index.html';
}
/**
 * Calling UI Logic
 */
function showCallingUI(targetAccid) {
    acceptDiv.style.display = 'block';
    callerInfoDiv.style.display = 'block';
    hangupBtnCall.style.display = 'block';
    showUserInfo(targetAccid);
}
function showCallEstablishedUI() {
    acceptDiv.style.display = 'block';
    callerInfoDiv.style.display = 'none';
    calleeBtn.style.display = 'none';
    hangupBtnBeCalled.style.display = 'none';
    hangupBtnCall.style.display = 'block';
    microMuteBtn.style.display = 'block';
    speakerMuteBtn.style.display = 'block';
}
function showbeCalledUI(targetAccid) {
    calleeBtn.style.display = 'block';
    hangupBtnBeCalled.style.display = 'block';
    callerInfoDiv.style.display = 'block';
    acceptDiv.style.display = 'block';
    showUserInfo(targetAccid);
}
function showUserInfo(targetAccid) {
    nim.getUser({
        account: targetAccid,
        done: getUserDone
    });
}
function getUserDone(error, user) {
    console.log(error);
    console.log(user);
    docLogUtil('获取用户资料' + (!error?'成功':'失败'));
    if (!error) {
        callerID.value = user.nick;
        callerIcon.src = user.avatar;
    }
}
function resetUI() {
    acceptDiv.style.display = 'none';
    callerInfoDiv.style.display = 'none';
    hangupBtnCall.style.display = 'none';
    hangupBtnBeCalled.style.display = 'none';
    calleeBtn.style.display = 'none';
    microMuteBtn.style.display = 'none';
    speakerMuteBtn.style.display = 'none';
    microMuteBtn.src = 'res/microMute1.png';
    speakerMuteBtn.src = 'res/speakerMute1.png';
}

/***** log util *****/
function docLogUtil(val) {
    console.log('---demolog---',val);
    document.getElementById('log').value += val + '\n';
}

