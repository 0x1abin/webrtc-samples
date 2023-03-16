/*
 *  Copyright (c) 2021 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

// try {
//   navigator.mediaDevices.enumerateDevices().then(gotSources);
// } catch (e) {
//   console.log(e);
// }

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
hangupButton.disabled = true;

// const audioSelect = document.querySelector('select#audioSrc');
// const videoSelect = document.querySelector('select#videoSrc');

// audioSelect.onchange = videoSelect.onchange = getMedia;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const selectSourceDiv = document.querySelector('div#selectSource');

const localPeerIDTextarea = document.querySelector('div#localPeerID textarea');
const remotePeerIDTextarea = document.querySelector('div#remotePeerID textarea');

let pc;
let localStream;
let client;

let remotePeerID;
const localPeerID = Math.random().toString(10).substr(2, 4);
console.log('peerIdentity:', localPeerID);
localPeerIDTextarea.value = localPeerID;

// myPeerID.textContent = peerIdentity;


////////

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId}`);
        })
        .catch(error => {
          let errorMessage = error;
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
          // Jump back to first output device in the list as it's the default.
          audioOutputSelect.selectedIndex = 0;
        });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  attachSinkId(localVideo, audioDestination);
}

function gotStream(stream) {
  console.log('Received local stream');
  window.stream = stream; // make stream available to console
  localVideo.srcObject = stream;
  localStream = stream;
  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function getMedia() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
}

audioInputSelect.onchange = getMedia;
audioOutputSelect.onchange = changeAudioDestination;

videoSelect.onchange = getMedia;

// start();
///////


// function gotSources(sourceInfos) {
//   selectSourceDiv.classList.remove('hidden');
//   let audioCount = 0;
//   let videoCount = 0;
//   for (let i = 0; i < sourceInfos.length; i++) {
//     const option = document.createElement('option');
//     option.value = sourceInfos[i].deviceId;
//     option.text = sourceInfos[i].label;
//     if (sourceInfos[i].kind === 'audioinput') {
//       audioCount++;
//       if (option.text === '') {
//         option.text = `Audio ${audioCount}`;
//       }
//       audioSelect.appendChild(option);
//     } else if (sourceInfos[i].kind === 'videoinput') {
//       videoCount++;
//       if (option.text === '') {
//         option.text = `Video ${videoCount}`;
//       }
//       videoSelect.appendChild(option);
//     } else {
//       console.log('unknown', JSON.stringify(sourceInfos[i]));
//     }
//   }
// }

// async function getMedia() {
//   if (localStream) {
//     localVideo.srcObject = null;
//     localStream.getTracks().forEach(track => track.stop());
//   }
//   const audioSource = audioSelect.value;
//   console.log(`Selected audio source: ${audioSource}`);
//   const videoSource = videoSelect.value;
//   console.log(`Selected video source: ${videoSource}`);

//   const constraints = {
//     audio: {
//       optional: [{
//         sourceId: audioSource
//       }]
//     },
//     video: {
//       optional: [{
//         sourceId: videoSource
//       }]
//     }
//   };
//   console.log('Requested local stream');
//   try {
//     const userMedia = await navigator.mediaDevices.getUserMedia(constraints);
//     gotStream(userMedia);
//   } catch (e) {
//     console.log('navigator.getUserMedia error: ', e);
//   }
// }

// function gotStream(stream) {
//   console.log('Received local stream');
//   localVideo.srcObject = stream;
//   localStream = stream;
// }

function mqttConnect() {
  const url = 'wss://broker-cn.emqx.io:8084/mqtt';
  const options = {
    keepalive: 30,
    clientId: localPeerID,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {
      topic: 'WillMsg',
      payload: 'Connection Closed abnormally..!',
      qos: 0,
      retain: false
    },
    rejectUnauthorized: false
  };
  client = mqtt.connect(url, options);

  client.on('connect', function() {
    // client.subscribe('presence', function(err) {
    //   if (!err) {
    //     client.publish('presence', 'Hello mqtt');
    //   }
    // });
    client.subscribe('webrtc/signling/' + localPeerID, function(err) {
      // if (!err) {
      //   client.publish('webrtc/signling/id001', 'webrtc/signling/id001');
      // }
    });
  });

  client.on('message', function(topic, message) {
    // message is Buffer
    console.log('topic:'+ topic + ' message: ' + message);

    if (!localStream) {
      console.log('not ready yet');
      return;
    }

    const data = JSON.parse(message);

    console.log('received', data);
    switch (data.type) {
      case 'offer':
        handleOffer(data);
        break;
      case 'answer':
        handleAnswer(data);
        break;
      case 'candidate':
        handleCandidate(data);
        break;
      case 'ready':
        // A second tab joined. This tab will initiate a call unless in a call already.
        if (pc) {
          console.log('already in call, ignoring');
          return;
        }
        remotePeerID = data.from;
        makeCall();
        break;
      case 'bye':
        if (pc) {
          hangup();
        }
        break;
      default:
        console.log('unhandled', data);
        break;
    }
  });

    // client.end()
}

// const signaling = new BroadcastChannel('webrtc2');
// signaling.onmessage = e => {
//   if (!localStream) {
//     console.log('not ready yet');
//     return;
//   }
//   console.log('received', e.data);
//   switch (e.data.type) {
//     case 'offer':
//       handleOffer(e.data);
//       break;
//     case 'answer':
//       handleAnswer(e.data);
//       break;
//     case 'candidate':
//       handleCandidate(e.data);
//       break;
//     case 'ready':
//       // A second tab joined. This tab will initiate a call unless in a call already.
//       if (pc) {
//         console.log('already in call, ignoring');
//         return;
//       }
//       makeCall();
//       break;
//     case 'bye':
//       if (pc) {
//         hangup();
//       }
//       break;
//     default:
//       console.log('unhandled', e);
//       break;
//   }
// };

function sendSignalingMessage(message) {
  console.log('sending', message);
  // signaling.postMessage(message);
  client.publish('webrtc/signling/' + remotePeerID, JSON.stringify(message));
}

startButton.onclick = async () => {
  // localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  // localVideo.srcObject = localStream;

  startButton.disabled = true;
  callButton.disabled = true;
  hangupButton.disabled = false;

  remotePeerID = remotePeerIDTextarea.value;
  console.log('remotePeerID: ', remotePeerID);

  await mqttConnect();
  await getMedia();
  // sendSignalingMessage({type: 'ready'});
};

callButton.onclick = async () => {
  // localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  // localVideo.srcObject = localStream;

  startButton.disabled = true;
  callButton.disabled = true;
  hangupButton.disabled = false;

  remotePeerID = remotePeerIDTextarea.value;
  console.log('remotePeerID: ', remotePeerID);

  await mqttConnect();
  await getMedia();
  sendSignalingMessage({type: 'ready', from: localPeerID});
};

hangupButton.onclick = async () => {
  hangup();
  sendSignalingMessage({type: 'bye'});
};

async function hangup() {
  if (pc) {
    pc.close();
    pc = null;
  }
  localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  startButton.disabled = false;
  hangupButton.disabled = true;
};

function createPeerConnection() {
  pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.ioiot.cc:3478'}]});
  pc.onicecandidate = e => {
    const message = {
      type: 'candidate',
      candidate: null,
    };
    if (e.candidate) {
      message.candidate = e.candidate.candidate;
      message.sdpMid = e.candidate.sdpMid;
      message.sdpMLineIndex = e.candidate.sdpMLineIndex;
    }
    sendSignalingMessage(message);
  };
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function makeCall() {
  await createPeerConnection();

  const offer = await pc.createOffer();
  sendSignalingMessage({ type: 'offer', sdp: offer.sdp });
  await pc.setLocalDescription(offer);
}

async function handleOffer(offer) {
  if (pc) {
    console.error('existing peerconnection');
    return;
  }
  await createPeerConnection();
  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  sendSignalingMessage({ type: 'answer', sdp: answer.sdp });
  await pc.setLocalDescription(answer);
}

async function handleAnswer(answer) {
  if (!pc) {
    console.error('no peerconnection');
    return;
  }
  await pc.setRemoteDescription(answer);
}

async function handleCandidate(candidate) {
  if (!pc) {
    console.error('no peerconnection');
    return;
  }
  if (!candidate.candidate) {
    await pc.addIceCandidate(null);
  } else {
    await pc.addIceCandidate(candidate);
  }
}

// getMedia();