/*
 *  Copyright (c) 2021 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

try {
  navigator.mediaDevices.enumerateDevices()
      .then(gotSources);
} catch (e) {
  console.log(e);
}

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
hangupButton.disabled = true;

const audioSelect = document.querySelector('select#audioSrc');
const videoSelect = document.querySelector('select#videoSrc');

audioSelect.onchange = videoSelect.onchange = getMedia;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const selectSourceDiv = document.querySelector('div#selectSource');

let pc;
let localStream;

function gotSources(sourceInfos) {
  selectSourceDiv.classList.remove('hidden');
  let audioCount = 0;
  let videoCount = 0;
  for (let i = 0; i < sourceInfos.length; i++) {
    const option = document.createElement('option');
    option.value = sourceInfos[i].deviceId;
    option.text = sourceInfos[i].label;
    if (sourceInfos[i].kind === 'audioinput') {
      audioCount++;
      if (option.text === '') {
        option.text = `Audio ${audioCount}`;
      }
      audioSelect.appendChild(option);
    } else if (sourceInfos[i].kind === 'videoinput') {
      videoCount++;
      if (option.text === '') {
        option.text = `Video ${videoCount}`;
      }
      videoSelect.appendChild(option);
    } else {
      console.log('unknown', JSON.stringify(sourceInfos[i]));
    }
  }
}

async function getMedia() {
  if (localStream) {
    localVideo.srcObject = null;
    localStream.getTracks().forEach(track => track.stop());
  }
  const audioSource = audioSelect.value;
  console.log(`Selected audio source: ${audioSource}`);
  const videoSource = videoSelect.value;
  console.log(`Selected video source: ${videoSource}`);

  const constraints = {
    audio: {
      optional: [{
        sourceId: audioSource
      }]
    },
    video: {
      optional: [{
        sourceId: videoSource
      }]
    }
  };
  console.log('Requested local stream');
  try {
    const userMedia = await navigator.mediaDevices.getUserMedia(constraints);
    gotStream(userMedia);
  } catch (e) {
    console.log('navigator.getUserMedia error: ', e);
  }
}

function gotStream(stream) {
  console.log('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
}

const signaling = new BroadcastChannel('webrtc2');
signaling.onmessage = e => {
  if (!localStream) {
    console.log('not ready yet');
    return;
  }
  console.log('received', e.data);
  switch (e.data.type) {
    case 'offer':
      handleOffer(e.data);
      break;
    case 'answer':
      handleAnswer(e.data);
      break;
    case 'candidate':
      handleCandidate(e.data);
      break;
    case 'ready':
      // A second tab joined. This tab will initiate a call unless in a call already.
      if (pc) {
        console.log('already in call, ignoring');
        return;
      }
      makeCall();
      break;
    case 'bye':
      if (pc) {
        hangup();
      }
      break;
    default:
      console.log('unhandled', e);
      break;
  }
};

function sendSignalingMessage(message) {
  console.log('sending', message);
  signaling.postMessage(message);
}

startButton.onclick = async () => {
  // localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  // localVideo.srcObject = localStream;

  startButton.disabled = true;
  hangupButton.disabled = false;
  
  await getMedia();
  sendSignalingMessage({type: 'ready'});
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
  pc = new RTCPeerConnection();
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
  sendSignalingMessage({type: 'offer', sdp: offer.sdp});
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
  sendSignalingMessage({type: 'answer', sdp: answer.sdp});
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