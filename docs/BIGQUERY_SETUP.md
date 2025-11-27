# BigQuery resign_tagging Table Setup

## Table Created Successfully ✅

The `resign_tagging` table has been created in BigQuery with the following configuration:

### Schema

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | STRING | NOT NULL | Primary key |
| emp_code | STRING | NOT NULL | Employee code |
| resigned_at | TIMESTAMP | NOT NULL | Resignation date |
| tagging_date | TIMESTAMP | NOT NULL | Auto-tagging timestamp |
| status | STRING | NOT NULL | COMPLETE \| FAILED |
| created_at | TIMESTAMP | - | Auto-generated timestamp |

### Partitioning & Clustering

- **Partition:** Daily by `DATE(tagging_date)`
- **Clustering:** By `emp_code`

### Quick Queries

#### Insert test record
```sql
INSERT INTO `data-integration-474311.saasdb.resign_tagging` (
  id, emp_code, resigned_at, tagging_date, status
)
VALUES (
  'TEST_001_1234567890',
  'E0001234',
  TIMESTAMP('2025-09-15'),
  CURRENT_TIMESTAMP(),
  'COMPLETE'
);
```

#### Query all records
```sql
SELECT * FROM `data-integration-474311.saasdb.resign_tagging`
ORDER BY tagging_date DESC
LIMIT 10;
```

#### Count records by day
```sql
SELECT 
  DATE(tagging_date) as day,
  COUNT(*) as count
FROM `data-integration-474311.saasdb.resign_tagging`
WHERE status = 'COMPLETE'
GROUP BY DATE(tagging_date)
ORDER BY day DESC;
```

### Usage in WF#7

The ResignTaggingProcessor will insert records with structure:

```json
{
  "id": "E0001234_1732425445123",
  "emp_code": "E0001234",
  "resigned_at": "2025-09-15T00:00:00Z",
  "tagging_date": "2025-11-24T14:31:45.123Z",
  "status": "COMPLETE"
}
```

---

## Notes

- Table is **partitioned by date** for optimal query performance
- Table is **clustered by emp_code** for fast employee lookups
- **Automatic timestamp** on created_at field
- **Fully compliant** with BigQuery best practices
