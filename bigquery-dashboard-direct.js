// BigQuery 直接訪問配置
const PROJECT_ID = 'ordinal-shield-475803-m5';
const API_KEY = 'AIzaSyCFUOcBL0AxZ0t-9VQoIfw2VicLcJt7BRQ';

class BigQueryDirectDashboard {
    constructor() {
        this.allData = [];
        this.stationStats = [];
        this.currentStation = 'all';
        this.init();
    }

    async init() {
        await this.testConnection();
        await this.loadData();
        this.populateStationSelector();
        this.createDashboard();
        this.setupEventListeners();
    }

    async testConnection() {
        console.log('Testing BigQuery connection...');
        const testQuery = `SELECT "Connection successful" as status, CURRENT_TIMESTAMP() as time`;
        
        try {
            const result = await this.queryBigQuery(testQuery);
            console.log('✅ BigQuery connection test passed:', result);
        } catch (error) {
            console.error('❌ BigQuery connection test failed:', error);
        }
    }

    async queryBigQuery(sqlQuery) {
        const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries?key=${API_KEY}`;
        
        console.log('Executing BigQuery query:', sqlQuery);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: sqlQuery,
                    useLegacySql: false,
                    timeoutMs: 30000,
                    useQueryCache: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`BigQuery Error: ${data.error.message}`);
            }

            return this.transformBigQueryResponse(data);

        } catch (error) {
            console.error('BigQuery query failed:', error);
            throw error;
        }
    }

    transformBigQueryResponse(data) {
        if (!data.rows || data.rows.length === 0) {
            return [];
        }

        const fields = data.schema.fields.map(field => field.name);
        
        return data.rows.map(row => {
            const item = {};
            fields.forEach((field, index) => {
                let value = row.f[index].v;
                
                // 數據類型轉換
                switch (field) {
                    case 'date':
                        value = value ? new Date(value + 'T00:00:00') : null;
                        break;
                    case 'weight':
                        value = parseFloat(value) || 0;
                        break;
                    case 'total_records':
                    case 'total_weight':
                    case 'completed_tasks':
                        value = parseInt(value) || 0;
                        break;
                    case 'avg_weight':
                        value = parseFloat(value) || 0;
                        break;
                }
                
                item[field] = value;
            });
            return item;
        });
    }

    async loadData() {
        const loadingElement = document.getElementById('statsGrid');
        loadingElement.innerHTML = '<div class="loading">🔄 Connecting to BigQuery...</div>';

        try {
            // 1. 首先檢查表格中是否有數據
            const checkQuery = `SELECT COUNT(*) as total_count FROM \`${PROJECT_ID}.transfer_stations.all_stations\``;
            const countResult = await this.queryBigQuery(checkQuery);
            const totalRecords = countResult[0]?.total_count || 0;

            if (totalRecords === 0) {
                loadingElement.innerHTML = `
                    <div class="error">
                        📊 No data found in BigQuery<br>
                        <small>Please load your data first using the INSERT statements</small>
                    </div>
                `;
                return;
            }

            loadingElement.innerHTML = '<div class="loading">🔄 Loading station statistics...</div>';

            // 2. 加載站點統計數據
            const statsQuery = `
                SELECT 
                    station,
                    COUNT(*) as total_records,
                    SUM(weight) as total_weight,
                    AVG(weight) as avg_weight,
                    COUNTIF(status = 'Completed') as completed_tasks,
                    MAX(date) as latest_date
                FROM \`${PROJECT_ID}.transfer_stations.all_stations\`
                GROUP BY station
                ORDER BY total_weight DESC
            `;

            this.stationStats = await this.queryBigQuery(statsQuery);
            console.log('Station stats loaded:', this.stationStats);

            loadingElement.innerHTML = '<div class="loading">🔄 Loading recent transactions...</div>';

            // 3. 加載詳細數據（最近1000條）
            const dataQuery = `
                SELECT 
                    date,
                    status,
                    vehicle_task,
                    time,
                    weight,
                    source,
                    station
                FROM \`${PROJECT_ID}.transfer_stations.all_stations\`
                ORDER BY date DESC, time DESC
                LIMIT 1000
            `;

            this.allData = await this.queryBigQuery(dataQuery);
            console.log('Detailed data loaded:', this.allData.length, 'records');

            this.processData();
            loadingElement.innerHTML = '';

        } catch (error) {
            console.error('Error loading data:', error);
            this.handleLoadError(error);
        }
    }

    handleLoadError(error) {
        const loadingElement = document.getElementById('statsGrid');
        
        let errorMessage = 'Error loading data from BigQuery';
        
        if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = '❌ Access Denied - Please check API Key restrictions';
        } else if (error.message.includes('BigQuery Error: Not found')) {
            errorMessage = '❌ Project or Table not found';
        } else if (error.message.includes('BigQuery Error: Access denied')) {
            errorMessage = '❌ BigQuery API not enabled or permission denied';
        } else {
            errorMessage = `❌ ${error.message}`;
        }
        
        loadingElement.innerHTML = `
            <div class="error">
                ${errorMessage}<br>
                <small>Check browser console for details</small>
            </div>
        `;
    }

    processData() {
        this.allData.forEach(item => {
            if (item.date && typeof item.date === 'string') {
                item.date = new Date(item.date);
            }
            item.weight = parseFloat(item.weight) || 0;
        });
    }

    populateStationSelector() {
        const select = document.getElementById('stationSelect');
        select.innerHTML = '<option value="all">📊 All Stations</option>';
        
        if (this.stationStats && this.stationStats.length > 0) {
            this.stationStats.forEach(stat => {
                const option = document.createElement('option');
                option.value = stat.station;
                const recordText = stat.total_records > 0 ? 
                    `(${stat.total_records.toLocaleString()} records)` : 
                    '(No data)';
                option.textContent = `🏭 ${stat.station} ${recordText}`;
                select.appendChild(option);
            });
        }
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
                <p>${totalWeight.toLocaleString('en-US', {maximumFractionDigits: 2})} tons</p>
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

    createDataTable(data) {
        const tableContainer = document.getElementById('dataTable');
        const recentData = data.slice(0, 15);
        
        if (recentData.length === 0) {
            tableContainer.innerHTML = '<div class="error">No data available in BigQuery table</div>';
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
                                <td><strong>${item.station || 'N/A'}</strong></td>
                                <td>${item.date ? item.date.toLocaleDateString('en-HK') : 'N/A'}</td>
                                <td>
                                    <span style="
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 0.8rem;
                                        background-color: ${item.status === 'Completed' ? '#d4edda' : '#fff3cd'};
                                        color: ${item.status === 'Completed' ? '#155724' : '#856404'};
                                    ">
                                        ${item.status || 'Unknown'}
                                    </span>
                                </td>
                                <td>${item.vehicle_task || 'N/A'}</td>
                                <td>${item.time || 'N/A'}</td>
                                <td><strong>${(item.weight || 0).toFixed(2)}</strong></td>
                                <td>${item.source || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; text-align: center; color: #6c757d; font-size: 0.9rem;">
                Showing ${recentData.length} recent transactions from BigQuery
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
        this.createDataTable(filteredData);
    }
}

// 初始化儀表板
document.addEventListener('DOMContentLoaded', () => {
    new BigQueryDirectDashboard();
});
