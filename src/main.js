import { io } from "socket.io-client";
import QRCode from 'qrcode';
import AudioNotifications from './audio.js';
import NetworkMonitor from './networkMonitor.js';
import CallRecorder from './recorder.js';
import VirtualBackground from './virtualBackground.js';

// Authentication check
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
  // Redirect to login if not authenticated
  window.location.href = '/login.html';
  throw new Error('Not authenticated');
}

const currentUser = JSON.parse(userStr);
const API_URL = window.location.origin;

// Socket.io connection - use backend URL in production
const socket = io(import.meta.env.VITE_BACKEND_URL || window.location.origin);
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const remotePlaceholder = document.getElementById("remote-placeholder");
const remoteVideoWrapper = document.querySelector(".remote-video-wrapper");
const connectionStatus = document.getElementById("connection-status");

const joinModal = document.getElementById("join-modal");
const roomInput = document.getElementById("room-input");
const btnJoin = document.getElementById("btn-join");
const btnCreate = document.getElementById("btn-create");
const roomInfo = document.getElementById("room-info");
const roomIdDisplay = document.getElementById("room-id-display");
const btnCopy = document.getElementById("btn-copy");

const btnMic = document.getElementById("btn-mic");
const btnCamera = document.getElementById("btn-camera");
const btnScreenShare = document.getElementById("btn-screen-share");
const btnPiP = document.getElementById("btn-pip");
const btnRecord = document.getElementById("btn-record");
const btnHangup = document.getElementById("btn-hangup");

const recordingIndicator = document.getElementById("recording-indicator");
const recordingTime = document.getElementById("recording-time");
const btnBlurBg = document.getElementById("btn-blur-bg");

let localStream;
let remoteStream;
let peerConnection;
let roomId;
let userId = currentUser.id; // Use database user ID
let isScreenSharing = false;
let originalVideoTrack = null;
let currentCallId = null; // Track current call for history
let networkMonitor = null; // Network quality monitor
let callRecorder = null; // Call recorder
let recordingTimer = null; // Recording timer interval
let virtualBg = null; // Virtual background
let originalStream = null; // Original stream before blur

// Initialize audio notifications
const audioNotifications = new AudioNotifications();

// Network indicator elements
const networkIndicator = document.getElementById('network-indicator');
const qualityText = document.getElementById('quality-text');

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// UI Event Listeners
btnJoin.addEventListener("click", joinRoom);
btnCreate.addEventListener("click", createRoom);
btnCopy.addEventListener("click", copyRoomId);
btnMic.addEventListener("click", toggleMic);
btnCamera.addEventListener("click", toggleCamera);
btnHangup.addEventListener("click", hangUp);

async function joinRoom() {
  roomId = roomInput.value.trim();
  if (!roomId) return;

  joinModal.classList.add("hidden");

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;

    socket.emit("join-room", roomId, userId);
    updateStatus("Đang chờ người khác...");
    showRoomInfo(roomId);
    audioNotifications.playCallStart(); // Play call start sound

    // Start call history tracking
    try {
      const response = await fetch(`${API_URL}/api/calls/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomId })
      });
      if (response.ok) {
        const call = await response.json();
        currentCallId = call.id;
      }
    } catch (error) {
      console.error('Error starting call history:', error);
    }

    // Load message history
    await loadMessageHistory(roomId);
  } catch (error) {
    console.error("Error accessing media devices:", error);
    alert("Không thể truy cập camera/microphone. Vui lòng cấp quyền.");
    joinModal.classList.remove("hidden");
  }
}

async function createRoom() {
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = roomId;
  await joinRoom();
}

function showRoomInfo(id) {
  roomIdDisplay.textContent = id;
  roomInfo.classList.remove("hidden");
}

function copyRoomId() {
  navigator.clipboard.writeText(roomId).then(() => {
    const originalIcon = btnCopy.innerHTML;
    btnCopy.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => {
      btnCopy.innerHTML = originalIcon;
    }, 2000);
  });
}

// Socket Events
socket.on("user-connected", async (newUserId) => {
  console.log("User connected:", newUserId);
  updateStatus("Đang kết nối...");
  audioNotifications.playJoin(); // Play join sound
  createPeerConnection();

  // Add local tracks to peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Create Offer
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", {
      target: roomId, // In this simple example, we broadcast to room. Ideally target specific socket ID.
      // Since we are using rooms, we can just emit to the room, but our server implementation
      // relays to "target". Let's adjust server or client.
      // Actually, for 2 peers in a room, broadcasting to room (excluding sender) is fine.
      // But my server implementation expects `target`.
      // Let's assume the server broadcasts to room if target is room ID?
      // Wait, my server.js again.
      // server.js: socket.to(roomId).emit('user-connected', userId);
      // server.js: socket.on('offer', (payload) => io.to(payload.target).emit('offer', payload));
      // If payload.target is a room ID, `io.to(roomId)` sends to everyone in room INCLUDING sender?
      // No, `io.to(room)` sends to everyone. `socket.to(room)` sends to everyone EXCEPT sender.
      // My server uses `io.to(payload.target)`.
      // If I set target = roomId, it sends to everyone.
      // The sender will receive their own offer. I should handle that or fix server.
      // Let's fix the client to ignore own messages or fix server.
      // Easier to fix server to use `socket.to(payload.target)` if target is room, or just use `socket.broadcast.to` logic.
      // BUT, I can't easily change server now without another tool call.
      // Let's assume I use `roomId` as target.
      // Client side: check if sender is self.
      // I'll add `sender: userId` to payload.
      type: "offer",
      sdp: offer.sdp,
      sender: userId,
      target: roomId
    });
  } catch (error) {
    console.error("Error creating offer:", error);
  }
});

socket.on("offer", async (payload) => {
  if (payload.sender === userId) return; // Ignore own messages

  console.log("Received offer");
  updateStatus("Đang kết nối...");
  createPeerConnection();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
      target: roomId,
      type: "answer",
      sdp: answer.sdp,
      sender: userId
    });
  } catch (error) {
    console.error("Error handling offer:", error);
  }
});

socket.on("answer", async (payload) => {
  if (payload.sender === userId) return;
  console.log("Received answer");
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
    updateStatus("Đã kết nối");
    remoteVideoWrapper.classList.add("active");
    connectionStatus.classList.add("connected");
  } catch (error) {
    console.error("Error handling answer:", error);
  }
});

socket.on("ice-candidate", async (payload) => {
  if (payload.sender === userId) return;
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
  } catch (error) {
    console.error("Error adding ICE candidate:", error);
  }
});

socket.on("user-disconnected", (userId) => {
  console.log("User disconnected:", userId);
  cleanupConnection();
  updateStatus("Người khác đã ngắt kết nối");
  audioNotifications.playLeave(); // Play leave sound
});

function createPeerConnection() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        target: roomId,
        candidate: event.candidate,
        sender: userId
      });
    }
  };

  peerConnection.ontrack = (event) => {
    console.log("Received remote track");
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
    remotePlaceholder.style.display = "none";
    remoteVideoWrapper.classList.add("active");
    connectionStatus.classList.add("connected");
    updateStatus("Đã kết nối");

    // Start network quality monitoring
    networkMonitor = new NetworkMonitor(peerConnection);
    networkIndicator.classList.remove('hidden');
    networkMonitor.startMonitoring((result) => {
      updateNetworkQuality(result.quality);
    });
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      updateStatus("Mất kết nối");
      remoteVideoWrapper.classList.remove("active");
      connectionStatus.classList.remove("connected");
    }
  }
}

function toggleMic() {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    btnMic.classList.toggle("active", !audioTrack.enabled);
    // Update icon if needed
  }
}

function toggleCamera() {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    btnCamera.classList.toggle("active", !videoTrack.enabled);
  }
}

function hangUp() {
  cleanupConnection();
  socket.disconnect();
  // Reload to reset state for simplicity
  window.location.reload();
}

function cleanupConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
  }
  remoteVideo.srcObject = null;
  remotePlaceholder.style.display = "flex";

  // Stop network monitoring
  if (networkMonitor) {
    networkMonitor.stopMonitoring();
    networkMonitor = null;
  }
  if (networkIndicator) {
    networkIndicator.classList.add('hidden');
  }

  // End call history tracking
  if (currentCallId) {
    fetch(`${API_URL}/api/calls/end/${currentCallId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch(error => console.error('Error ending call history:', error));
    currentCallId = null;
  }
  remoteVideoWrapper.classList.remove("active");
  connectionStatus.classList.remove("connected");
}

function updateStatus(status) {
  connectionStatus.textContent = status;
}


// ===== CHAT FEATURE =====

const chatSidebar = document.getElementById("chat-sidebar");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnChat = document.getElementById("btn-chat");
const btnSendChat = document.getElementById("btn-send-chat");
const btnCloseChat = document.getElementById("btn-close-chat");
const typingIndicator = document.getElementById("typing-indicator");
const typingUser = document.getElementById("typing-user");
const chatBadge = document.getElementById("chat-badge");

const btnShare = document.getElementById("btn-share");
const shareModal = document.getElementById("share-modal");
const shareLinkInput = document.getElementById("share-link-input");
const btnCopyLink = document.getElementById("btn-copy-link");
const btnCloseShare = document.getElementById("btn-close-share");
const qrCodeContainer = document.getElementById("qr-code");

const reactionsContainer = document.getElementById("reactions-container");
const emojiButtons = document.querySelectorAll(".emoji-btn");

let unreadMessages = 0;
let typingTimeout = null;

// Chat toggle
btnChat.addEventListener("click", () => {
  chatSidebar.classList.toggle("hidden");
  if (!chatSidebar.classList.contains("hidden")) {
    unreadMessages = 0;
    updateChatBadge();
    chatInput.focus();
  }
});

btnCloseChat.addEventListener("click", () => {
  chatSidebar.classList.add("hidden");
});

// Send chat message
function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !roomId) return;

  socket.emit("chat-message", {
    roomId,
    message,
    sender: userId,
    userId: currentUser.id, // Include user ID for database
    username: currentUser.displayName || currentUser.username,
  });

  addChatMessage(message, true, currentUser.displayName || currentUser.username);
  chatInput.value = "";
}

// Load message history from database
async function loadMessageHistory(roomId) {
  try {
    const response = await fetch(`${API_URL}/api/messages/${roomId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const messages = await response.json();
      messages.forEach(msg => {
        const isOwn = msg.user_id === currentUser.id;
        addChatMessage(msg.message, isOwn, msg.display_name || msg.username);
      });
    }
  } catch (error) {
    console.error('Error loading message history:', error);
  }
}

btnSendChat.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendChatMessage();
  }
});

// Typing indicator
chatInput.addEventListener("input", () => {
  if (!roomId) return;

  socket.emit('typing-start', {
    roomId,
    userId,
    username: currentUser.displayName || currentUser.username
  });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing-stop', { roomId, userId });
  }, 1000);
});

// Socket events for typing
socket.on('user-typing', ({ userId: typingUserId, username }) => {
  if (typingUserId !== userId && typingIndicator && typingUser) {
    typingUser.textContent = `${username} đang gõ...`;
    typingIndicator.classList.remove('hidden');
  }
});

socket.on('user-stopped-typing', ({ userId: typingUserId }) => {
  if (typingUserId !== userId && typingIndicator) {
    typingIndicator.classList.add('hidden');
  }
});

// Receive chat message
socket.on("chat-message", (data) => {
  if (data.sender !== userId) {
    addChatMessage(data.message, false, data.username || 'Anonymous');
    audioNotifications.playMessage(); // Play message sound
    if (chatSidebar.classList.contains("hidden")) {
      unreadMessages++;
      updateChatBadge();
    }
  }
});

function addChatMessage(message, isOwn, username = '') {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${isOwn ? "own" : "other"}`;

  if (!isOwn && username) {
    const senderSpan = document.createElement("div");
    senderSpan.className = "chat-message-sender";
    senderSpan.textContent = username;
    messageDiv.appendChild(senderSpan);
  }

  const messageText = document.createElement("div");
  messageText.textContent = message;
  messageDiv.appendChild(messageText);

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateChatBadge() {
  if (unreadMessages > 0) {
    chatBadge.textContent = unreadMessages > 9 ? "9+" : unreadMessages;
    chatBadge.classList.remove("hidden");
  } else {
    chatBadge.classList.add("hidden");
  }
}

// ===== EMOJI REACTIONS =====
emojiButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const emoji = btn.dataset.emoji;
    socket.emit("emoji-reaction", {
      roomId,
      emoji,
      sender: userId,
    });
    showEmojiReaction(emoji);
  });
});

socket.on("emoji-reaction", (data) => {
  if (data.sender !== userId) {
    showEmojiReaction(data.emoji);
    audioNotifications.playReaction(); // Play reaction sound
  }
});

function showEmojiReaction(emoji) {
  const emojiEl = document.createElement("div");
  emojiEl.className = "reaction-emoji";
  emojiEl.textContent = emoji;
  emojiEl.style.left = Math.random() * 80 + 10 + "%";
  emojiEl.style.bottom = "0";
  reactionsContainer.appendChild(emojiEl);

  setTimeout(() => {
    emojiEl.remove();
  }, 3000);
}

// ===== SHARE FEATURE =====
btnShare.addEventListener("click", async () => {
  if (!roomId) return;

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  shareLinkInput.value = shareUrl;

  // Generate QR Code
  qrCodeContainer.innerHTML = "";
  try {
    await QRCode.toCanvas(shareUrl, {
      width: 200,
      margin: 2,
    }).then((canvas) => {
      qrCodeContainer.appendChild(canvas);
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  shareModal.classList.remove("hidden");
});

btnCopyLink.addEventListener("click", () => {
  shareLinkInput.select();
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    btnCopyLink.textContent = "Đã sao chép!";
    setTimeout(() => {
      btnCopyLink.textContent = "Sao chép";
    }, 2000);
  });
});

btnCloseShare.addEventListener("click", () => {
  shareModal.classList.add("hidden");
});

// Auto-join from URL parameter
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get("room");
  if (roomFromUrl) {
    roomInput.value = roomFromUrl;
  }
});

// Display user info and logout
const userInfo = document.getElementById("user-info");
const userDisplayName = document.getElementById("user-display-name");
const btnLogout = document.getElementById("btn-logout");
const btnAudioToggle = document.getElementById("btn-audio-toggle");

if (userDisplayName) {
  userDisplayName.textContent = currentUser.displayName || currentUser.username;
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    audioNotifications.playCallEnd(); // Play call end sound
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  });
}

// Audio notifications toggle
if (btnAudioToggle) {
  // Set initial state
  if (!audioNotifications.isEnabled()) {
    btnAudioToggle.classList.add('muted');
  }

  btnAudioToggle.addEventListener("click", () => {
    const enabled = audioNotifications.toggle();
    if (enabled) {
      btnAudioToggle.classList.remove('muted');
      btnAudioToggle.title = 'Bật/tắt âm thanh thông báo';
      audioNotifications.playMessage(); // Play test sound
    } else {
      btnAudioToggle.classList.add('muted');
      btnAudioToggle.title = 'Âm thanh đã tắt - Nhấn để bật';
    }
  });
}

// Screen Sharing
async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    // Save original video track
    originalVideoTrack = localStream.getVideoTracks()[0];

    // Replace track in peer connection
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }

    // Replace in local stream
    localStream.removeTrack(originalVideoTrack);
    localStream.addTrack(screenTrack);

    isScreenSharing = true;
    btnScreenShare.classList.add('active');

    // Handle screen share stop (user clicks browser's stop button)
    screenTrack.onended = () => {
      stopScreenShare();
    };

    socket.emit('screen-share-started', { roomId });
  } catch (error) {
    console.error('Screen share error:', error);
    if (error.name !== 'NotAllowedError') {
      alert('Không thể chia sẻ màn hình. Vui lòng thử lại.');
    }
  }
}

async function stopScreenShare() {
  if (!isScreenSharing || !originalVideoTrack) return;

  try {
    // Replace back to camera
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(originalVideoTrack);
    }

    // Replace in local stream
    const currentVideoTrack = localStream.getVideoTracks()[0];
    localStream.removeTrack(currentVideoTrack);
    currentVideoTrack.stop();
    localStream.addTrack(originalVideoTrack);

    isScreenSharing = false;
    btnScreenShare.classList.remove('active');

    socket.emit('screen-share-stopped', { roomId });
  } catch (error) {
    console.error('Stop screen share error:', error);
  }
}

// Screen share button event
if (btnScreenShare) {
  btnScreenShare.addEventListener('click', () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  });
}

// Socket events for screen sharing
socket.on('screen-share-started', (data) => {
  console.log('Remote user started screen sharing');
  // Could show indicator that remote is sharing
});

socket.on('screen-share-stopped', (data) => {
  console.log('Remote user stopped screen sharing');
});

// Picture-in-Picture
async function togglePictureInPicture() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      if (btnPiP) btnPiP.classList.remove('active');
    } else {
      // Check if remote video has content
      if (remoteVideo && remoteVideo.readyState >= 2) {
        await remoteVideo.requestPictureInPicture();
        if (btnPiP) btnPiP.classList.add('active');
      } else {
        alert('Chưa có video từ người khác. Vui lòng đợi kết nối.');
      }
    }
  } catch (error) {
    console.error('PiP error:', error);
    if (error.name === 'NotAllowedError') {
      alert('Trình duyệt không cho phép PiP');
    } else {
      alert('Lỗi PiP: ' + error.message);
    }
  }
}

// PiP button event
if (btnPiP && remoteVideo) {
  btnPiP.addEventListener('click', togglePictureInPicture);

  // Update button state when PiP changes
  remoteVideo.addEventListener('enterpictureinpicture', () => {
    if (btnPiP) btnPiP.classList.add('active');
  });

  remoteVideo.addEventListener('leavepictureinpicture', () => {
    if (btnPiP) btnPiP.classList.remove('active');
  });
}

// Update network quality indicator
function updateNetworkQuality(quality) {
  if (!networkIndicator || !qualityText) return;

  // Remove all quality classes
  networkIndicator.classList.remove('good', 'fair', 'poor');

  // Add current quality class
  networkIndicator.classList.add(quality);

  // Update text
  const qualityTexts = {
    good: 'Tốt',
    fair: 'Trung bình',
    poor: 'Kém'
  };
  qualityText.textContent = qualityTexts[quality] || 'Tốt';
}

// Recording functionality
async function toggleRecording() {
  if (!callRecorder) {
    callRecorder = new CallRecorder();
  }

  try {
    if (callRecorder.isRecording) {
      // Stop recording
      const { blob, duration } = await callRecorder.stop();
      if (btnRecord) btnRecord.classList.remove('recording');
      if (recordingIndicator) recordingIndicator.classList.add('hidden');

      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }

      // Download the recording
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `call-recording-${timestamp}.webm`;
      callRecorder.download(blob, filename);

      alert(`Đã lưu recording (${duration}s): ${filename}`);
    } else {
      // Start recording - combine local and remote streams
      if (!localStream) {
        alert('Chưa có stream để ghi');
        return;
      }

      // Create combined stream
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');

      const combinedStream = canvas.captureStream(30);

      // Add audio from local stream
      localStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      // Draw videos to canvas
      const drawFrame = () => {
        if (!callRecorder.isRecording) return;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw remote video (main)
        if (remoteVideo && remoteVideo.videoWidth > 0) {
          ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
        }

        // Draw local video (PiP style)
        if (localVideo && localVideo.videoWidth > 0) {
          const pipWidth = 320;
          const pipHeight = 180;
          const margin = 20;
          ctx.drawImage(
            localVideo,
            canvas.width - pipWidth - margin,
            canvas.height - pipHeight - margin,
            pipWidth,
            pipHeight
          );
        }

        requestAnimationFrame(drawFrame);
      };

      await callRecorder.start(combinedStream);
      if (btnRecord) btnRecord.classList.add('recording');
      if (recordingIndicator) recordingIndicator.classList.remove('hidden');

      // Start timer
      recordingTimer = setInterval(() => {
        const seconds = callRecorder.getRecordingTime();
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (recordingTime) {
          recordingTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }, 1000);

      drawFrame();
    }
  } catch (error) {
    console.error('Recording error:', error);
    alert('Lỗi khi ghi hình: ' + error.message);
  }
}

// Record button event
if (btnRecord) {
  btnRecord.addEventListener('click', toggleRecording);
}

// Virtual Background - Blur
async function toggleBlurBackground() {
  if (!localStream) {
    alert('Chưa có video stream');
    return;
  }

  try {
    if (!virtualBg) {
      virtualBg = new VirtualBackground();
    }

    if (virtualBg.isActive) {
      // Stop blur and restore original
      virtualBg.stop();
      btnBlurBg.classList.remove('active');

      if (originalStream) {
        localVideo.srcObject = originalStream;

        // Update peer connection if connected
        if (peerConnection) {
          const videoTrack = originalStream.getVideoTracks()[0];
          const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }
    } else {
      // Apply blur
      if (!originalStream) {
        originalStream = localStream;
      }

      const blurredStream = await virtualBg.applyBlur(localStream);
      localVideo.srcObject = blurredStream;
      btnBlurBg.classList.add('active');

      // Update peer connection if connected
      if (peerConnection) {
        const videoTrack = blurredStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
    }
  } catch (error) {
    console.error('Blur background error:', error);
    alert('Lỗi khi áp dụng blur: ' + error.message);
  }
}

// Blur button event
if (btnBlurBg) {
  btnBlurBg.addEventListener('click', toggleBlurBackground);
}
