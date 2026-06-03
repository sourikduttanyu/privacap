package store

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Bucket struct {
	NoisyValue int     `json:"count"`
	Frequency  float64 `json:"frequency"`
}

type PGStore struct {
	db *pgxpool.Pool
}

func NewPG(db *pgxpool.Pool) *PGStore {
	return &PGStore{db: db}
}

// WriteImpressionAsync fires a goroutine INSERT — not in hot path.
func (s *PGStore) WriteImpressionAsync(cohortID string, noisyValue int, epsilon float64) {
	go func() {
		_, err := s.db.Exec(context.Background(),
			`INSERT INTO impression_log (cohort_id, noisy_value, epsilon) VALUES ($1, $2, $3)`,
			cohortID, noisyValue, epsilon,
		)
		if err != nil {
			log.Printf("impression_log write failed: %v", err)
		}
	}()
}

// WriteEnforcementAsync fires a goroutine INSERT — not in hot path.
func (s *PGStore) WriteEnforcementAsync(cohortID, campaignID string, cap int, action string) {
	go func() {
		_, err := s.db.Exec(context.Background(),
			`INSERT INTO cap_enforcement_log (cohort_id, campaign_id, cap_threshold, action) VALUES ($1, $2, $3, $4)`,
			cohortID, campaignID, cap, action,
		)
		if err != nil {
			log.Printf("cap_enforcement_log write failed: %v", err)
		}
	}()
}

// GetDistribution aggregates impression_log by noisy_value for a campaign.
func (s *PGStore) GetDistribution(ctx context.Context, campaignID string) ([]Bucket, error) {
	rows, err := s.db.Query(ctx,
		`SELECT noisy_value, COUNT(*)::float / NULLIF(SUM(COUNT(*)) OVER (), 0) AS frequency
		 FROM impression_log
		 WHERE cohort_id LIKE '%'
		 GROUP BY noisy_value
		 ORDER BY noisy_value`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []Bucket
	for rows.Next() {
		var b Bucket
		if err := rows.Scan(&b.NoisyValue, &b.Frequency); err != nil {
			return nil, err
		}
		buckets = append(buckets, b)
	}
	return buckets, rows.Err()
}
