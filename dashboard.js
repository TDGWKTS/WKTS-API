// BigQuery 直接 REST API 調用
const PROJECT_ID = 'ordinal-shield-475803-m5';
const API_KEY = 'AIzaSyCFUOcBL0AxZ0t-9VQoIfw2VicLcJt7BRQ'; // 從 Google Cloud Console 獲取

class BigQueryDashboard {
    async queryBigQueryDirect(sqlQuery) {
        const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: sqlQuery,
                useLegacySql: false
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        // 轉換 BigQuery 響應格式
        return this.transformBigQueryResponse(data);
    }

    transformBigQueryResponse(data) {
        if (!data.rows) return [];
        
        const fields = data.schema.fields.map(field => field.name);
        
        return data.rows.map(row => {
            const item = {};
            fields.forEach((field, index) => {
                item[field] = row.f[index].v;
            });
            return item;
        });
    }
}
