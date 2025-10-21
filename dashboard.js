// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = '11-KJLqpIwuUkf3bwdJlV6zkSmTUfV0Z_yVGfbdIPbgg'; // Replace with your Google Sheet ID
const API_KEY = 'AIzaSyA_OWlGTLZBnwv6JKKZPj4FxPjvBYaOaZQ'; // Replace with your API Key
const SHEET_NAMES = ['IETS', 'IWTS', 'NLTS', 'NWNTTS', 'OITF', 'STTS', 'WKTS']; // Replace with actual sheet names

class Dashboard {
    constructor() {
        this.allData = [];
        this.currentStation = 'all';
        this.init();
    }

    async init() {
        await this.loadData();
        this.populateStationSelector();
        this.createDashboard();
        this.setupEventListeners();
    }

    async loadData() {
        const loadingElement = document.getElementById('statsGrid');
        loadingElement.innerHTML = '<div class="loading">🔄 Loading data from Google Sheets...</div>';

        try {
            this.allData = [];
            let loadedSheets = 0;
            
            for (const sheetName of SHEET_NAMES) {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${API_KEY}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.warn(`Could not load sheet: ${sheetName}`);
                    continue;
                }
                
                const data = await response.json();
                
                if (data.values && data.values.length > 1) {
                    const headers = data.values[0];
                    const rows = data.values.slice(1);
                    
                    const sheetData = rows.map((row, index) => {
                        const obj = {};
                        headers.forEach((header, colIndex) => {
                            obj[header] = row[colIndex] || '';
                        });
                        obj['station'] = sheetName;
                        obj['rowId'] = `${sheetName}_${index}`;
                        return obj;
                    });
                    
                    this.allData = this.allData.concat(sheetData);
                    loadedSheets++;
                }
            }
            
            if (loadedSheets === 0) {
                throw new Error('No data loaded from any sheet. Please check your Sheet ID and API Key.');
            }
            
            this.processData();
            
        } catch (error) {
            console.error('Error loading data:', error);
            loadingElement.innerHTML = `
                <div class="error">
                    ❌ Error loading data: ${error.message}<br>
                    Please check:<br>
                    1. Google Sheet ID is correct<br>
                    2. API Key is valid<br>
                    3. Sheet is shared as "Anyone with link can view"<br>
                    4. Sheet names match exactly
                </div>
            `;
        }
    }

    processData() {
        // Process each data item with English headers
        this.allData.forEach(item => {
            // Convert date (assuming format DD/MM/YYYY or MM/DD/YYYY)
            if (item['Date']) {
                const dateParts = item['Date'].split('/');
                if (dateParts.length === 3) {
                    // Try both DD/MM/YYYY and MM/DD/YYYY
                    const day = dateParts[0];
                    const month = dateParts[1];
                    const year = dateParts[2];
                    
                    // Use the format that creates a valid date
                    item.date = new Date(`${year}-${month}-${day}`);
                    if (isNaN(item.date)) {
                        item.date = new Date(`${year}-${day}-${month}`);
                    }
                }
            }
            
            // Convert weight to number
            item.weight = parseFloat(item['Weight']) || 0;
            
            // Clean other fields
            item.status = item['Status']?.trim() || 'Unknown';
            item.task = item['Vehicle Task']?.trim() || 'Unknown';
            item.time = item['Time']?.trim() || 'Unknown';
            item.source = item['Source']?.trim() || 'Unknown';
        });

        // Filter out invalid dates
        this.allData = this.allData.filter(item => item.date && !isNaN(item.date.getTime()));
    }

    populateStationSelector() {
        const select = document.getElementById('stationSelect');
        
        // Add station options
        SHEET_NAMES.forEach(station => {
            const option = document.createElement('option');
            option.value = station;
            option.textContent = `🏭 ${station}`;
            select.appendChild(option);
        });
    }

    setupEventListeners() {
        document.getElementById('stationSelect').addEventListener('change', (e) => {
            this.currentStation = e.target.value;
            this.createDashboard();
        });
    }

    getFilteredData() {
        if (this.currentStation === 'all') {
            return this.allData;
        }
        return this.allData.filter(item => item.station === this.currentStation);
    }

    createDashboard() {
        const filteredData = this.getFilteredData();
        
        if (filteredData.length === 0) {
            this.showNoData();
            return;
        }
        
        this.updateStats(filteredData);
        this.createWeightChart(filteredData);
        this.createStatusChart(filteredData);
        this.createTaskChart(filteredData);
        this.createStationChart(filteredData);
        this.createDataTable(filteredData);
    }

    showNoData() {
        document.getElementById('statsGrid').innerHTML = '<div class="error">No data available for the selected station</div>';
        document.getElementById('dataTable').innerHTML = '<div class="error">No data available for the selected station</div>';
    }

    updateStats(data) {
        const statsGrid = document.getElementById('statsGrid');
        
        const totalWeight = data.reduce((sum, item) => sum + item.weight, 0);
        const totalEntries = data.length;
        const completedTasks = data.filter(item => item.status === 'Completed' || item.status === '完成').length;
        const avgWeight = totalEntries > 0 ? totalWeight / totalEntries : 0;
        
        // Get unique dates for daily average
        const uniqueDates = [...new Set(data.map(item => item.date.toDateString()))];
        const avgDailyWeight = uniqueDates.length > 0 ? totalWeight / uniqueDates.length : 0;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Total Weight</h3>
                <p>${totalWeight.toLocaleString('en-US', {maximumFractionDigits: 2})} tons</p>
            </div>
            <div class="stat-card">
                <h3>Total Transactions</h3>
                <p>${totalEntries.toLocaleString()}</p>
            </div>
            <div class="stat-card">
                <h3>Completed Tasks</h3>
                <p style="color: #27ae60;">${completedTasks.toLocaleString()}</p>
            </div>
            <div class="stat-card">
                <h3>Avg Daily Weight</h3>
                <p>${avgDailyWeight.toLocaleString('en-US', {maximumFractionDigits: 2})} tons</p>
            </div>
        `;
    }

    createWeightChart(data) {
        const ctx = document.getElementById('weightChart').getContext('2d');
        
        // Group by date
        const dailyData = {};
        data.forEach(item => {
            if (item.date) {
                const dateStr = item.date.toLocaleDateString();
                if (!dailyData[dateStr]) {
                    dailyData[dateStr] = 0;
                }
                dailyData[dateStr] += item.weight;
            }
        });
        
        const dates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
        const weights = dates.map(date => dailyData[date]);
        
        // Destroy existing chart if it exists
        if (window.weightChart) {
            window.weightChart.destroy();
        }
        
        window.weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily Weight (tons)',
                    data: weights,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Weight (tons)'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                }
            }
        });
    }

    createStatusChart(data) {
        const ctx = document.getElementById('statusChart').getContext('2d');
        
        const statusCount = {};
        data.forEach(item => {
            const status = item.status;
            statusCount[status] = (statusCount[status] || 0) + 1;
        });
        
        if (window.statusChart) {
            window.statusChart.destroy();
        }
        
        const backgroundColors = [
            '#27ae60', '#3498db', '#e74c3c', '#f39c12', '#9b59b6', 
            '#1abc9c', '#d35400', '#c0392b', '#8e44ad', '#f1c40f'
        ];
        
        window.statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCount),
                datasets: [{
                    data: Object.values(statusCount),
                    backgroundColor: backgroundColors.slice(0, Object.keys(statusCount).length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                },
                cutout: '60%'
            }
        });
    }

    createTaskChart(data) {
        const ctx = document.getElementById('taskChart').getContext('2d');
        
        const taskWeights = {};
        data.forEach(item => {
            taskWeights[item.task] = (taskWeights[item.task] || 0) + item.weight;
        });
        
        // Get top 10 tasks by weight
        const topTasks = Object.entries(taskWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        if (window.taskChart) {
            window.taskChart.destroy();
        }
        
        window.taskChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topTasks.map(task => task[0]),
                datasets: [{
                    label: 'Total Weight (tons)',
                    data: topTasks.map(task => task[1]),
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Weight (tons)'
                        }
                    }
                }
            }
        });
    }

    createStationChart(data) {
        const ctx = document.getElementById('stationChart').getContext('2d');
        
        const stationWeights = {};
        data.forEach(item => {
            stationWeights[item.station] = (stationWeights[item.station] || 0) + item.weight;
        });
        
        if (window.stationChart) {
            window.stationChart.destroy();
        }
        
        window.stationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(stationWeights),
                datasets: [{
                    label: 'Total Weight by Station (tons)',
                    data: Object.values(stationWeights),
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c', 
                        '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
                    ],
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Weight (tons)'
                        }
                    }
                }
            }
        });
    }

    createDataTable(data) {
        const tableContainer = document.getElementById('dataTable');
        const recentData = data
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 15); // Last 15 entries
        
        if (recentData.length === 0) {
            tableContainer.innerHTML = '<div class="error">No data available</div>';
            return;
        }
        
        tableContainer.innerHTML = `
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Station</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Vehicle Task</th>
                            <th>Time</th>
                            <th>Weight (tons)</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentData.map(item => `
                            <tr>
                                <td><strong>${item.station}</strong></td>
                                <td>${item['Date'] || 'N/A'}</td>
                                <td>
                                    <span style="
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 0.8rem;
                                        background-color: ${item.status === 'Completed' || item.status === '完成' ? '#d4edda' : '#fff3cd'};
                                        color: ${item.status === 'Completed' || item.status === '完成' ? '#155724' : '#856404'};
                                    ">
                                        ${item.status}
                                    </span>
                                </td>
                                <td>${item.task}</td>
                                <td>${item.time}</td>
                                <td><strong>${item.weight.toFixed(2)}</strong></td>
                                <td>${item.source}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; text-align: center; color: #6c757d; font-size: 0.9rem;">
                Showing ${recentData.length} most recent transactions
            </div>
        `;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});

// Auto-refresh every 5 minutes
setInterval(() => {
    const dashboard = new Dashboard();
}, 300000);