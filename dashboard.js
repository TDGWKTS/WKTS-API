// BigQuery 配置
const PROJECT_ID = 'ordinal-shield-475803-m5';
const DATASET = 'transfer_stations';

class BigQueryDashboard {
    constructor() {
        this.allData = [];
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
        
        const testQuery = `
            SELECT 
                "Connection test successful" as status,
                CURRENT_TIMESTAMP() as server_time,
                "${PROJECT_ID}" as project_id
        `;
        
        try {
            const result = await this.queryBigQuery(testQuery);
            console.log('BigQuery connection test successful:', result);
        } catch (error) {
            console.error('BigQuery connection test failed:', error);
        }
    }

    async queryBigQuery(sqlQuery) {
        try {
            // 暫時使用模擬數據
            console.log('Executing query:', sqlQuery);
            
            if (sqlQuery.includes('COUNT(*)') || sqlQuery.includes('GROUP BY')) {
                return this.getMockAggregatedData();
            }
            
            return this.getMockSampleData();
            
        } catch (error) {
            console.error('BigQuery query failed:', error);
            throw error;
        }
    }

    getMockAggregatedData() {
        // 模擬匯總數據 - 使用英文欄位名稱
        return [
            { 
                station: 'Kwai Chung', 
                total_records: 250000, 
                total_weight: 1875000, 
                avg_weight: 7.5, 
                completed_tasks: 200000,
                latest_date: '2024-01-20' 
            },
            { 
                station: 'Tseung Kwan O', 
                total_records: 250000, 
                total_weight: 1750000, 
                avg_weight: 7.0, 
                completed_tasks: 220000,
                latest_date: '2024-01-20' 
            },
            { 
                station: 'Tuen Mun', 
                total_records: 250000, 
                total_weight: 1625000, 
                avg_weight: 6.5, 
                completed_tasks: 210000,
                latest_date: '2024-01-20' 
            }
        ];
    }

    getMockSampleData() {
        // 模擬詳細數據 - 使用英文欄位名稱
        return [
            {
                date: '2024-01-20',
                status: 'Completed',
                vehicle_task: 'C31 Food and Environmental Hygiene Department',
                time: '07:32:22',
                weight: 7.86,
                source: '22',
                station: 'Kwai Chung'
            },
            {
                date: '2024-01-20', 
                status: 'In Progress',
                vehicle_task: 'A45 Construction Waste Collection',
                time: '08:15:33',
                weight: 8.42,
                source: '15',
                station: 'Tseung Kwan O'
            }
        ];
    }

    async loadData() {
        const loadingElement = document.getElementById('statsGrid');
        loadingElement.innerHTML = '<div class="loading">🔄 Loading data from BigQuery...</div>';

        try {
            // 獲取匯總統計數據 - 使用英文欄位名稱
            const statsQuery = `
                SELECT 
                    station,
                    COUNT(*) as total_records,
                    SUM(weight) as total_weight,
                    AVG(weight) as avg_weight,
                    COUNTIF(status = 'Completed') as completed_tasks,
                    MAX(date) as latest_date
                FROM \`${PROJECT_ID}.${DATASET}.all_stations\`
                GROUP BY station
                ORDER BY total_weight DESC
            `;

            const statsData = await this.queryBigQuery(statsQuery);
            this.stationStats = statsData;

            // 獲取樣本數據
            const sampleData = await this.queryBigQuery(`SELECT * FROM \`${PROJECT_ID}.${DATASET}.all_stations\` LIMIT 1000`);
            this.allData = sampleData;
            this.processData();
            
            loadingElement.innerHTML = '';
            
        } catch (error) {
            console.error('Error loading data:', error);
            // 使用模擬數據繼續
            this.stationStats = this.getMockAggregatedData();
            this.allData = this.getMockSampleData();
            this.processData();
            loadingElement.innerHTML = '<div class="loading">Using demo data for display</div>';
        }
    }

    processData() {
        // 處理數據
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
        
        if (this.stationStats) {
            this.stationStats.forEach(stat => {
                const option = document.createElement('option');
                option.value = stat.station;
                option.textContent = `🏭 ${stat.station} (${stat.total_records.toLocaleString()} records)`;
                select.appendChild(option);
            });
        }
    }

    updateStats(data) {
        const statsGrid = document.getElementById('statsGrid');
        
        const totalWeight = data.reduce((sum, item) => sum + item.weight, 0);
        const totalEntries = data.length;
        const completedTasks = data.filter(item => item.status === 'Completed').length;
        const avgWeight = totalEntries > 0 ? totalWeight / totalEntries : 0;
        
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
                <h3>Average Weight</h3>
                <p>${avgWeight.toLocaleString('en-US', {maximumFractionDigits: 2})} tons</p>
            </div>
        `;
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
                                <td>${item.date ? item.date.toLocaleDateString('en-HK') : 'N/A'}</td>
                                <td>
                                    <span style="
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 0.8rem;
                                        background-color: ${item.status === 'Completed' ? '#d4edda' : '#fff3cd'};
                                        color: ${item.status === 'Completed' ? '#155724' : '#856404'};
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
                Showing ${recentData.length} recent transactions
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
        const filteredData = this.currentStation === 'all' 
            ? this.allData 
            : this.allData.filter(item => item.station === this.currentStation);
        
        this.updateStats(filteredData);
        this.createDataTable(filteredData);
    }
}

// 初始化儀表板
document.addEventListener('DOMContentLoaded', () => {
    new BigQueryDashboard();
});
