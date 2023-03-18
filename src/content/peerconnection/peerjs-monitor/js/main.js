// client-side js, loaded by index.html
// run by the browser each time the page is loaded

navigator.mediaDevices.getUserMedia({audio: true, video: false});

const Peer = window.Peer;
let dataConnection;

const messagesEl = document.querySelector('.messages');
const peerIdEl = document.querySelector('#connect-to-peer');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

function mediaSourceSelectRender(mediaSource) {
  console.log('mediaSourceSelectProsses', mediaSource);
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });

  const videoinput = mediaSource['videoinput'];
  if (videoinput) {
    videoinput.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.text = item.label;
      videoSelect.appendChild(option);
    });
  }

  const audioinput = mediaSource['audioinput'];
  if (audioinput) {
    audioinput.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.text = item.label;
      audioInputSelect.appendChild(option);
    });
  }

  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
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

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  attachSinkId(localVideo, audioDestination);
}

function mediaSourceChange() {
  console.log('mediaSourceChange');
  console.log('audioInputSelect:', audioInputSelect.value);
  console.log('videoSelect:', videoSelect.value);
  dataConnection.send(JSON.stringify({
    type: 'mediaSourceSelect',
    data: {'audioInputSelect': audioInputSelect.value, 'videoSelect': videoSelect.value}
  }));
}

audioInputSelect.onchange = mediaSourceChange;
videoSelect.onchange = mediaSourceChange;
audioOutputSelect.onchange = changeAudioDestination;

let myPeerId = null;
let remoteId = null;

const logMessage = (message) => {
  console.log('message:', message);
  const newMessage = document.createElement('div');
  newMessage.innerText = message;
  messagesEl.appendChild(newMessage);
};

const renderVideo = (stream) => {
  console.log('render video');
  remoteVideo.srcObject = stream;
};

// Register with the peer server
const peer = new Peer({
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

remoteId = peer.generateUUID();

peer.on('open', (id) => {
  logMessage('My peer ID is: ' + id);
  myPeerId = id;
});

peer.on('error', (error) => {
  console.error(error);
});

// Handle incoming data connection
peer.on('connection', (conn) => {
  logMessage('incoming peer connection!');
  dataConnection = conn;

  conn.on('data', (data) => {
    logMessage(`received: ${data}`);
    const mediaSource = JSON.parse(data);
    if (mediaSource && mediaSource.type === 'mediaSource') {
      mediaSourceSelectRender(mediaSource.data);
    }
  });

  conn.on('open', () => {
    logMessage('connection opened!');
    // conn.send('hello!');
  });
});

// Handle incoming voice/video connection
peer.on('call', (call) => {
  call.answer(null); // Answer the call with an A/V stream.
  call.on('stream', renderVideo);
});

peer.on('disconnected', () => {
  logMessage('Connection lost. Please reconnect');
  // Workaround for peer.reconnect deleting previous id
  peer._lastServerId = peer.id;
  peer.reconnect();
});

// Initiate outgoing connection
const connectToPeer = () => {
  const peerId = peerIdEl.value;
  logMessage(`connecting to ${peerId}`);
};

const getCameraURL = () => {
  const baseurl = window.location.href + 'camera.html';
  return baseurl + '?peerId=' + remoteId + '&remoteId=' + myPeerId;
};

const copyContent = async () => {
  await navigator.clipboard.writeText(getCameraURL());
};

const openCamera = async () => {
  window.open(getCameraURL(), '_blank');
};

window.connectToPeer = connectToPeer;
window.copyContent = copyContent;
window.openCamera = openCamera;
