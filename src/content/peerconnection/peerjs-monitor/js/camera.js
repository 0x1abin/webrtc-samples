// client-side js, loaded by index.html
// run by the browser each time the page is loaded
// async function mediaPrevLoading() {
//   console.log('camera.js loaded');
//   await navigator.mediaDevices.getUserMedia({audio: true, video: true});
//   console.log('media getted');
//   await navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
//   console.log('media devices enumerated');
// }

// mediaPrevLoading();

const Peer = window.Peer;
const urlParams = new URLSearchParams(window.location.search);
const myPeerId = urlParams.get('peerId');
const remoteId = urlParams.get('remoteId');
console.log('myPeerId:', myPeerId);
console.log('remoteId:', remoteId);

let mediaConnection = null;
let dataConnection = null;

const messagesEl = document.querySelector('.messages');
// const peerIdEl = document.querySelector('#connect-to-peer');

// const localVideo = document.getElementById('localVideo');
// const remoteVideo = document.getElementById('remoteVideo');

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);
// let localStream;

function gotDevices(deviceInfos) {
  const mediaSource = {audioinput: [], videoinput: []};
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
      mediaSource['audioinput'].push({id: deviceInfo.deviceId, label: option.text});
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
      mediaSource['videoinput'].push({id: deviceInfo.deviceId, label: option.text});
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
  return mediaSource;
}

function syncMediaSourceInfos(mediaSource) {
  console.log('mediaSource:', mediaSource);
  dataConnection.send(JSON.stringify({type: 'mediaSource', data: mediaSource}));
}

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

// function changeAudioDestination() {
//   const audioDestination = audioOutputSelect.value;
//   attachSinkId(localVideo, audioDestination);
// }

function gotStream(stream) {
  console.log('Received local stream');
  // localVideo.srcObject = stream;
  // localStream = stream;
  if (mediaConnection) {
    console.log('replacing stream');
    mediaConnection.replaceStream(stream);
  }
  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function getMediaConstraints(videoSource, audioSource) {
  const constraints = {
    audio: {
      deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {
      deviceId: videoSource ? {exact: videoSource} : undefined,
      width: {min: 640, ideal: 1280, max: 1920},
      height: {min: 480, ideal: 720, max: 1080}}
  };
  return constraints;
}

function getMedia() {
  const constraints = getMediaConstraints(videoSelect.value, audioInputSelect.value);
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
}

audioInputSelect.onchange = getMedia;
videoSelect.onchange = getMedia;
// audioOutputSelect.onchange = changeAudioDestination;


const logMessage = (message) => {
  console.log('message:', message);
  const newMessage = document.createElement('div');
  newMessage.innerText = message;
  messagesEl.appendChild(newMessage);
};

// Register with the peer server
const peer = new Peer(myPeerId, {
  debug: 3,
  secure: true,
  host: 'broker-cn.emqx.io',
  port: 8084,
  path: '/mqtt',
  config: {
    iceServers: [
      {urls: 'stun:stun.ioiot.cc:3478'}
    ],
    sdpSemantics: 'unified-plan',
  }
});

peer.on('open', (id) => {
  logMessage('My peer ID is: ' + id);
  // myPeerId = id;

  dataConnectionStart(remoteId);
});

peer.on('push', (message) => {
  logMessage(`push message: ${message}`);
  const messageObj = JSON.parse(message);
  if (messageObj.type === 'callme') {
    logMessage(`call to ${messageObj.src}`);
    dataConnectionStart(messageObj.src);
  }
});

peer.on('error', (error) => {
  console.error(error);
});

// Handle incoming data connection
peer.on('connection', (conn) => {
  logMessage('incoming peer connection!');
  // conn.on('data', (data) => {
  //   logMessage(`received: ${data}`);
  // });
  // conn.on('open', () => {
  //   console.log('peer data connection open');
  //   conn.send('hello!');
  // });
});

peer.on('disconnected', () => {
  logMessage('Connection lost. Please reconnect');
  // Workaround for peer.reconnect deleting previous id
  mediaConnection = null;
  peer._lastServerId = peer.id;
  peer.reconnect();
});

function dataConnectionStart(peerId) {
  logMessage(`dataConnection to ${peerId}...`);
  dataConnection = peer.connect(peerId);
  dataConnection.on('data', (data) => {
    logMessage(`received: ${data}`);
    const message = JSON.parse(data);
    if (message) {
      switch (message.type) {
        case 'mediaSourceSelect':
          const mediaSource = message.data;
          const constraints = getMediaConstraints(mediaSource.videoSelect, mediaSource.audioInputSelect);
          navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
          break;
        default:
          break;
      }
    }
  });
  dataConnection.on('open', () => {
    logMessage('peer data connection open');
    mediaConnectionStart(peerId);
  });
}

async function mediaConnectionStart(peerId) {
  logMessage(`mediaConnection to ${peerId}...`);
  await navigator.mediaDevices.getUserMedia(getMediaConstraints(videoSelect.value, audioInputSelect.value))
      .then((stream) => {
        logMessage('Received local stream');
        mediaConnection = peer.call(peerId, stream, {constraints: {offerToReceiveAudio: false, offerToReceiveVideo: false}});
        // localVideo.srcObject = stream;
        // call.on('stream', renderVideo);
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(gotDevices)
      .then(syncMediaSourceInfos)
      .catch((err) => {
        logMessage('Failed to get local stream', err);
      });
}

// // Initiate outgoing connection
// const connectToPeerClick = () => {
//   const peerId = peerIdEl.value;
//   // connectToPeer(peerId);
// };

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(myPeerId);
    console.log('Content copied to clipboard');
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
};

// window.connectToPeerClick = connectToPeerClick;
window.copyContent = copyContent;
