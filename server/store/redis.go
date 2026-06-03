package store

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisStore struct {
	client *redis.Client
}

func NewRedis(addr string) *RedisStore {
	return &RedisStore{
		client: redis.NewClient(&redis.Options{Addr: addr}),
	}
}

func (r *RedisStore) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// IncrCount increments the noisy count for a cohort+campaign.
// Sets TTL only on first increment (when count becomes 1).
func (r *RedisStore) IncrCount(ctx context.Context, cohortID, campaignID string, ttl time.Duration) (int64, error) {
	key := fmt.Sprintf("cap:%s:%s", cohortID, campaignID)

	pipe := r.client.Pipeline()
	incrCmd := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl) // harmless on existing keys: resets TTL each time
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}

	return incrCmd.Val(), nil
}

// GetCount returns current count without incrementing.
func (r *RedisStore) GetCount(ctx context.Context, cohortID, campaignID string) (int64, error) {
	key := fmt.Sprintf("cap:%s:%s", cohortID, campaignID)
	val, err := r.client.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return val, err
}
