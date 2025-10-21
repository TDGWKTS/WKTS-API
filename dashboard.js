// BigQuery Configuration
const PROJECT_ID = 'ordinal-shield-475803-m5';
const DATASET = 'transfer_stations';

class BigQueryDashboard {
    constructor() {
        this.allData = [];
        this.currentStation = 'all';
        this.stationStats = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.populateStationSelector();
        this.createDashboard();
        this.setupEventListeners();
    }

    async queryBigQuery(sqlQuery) {
        // 對於免費方案，我們使用模擬數據
        console.log('Query:', sqlQuery);
        
        // 如果是統計查詢
        if (sqlQuery.includes('GROUP BY station')) {
            return this.generateMockStats();
        }
        
        // 如果是詳細數據查詢
        return this.generateMockDetailedData();
    }

    generateMockStats() {
        // 生成模擬的統計數據
        const stations = ['Kwai Chung', 'Tseung Kwan O', 'Tuen Mun', 'Yuen Long', 'North District', 'Shatin', 'Outlying Islands'];
        
        return stations.map(station => {
            const totalRecords = Math.floor(Math.random() * 200000) + 50000; // 50k-250k
            const totalWeight = totalRecords * (Math.random() * 2 + 6); // 6-8 tons average
            const completedTasks = Math.floor(totalRecords * (Math.random() * 0.3 + 0.7)); // 70-100% completion
            
            return {
                station: station,
                total_records: totalRecords,
                total_weight: Math.round(totalWeight),
                avg_weight: Math.round((totalWeight / totalRecords) * 100) / 100,
                completed_tasks: completedTasks,
                latest_date: '2024-01-20'
            };
        });
    }

    generateMockDetailedData() {
        // 生成模擬的詳細數據
        const stations = ['Kwai Chung', 'Tseung Kwan O', 'Tuen Mun', 'Yuen Long', 'North District', 'Shatin', 'Outlying Islands'];
        const statuses = ['Completed', 'In Progress', 'Pending'];
        const tasks = [
            'C31 Food and Environmental Hygiene Department',
            'A45 Construction Waste Collection', 
            'B22 Municipal Solid Waste',
            'D15 Recycling Materials',
            'E08 Special Waste',
            'F12 Commercial Waste',
            'G07 Industrial Waste'
        ];
        
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 1000; i++) {
            const randomDays = Math.floor(Math.random() * 30); // 最近30天
            const date = new Date(today);
            date.setDate(date.getDate() - randomDays);
            
            data.push({
                date: date.toISOString().split('T')[0],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                vehicle_task: tasks[Math.floor(Math.random() * tasks.length)],
                time: `${String(Math.floor(Math.random() * 12) + 7).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
                weight: Math.round((Math.random() * 5 + 5) * 100) / 100, // 5-10 tons
                source: String(Math.floor(Math.random() * 30) + 1),
                station: stations[Math.floor(Math.random() * stations.length)]
            });
        }
        
        return data.sort((a, b) => new Date(b.date) - new Date(a.date)); // 按日期降序排列
    }

    async loadData() {
        const loadingElement = document.getElementById('statsGrid');
        loadingElement.innerHTML = '<div class="loading">🔄 Loading demo data...</div>';

        try {
            // 使用模擬數據
            this.stationStats = this.generateMockStats();
            this.allData = this.generateMockDetailedData();
            this.processData();
            
            loadingElement.innerHTML = '';
            
        } catch (error) {
            console.error('Error loading data:', error);
            loadingElement.innerHTML = '<div class="error">Error loading data</div>';
        }
    }

    processData() {
        this.allData.forEach(item => {
            if (item.date) {
                item.date = new Date(item.date);
            }
            item.weight = parseFloat(item.weight) || 0;
        });
    }

    populateStationSelector() {
        const select = document.getElementById('stationSelect');
        select.innerHTML = '<option value="all">📊 All Stations</option>';
        
        this.stationStats.forEach(stat => {
            const option = document.createElement('option');
            option.value = stat.station;
            option.textContent = `🏭 ${stat.station} (${stat.total_records.toLocaleString()} records)`;
            select.appendChild(option);
        });
    }

    updateStats(data) {
        const statsGrid = document.getElementById('statsGrid');
        
        const totalWeight = data.reduce((sum, item) => sum + item.weight, 0);
        const totalEntries = data.length;
        const completedTasks = data.filter(item => item.status === 'Completed').length;
        const completionRate = totalEntries > 0 ? (completedTasks / totalEntries * 100) : 0;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Total Weight</h3>
                <p>${totalWeight.toLocaleString('en-US', {maximumFractionDigits: 0})} tons</p>
            </div>
            <div class="stat-card">
                <h3>Total Entries</h3>
                <p>${totalEntries.toLocaleString()}</p>
            </div>
            <div class="stat-card">
                <h3>Completed Tasks</h3>
                <p style="color: #27ae60;">${completedTasks.toLocaleString()}</p>
            </div>
            <div class="stat-card">
                <h3>Completion Rate</h3>
                <p>${completionRate.toFixed(1)}%</p>
            </div>
        `;
    }

    createWeightChart(data) {
        const ctx = document.getElementById('weightChart');
        if (!ctx) return;
        
        // 按日期分組計算每日總重量
        const dailyData = {};
        data.forEach(item => {
            const dateStr = item.date.toISOString().split('T')[0];
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = 0;
            }
            dailyData[dateStr] += item.weight;
        });
        
        const dates = Object.keys(dailyData).sort();
        const weights = dates.map(date => dailyData[date]);
        
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
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    createStatusChart(data) {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;
        
        const statusCount = {};
        data.forEach(item => {
            statusCount[item.status] = (statusCount[item.status] || 0) + 1;
        });
        
        if (window.statusChart) {
            window.statusChart.destroy();
        }
        
        window.statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCount),
                datasets: [{
                    data: Object.values(statusCount),
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createDataTable(data) {
        const tableContainer = document.getElementById('dataTable');
        const recentData = data.slice(0, 15);
        
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
                                <td>${item.date.toLocaleDateString('en-HK')}</td>
                                <td>
                                    <span style="
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 0.8rem;
                                        background-color: ${item.status === 'Completed' ? '#d4edda' : item.status === 'In Progress' ? '#fff3cd' : '#f8d7da'};
                                        color: ${item.status === 'Completed' ? '#155724' : item.status === 'In Progress' ? '#856404' : '#721c24'};
                                    ">
                                        ${item.status}
                                    </span>
                                </td>
                                <td>${item.vehicle_task}</td>
                                <td>${item.time}</td>
                                <td><strong>${item.weight.toFixed(2)}</strong></td>
                                <td>${item.source}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; text-align: center; color: #6c757d; font-size: 0.9rem;">
                Showing ${recentData.length} recent transactions (Demo Data)
            </div>
        `;
    }

    setupEventListeners() {
        document.getElementById('stationSelect').addEventListener('change', (e) => {
            this.currentStation = e.target.value;
            this.createDashboard();
        });
    }

    createDashboard() {
        let filteredData = this.allData;
        
        if (this.currentStation !== 'all') {
            filteredData = this.allData.filter(item => item.station === this.currentStation);
        }
        
        this.updateStats(filteredData);
        this.createWeightChart(filteredData);
        this.createStatusChart(filteredData);
        this.createDataTable(filteredData);
    }
}

// 初始化儀表板
document.addEventListener('DOMContentLoaded', () => {
    new BigQueryDashboard();
});
