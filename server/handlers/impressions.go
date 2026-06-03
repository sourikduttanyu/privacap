package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/sourikduttanyu/privacap/server/budget"
	"github.com/sourikduttanyu/privacap/server/store"
)

type ImpressionRequest struct {
	CohortID   string  `json:"cohort_id"`
	CampaignID string  `json:"campaign_id"`
	NoisyValue int     `json:"noisy_value"`
	UserID     *string `json:"user_id"` // must be absent — reject if present
}

type ImpressionResponse struct {
	Action       string  `json:"action"`
	CurrentCount int64   `json:"current_count"`
	CapThreshold int     `json:"cap_threshold"`
}

func Impressions(rs *store.RedisStore, pg *store.PGStore, bc *budget.Client, cap int, windowTTL time.Duration, epsilon float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ImpressionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}

		// Reject any request that includes user_id — privacy invariant
		if req.UserID != nil {
			http.Error(w, `{"error":"user_id_not_accepted"}`, http.StatusBadRequest)
			return
		}
		if req.CohortID == "" || req.CampaignID == "" {
			http.Error(w, `{"error":"missing_fields"}`, http.StatusBadRequest)
			return
		}

		// Budget check — fail closed: any error = reject
		allowed, err := bc.CheckAndConsume(r.Context(), req.CohortID, req.CampaignID, epsilon)
		if err != nil {
			http.Error(w, `{"error":"budget_service_unavailable"}`, http.StatusServiceUnavailable)
			return
		}
		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{
				"error":     "privacy_budget_exhausted",
				"cohort_id": req.CohortID,
			})
			return
		}

		count, err := rs.IncrCount(r.Context(), req.CohortID, req.CampaignID, windowTTL)
		if err != nil {
			http.Error(w, `{"error":"redis_error"}`, http.StatusInternalServerError)
			return
		}

		action := "serve"
		if count > int64(cap) {
			action = "suppress"
		}

		pg.WriteImpressionAsync(req.CohortID, req.NoisyValue, epsilon)
		pg.WriteEnforcementAsync(req.CohortID, req.CampaignID, cap, action)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ImpressionResponse{
			Action:       action,
			CurrentCount: count,
			CapThreshold: cap,
		})
	}
}
