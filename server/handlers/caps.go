package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sourikduttanyu/privacap/server/budget"
	"github.com/sourikduttanyu/privacap/server/store"
)

type CapsResponse struct {
	Action          string  `json:"action"`
	CurrentCount    int64   `json:"current_count"`
	CapThreshold    int     `json:"cap_threshold"`
	BudgetRemaining float64 `json:"budget_remaining"`
}

func GetCaps(rs *store.RedisStore, bc *budget.Client, cap int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cohortID := chi.URLParam(r, "cohort_id")
		campaignID := chi.URLParam(r, "campaign_id")

		count, err := rs.GetCount(r.Context(), cohortID, campaignID)
		if err != nil {
			http.Error(w, `{"error":"redis_error"}`, http.StatusInternalServerError)
			return
		}

		remaining, _ := bc.GetRemaining(r.Context(), cohortID)

		action := "serve"
		if count > int64(cap) {
			action = "suppress"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CapsResponse{
			Action:          action,
			CurrentCount:    count,
			CapThreshold:    cap,
			BudgetRemaining: remaining,
		})
	}
}
