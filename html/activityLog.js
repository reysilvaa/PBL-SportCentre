// DOM Elements
const activityResults = document.getElementById('activity-results');

// Activity Log Form Handlers
document.getElementById('create-activity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!activitySocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const userId = parseInt(document.getElementById('activity-user-id').value);
    const action = document.getElementById('activity-action').value;
    
    activitySocket.emit('createActivityLog', { userId, action });
    logEvent(`Emitted createActivityLog: ${action} for user #${userId}`);
});

document.getElementById('get-logs-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!activitySocket) {
        alert('Please connect to sockets first');
        return;
    }
    
    const userIdInput = document.getElementById('logs-user-id').value;
    const filters = userIdInput ? { userId: parseInt(userIdInput) } : {};
    
    activitySocket.emit('getLogs', filters);
    logEvent(`Emitted getLogs ${userIdInput ? `for user #${userIdInput}` : 'for all users'}`);
});

// Clear button
document.getElementById('clear-activity-results').addEventListener('click', () => {
    activityResults.innerHTML = '<p class="text-gray-500 italic">No results yet. Use the forms above to see activity logs.</p>';
});

// Setup Activity Socket Listeners
function setupActivitySocketListeners() {
    // Activity Socket Listeners
    activitySocket.on('connect', () => {
        logEvent('Activity namespace connected');
    });
    
    activitySocket.on('disconnect', () => {
        logEvent('Activity namespace disconnected');
    });
    
    activitySocket.on('created', (data) => {
        logEvent('Activity log created');
        displayActivityResult('Activity Log Created', data);
    });
    
    activitySocket.on('logsList', (data) => {
        logEvent(`Received ${data.length} activity logs`);
        displayActivityResult('Activity Logs Retrieved', data);
    });
    
    activitySocket.on('deleteConfirmed', (data) => {
        logEvent(`Activity log #${data.id} deleted`);
        displayActivityResult('Activity Log Deleted', data);
    });
    
    activitySocket.on('newLog', (data) => {
        logEvent(`New activity log broadcast received`);
        displayActivityResult('New Activity Log (Broadcast)', data);
    });
    
    activitySocket.on('logDeleted', (logId) => {
        logEvent(`Activity log deletion broadcast received: #${logId}`);
    });
    
    activitySocket.on('error', (error) => {
        logEvent(`Activity error: ${error.error}`);
        displayActivityResult('Error', error);
    });
}

// Helper function to display activity results
function displayActivityResult(title, data) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'mb-4 p-3 border rounded bg-gray-50';
    
    const titleElement = document.createElement('h4');
    titleElement.className = 'font-semibold mb-2';
    titleElement.textContent = title;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'text-xs text-gray-500 mb-2';
    timestamp.textContent = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const content = document.createElement('pre');
    content.className = 'bg-gray-100 p-2 rounded text-sm overflow-auto';
    content.textContent = JSON.stringify(data, null, 2);
    
    resultDiv.appendChild(titleElement);
    resultDiv.appendChild(timestamp);
    resultDiv.appendChild(content);
    
    // Clear "no results" message if it exists
    if (activityResults.querySelector('.text-gray-500')) {
        activityResults.innerHTML = '';
    }
    
    // Insert at the top
    activityResults.insertBefore(resultDiv, activityResults.firstChild);
}

// Export function to be used by main.js
window.setupActivitySocketListeners = setupActivitySocketListeners;