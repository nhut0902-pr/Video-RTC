// Call History Page
const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

const loading = document.getElementById('loading');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');

// Format duration from seconds to readable format
function formatDuration(seconds) {
    if (!seconds) return 'N/A';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Format date to relative time
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} ngày trước`;
    } else if (hours > 0) {
        return `${hours} giờ trước`;
    } else if (minutes > 0) {
        return `${minutes} phút trước`;
    } else {
        return 'Vừa xong';
    }
}

// Load call history
async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/api/calls/history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load history');
        }

        const history = await response.json();

        loading.classList.add('hidden');

        if (history.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        historyList.classList.remove('hidden');

        history.forEach(call => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const status = call.left_at ? '✓ Đã kết thúc' : '🔴 Đang gọi';
            const time = formatDate(call.joined_at);
            const duration = formatDuration(call.duration);

            item.innerHTML = `
        <div class="history-info">
          <div class="room-id">Phòng: ${call.room_id}</div>
          <div class="history-meta">
            <span>📅 ${time}</span>
            <span>${status}</span>
          </div>
        </div>
        <div class="duration">${duration}</div>
      `;

            historyList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading history:', error);
        loading.textContent = 'Lỗi khi tải lịch sử';
    }
}

loadHistory();
